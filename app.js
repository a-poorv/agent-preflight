const App = (function() {
  const DOM = {
    app: document.querySelector('.app-container'),
    welcomeView: document.querySelector('#welcome-view'),
    chatView: document.querySelector('#chat-view'),
    messagesArea: document.querySelector('#messages-area'),
    quickPrompts: document.querySelector('#quick-prompts'),
    promptInput: document.querySelector('#prompt-input'),
    btnSend: document.querySelector('#btn-send')
  };

  const QUICK_PROMPTS = [
    { label: "Debug why my login form is throwing a 500 error after the latest deploy", prompt: "Debug why my login form is throwing a 500 error after the latest deploy" },
    { label: "Refactor the dashboard components to use a shared layout — don't change behavior", prompt: "Refactor the dashboard components to use a shared layout — don't change behavior" },
    { label: "Build a Kanban board with drag-and-drop, persisted to localStorage", prompt: "Build a Kanban board with drag-and-drop, persisted to localStorage" },
    { label: "What's the difference between useMemo and useCallback?", prompt: "What's the difference between useMemo and useCallback?" }
  ];

  let isExecuting = false;
  let currentAnalysis = null;
  let currentStepIndex = 0;

  function init() {
    renderQuickPrompts();
    bindEvents();
  }

  function renderQuickPrompts() {
    DOM.quickPrompts.innerHTML = QUICK_PROMPTS.map(qp =>
      `<button class="quick-prompt" data-prompt="${qp.prompt.replace(/"/g, '&quot;')}">${qp.label}</button>`
    ).join('');
  }

  function bindEvents() {
    DOM.btnSend.addEventListener('click', handleSubmit);
    DOM.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    });
    DOM.promptInput.addEventListener('input', () => {
      autoResize(DOM.promptInput);
    });

    DOM.quickPrompts.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-prompt');
      if (btn) {
        DOM.promptInput.value = btn.dataset.prompt;
        autoResize(DOM.promptInput);
        DOM.promptInput.focus();
      }
    });
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  function handleSubmit() {
    const prompt = DOM.promptInput.value.trim();
    if (!prompt || isExecuting) return;

    DOM.welcomeView.style.display = 'none';
    DOM.chatView.style.display = 'flex';

    addMessage('user', prompt);
    DOM.promptInput.value = '';
    DOM.promptInput.style.height = 'auto';

    currentAnalysis = PreFlightEngine.analyze(prompt);
    renderPreFlightCard(currentAnalysis);
    scrollToBottom();
  }

  function addMessage(role, text) {
    if (role === 'user') {
      DOM.messagesArea.insertAdjacentHTML('beforeend', `<div class="message"><div class="message-user">${text}</div></div>`);
    }
  }

  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function renderPreFlightCard(analysis) {
    const { complexity, constraints, executionPlan, recommendation, optimizationProfile } = analysis;

    let html = `<div class="message"><div class="preflight-card">`;

    const recBadgeText = recommendation.mode === 'skill' ? 'Skill recommended' : recommendation.mode === 'agent' ? 'Agent recommended' : 'Manual mode';
    
    html += `<div class="pf-header">
      <div class="pf-title-area">
        <div class="pf-icon">${analysis.taskIcon}</div>
        <div class="pf-title-text">
          <span>PRE-FLIGHT</span>
          <h3>${analysis.taskLabel}</h3>
        </div>
      </div>
      <div class="pf-badge" style="${optimizationProfile && optimizationProfile.profileType === 'quality' ? 'background:var(--accent-orange);' : ''}">${recBadgeText}</div>
    </div>`;

    html += `<div class="pf-subtitle">This looks like a ${complexity.contextLoad}-complexity ${analysis.taskLabel.toLowerCase()} task — ${recommendation.reasoning.split('.')[0]}.</div>`;

    html += `<div class="pf-meta">
      <div class="meta-col"><div class="meta-label">COMPLEXITY</div><div class="meta-val">${capitalize(complexity.contextLoad)}</div></div>
      <div class="meta-col"><div class="meta-label">EST STEPS</div><div class="meta-val">${complexity.stepCount}</div></div>
      <div class="meta-col"><div class="meta-label">CONFIDENCE</div><div class="meta-val">${Math.round(recommendation.confidence * 100)}%</div></div>
    </div>`;

    html += `<div class="pf-section">
      <div class="pf-section-title">EXECUTION PLAN</div>
      <div class="step-list">`;
    executionPlan.steps.forEach(step => {
      html += `<div class="step-item" data-step-id="${step.id}">
        <div class="step-num">${step.id}</div>
        <div class="step-content">
          <div class="step-title">${step.action} ${step.checkpoint ? '<span class="checkpoint-badge">CHECKPOINT</span>' : ''}</div>
          <div class="step-desc">${step.desc}</div>
        </div>
      </div>`;
    });
    html += `</div></div>`;

    if (constraints.length > 0) {
      html += `<div class="pf-section" style="border-bottom: none; padding-bottom: 12px;">
        <div class="pf-section-title">CONSTRAINTS I'LL HONOR</div>`;
      constraints.forEach(c => {
        html += `<div class="constraint-item">
          <span class="constraint-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
          <span>${c.rule}</span>
        </div>`;
      });
      html += `</div>`;
    }

    if (optimizationProfile) {
      let optLabel = 'Balanced';
      let optClass = 'opt-badge-balanced';
      if (optimizationProfile.profileType === 'skill') { optLabel = 'Efficiency'; }
      if (optimizationProfile.profileType === 'quality') { optLabel = 'Quality-optimized'; optClass = 'opt-badge-quality'; }

      const badgeBg = optClass === 'opt-badge-quality' ? 'var(--accent-orange)' : '#F3F1EB';
      const badgeColor = optClass === 'opt-badge-quality' ? '#FFF' : 'var(--text-main)';

      html += `<div class="pf-section" style="padding-top: 0;">
        <div class="pf-section-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          OPTIMIZATION PROFILE
          <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px; text-transform: none; font-size: 11px; font-weight: 600;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 12h18"></path></svg> ${optLabel}
          </span>
        </div>
        <div class="opt-profile">
          <div class="opt-desc">${optimizationProfile.description}</div>
          <div class="opt-bars">
            <div class="opt-bar">
              <div class="opt-bar-header"><span>TOKENS</span><span>${optimizationProfile.tokens}</span></div>
              <div class="bar-track"><div class="bar-fill" style="width: ${optimizationProfile.tokens}%"></div></div>
            </div>
            <div class="opt-bar">
              <div class="opt-bar-header"><span>QUALITY</span><span>${optimizationProfile.quality}</span></div>
              <div class="bar-track"><div class="bar-fill" style="width: ${optimizationProfile.quality}%"></div></div>
            </div>
            <div class="opt-bar">
              <div class="opt-bar-header"><span>LATENCY</span><span>${optimizationProfile.latency}</span></div>
              <div class="bar-track"><div class="bar-fill" style="width: ${optimizationProfile.latency}%"></div></div>
            </div>
          </div>
          <ul class="opt-bullets">
            ${optimizationProfile.bullets.map(b => `<li>${b}</li>`).join('')}
          </ul>
        </div>`;

      if (optimizationProfile.mode === 'skill') {
        html += `<div style="margin-top:24px;">
          <div class="pf-section-title">DETERMINISM BOUNDARIES</div>
          <div style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">Techniques I'll apply to make a non-deterministic agent behave predictably.</div>
          
          <div style="border:1px solid var(--border-light); border-radius:var(--radius-md); padding:16px; display:flex; gap:16px; background:#fff;">
            <div style="width:32px; height:32px; background:var(--accent-orange); color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <h4 style="font-size:14px; margin:0;">Auto-create a reusable skill</h4>
                <span style="font-size:9px; font-weight:700; background:#F3F1EB; padding:2px 6px; border-radius:4px; border:1px solid #EBE8E0;">SKILL</span>
              </div>
              <div style="font-size:10px; font-weight:700; color:var(--accent-green); background:rgba(61,139,99,0.1); display:inline-block; padding:2px 6px; border-radius:4px; margin-bottom:8px; letter-spacing:0.5px;">AUTO-CREATE</div>
              <p style="font-size:12px; color:var(--text-muted); line-height:1.5;">I'll package the optimization rule as a saved skill so future runs apply it deterministically — no re-derivation.</p>
            </div>
          </div>
        </div>`;
      }

      html += `<div class="rec-reasoning"><strong>Why this recommendation:</strong> ${recommendation.reasoning}</div>
      </div>`;
    }

    html += `<div class="pf-actions">
      <button class="btn btn-primary" onclick="App.runAgent()">Proceed with Agent &rarr;</button>
      <button class="btn btn-secondary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Modify</button>
      <button class="btn btn-ghost" onclick="App.runManual()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Manual mode</button>
    </div>`;

    html += `</div></div>`; // end card and message wrapper

    DOM.messagesArea.insertAdjacentHTML('beforeend', html);
  }

  function renderAgentRunningCard(analysis, status = 'running') {
    let html = `<div class="agent-running-card">`;
    const title = status === 'running' 
        ? `<div class="ar-dot"></div> Agent running` 
        : `<div style="color:var(--accent-green); display:inline-block; margin-right:8px; font-size:16px;">●</div> Execution complete`;
    
    html += `<div class="ar-header">
      <div style="display:flex; align-items:center;">${title}</div>
      <button class="btn-ghost" onclick="App.reset()" style="font-size:11px; padding:4px 8px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.43-11.44L2.5 8"></path></svg> New task</button>
    </div>`;

    html += `<div class="ar-steps" id="ar-steps">`;
    analysis.executionPlan.steps.forEach(step => {
      html += renderStep(step, 'pending');
    });
    html += `</div>`;
    
    if (status === 'complete') {
        html += `<div style="background:rgba(61,139,99,0.05); color:var(--text-main); padding:12px; border-radius:8px; font-size:12px; display:flex; gap:8px; align-items:center; margin-top:16px; border:1px solid rgba(61,139,99,0.2);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Plan executed end-to-end. In a real session, this is where the agent would deliver results.
        </div>`;
    }
    
    html += `</div>`;
    return html;
  }

  function renderStep(step, status) {
    let icon = `<div class="ar-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="transparent" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg></div>`;
    let classes = `ar-step`;
    let extraHtml = '';
    
    if (status === 'done') {
        classes += ` done`;
        icon = `<div class="ar-icon" style="background:var(--accent-green); border-color:var(--accent-green); color:white;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;
    } else if (status === 'paused') {
        classes += ` paused`;
        icon = `<div class="ar-icon" style="background:var(--accent-yellow); border-color:var(--accent-yellow); color:white;"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg></div>`;
        extraHtml = `<div style="display:flex; align-items:center; gap:12px; margin-top:12px;">
            <button class="btn btn-primary" style="padding:6px 16px; font-size:12px; flex:none; width:auto;" onclick="App.continueExecution(${step.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Approve & continue</button>
            <span style="font-size:11px; color:var(--text-muted);">Paused for your review</span>
        </div>`;
    } else if (status === 'running') {
        icon = `<div class="ar-icon" style="border-color:var(--accent-orange); border-top-color:transparent; border-radius:50%; animation: spin 1s linear infinite;"></div>`;
    }
    
    return `<div class="${classes}" id="step-${step.id}">
        ${icon}
        <div class="ar-content" style="flex:1;">
            <h4 style="display:flex; align-items:center; gap:8px;">
                ${step.action} 
                ${step.checkpoint ? `<span class="checkpoint-badge" style="${status==='paused' ? 'background:rgba(236,163,53,0.2);' : ''}">CHECKPOINT</span>` : ''}
            </h4>
            <p style="${status==='pending' ? 'opacity:0.5;' : ''}">${step.desc}</p>
            ${extraHtml}
        </div>
    </div>`;
  }

  function runAgent() {
    if (!currentAnalysis) return;
    isExecuting = true;
    currentStepIndex = 0;
    
    const container = document.querySelector('.preflight-card').parentNode;
    container.innerHTML = renderAgentRunningCard(currentAnalysis, 'running');
    scrollToBottom();
    
    simulateExecution();
  }

  function simulateExecution() {
    const steps = currentAnalysis.executionPlan.steps;
    
    function processStep() {
        if (currentStepIndex >= steps.length) {
            isExecuting = false;
            const container = document.querySelector('.agent-running-card').parentNode;
            container.innerHTML = renderAgentRunningCard(currentAnalysis, 'complete');
            scrollToBottom();
            return;
        }
        
        const step = steps[currentStepIndex];
        const el = document.getElementById(`step-${step.id}`);
        el.outerHTML = renderStep(step, 'running');
        
        setTimeout(() => {
            if (step.checkpoint) {
                document.getElementById(`step-${step.id}`).outerHTML = renderStep(step, 'paused');
            } else {
                document.getElementById(`step-${step.id}`).outerHTML = renderStep(step, 'done');
                currentStepIndex++;
                processStep();
            }
        }, 1500);
    }
    
    setTimeout(processStep, 500);
  }

  function continueExecution(stepId) {
      const step = currentAnalysis.executionPlan.steps.find(s => s.id === stepId);
      document.getElementById(`step-${step.id}`).outerHTML = renderStep(step, 'done');
      currentStepIndex++;
      
      const btnContainer = document.getElementById(`step-${step.id}`).querySelector('.ar-content');
      if(btnContainer) {
          // Extra elements removed in 'done' render
      }
      
      setTimeout(() => {
          simulateExecution();
      }, 500);
  }

  function runManual() {
    const container = document.querySelector('.preflight-card').parentNode;
    container.innerHTML = `<div class="agent-running-card" style="text-align:center; padding: 40px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom:16px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <h3 style="font-family:var(--font-serif); font-size:24px; margin-bottom:8px;">Manual Mode Active</h3>
        <p style="color:var(--text-muted); font-size:14px; max-width:400px; margin:0 auto;">Agent execution is disabled. You are now in a standard chat session. Type your instructions below to proceed manually.</p>
        <button class="btn btn-secondary" onclick="App.reset()" style="margin: 24px auto 0;">Start over</button>
    </div>`;
    scrollToBottom();
  }

  function reset() {
      DOM.messagesArea.innerHTML = '';
      DOM.welcomeView.style.display = 'block';
      DOM.chatView.style.display = 'none';
      currentAnalysis = null;
      isExecuting = false;
      currentStepIndex = 0;
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  return { init, runAgent, runManual, continueExecution, reset };
})();

document.addEventListener('DOMContentLoaded', App.init);

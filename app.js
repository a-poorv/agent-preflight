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
  let lastSubmittedPrompt = '';

  function init() {
    renderQuickPrompts();
    bindEvents();
    bindDelegateEvents();
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
  
  function bindDelegateEvents() {
    DOM.messagesArea.addEventListener('click', (e) => {
      const saveBtn = e.target.closest('.btn-save-skill');
      if (saveBtn && !saveBtn.disabled) {
        saveSkill(saveBtn, saveBtn.dataset.name, saveBtn.dataset.pattern, saveBtn.dataset.ref);
      }
      
      const discardBtn = e.target.closest('.btn-discard-skill');
      if (discardBtn) {
        discardSkill(discardBtn.dataset.ref);
      }
      
      const editBtn = e.target.closest('.btn-edit-skill');
      if (editBtn) {
        editSkill(editBtn.dataset.ref);
      }
    });
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  async function handleSubmit() {
    const prompt = DOM.promptInput.value.trim();
    if (!prompt || isExecuting) return;

    DOM.welcomeView.style.display = 'none';
    DOM.chatView.style.display = 'block';
    lastSubmittedPrompt = prompt;
    
    // Add loading state
    DOM.messagesArea.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="ar-dot" style="width:12px; height:12px; background:var(--accent-orange); border-radius:50%; margin:0 auto 16px; animation: pulse 1.5s infinite;"></div>
        Analyzing task with AI-native engine...
    </div>`;
    
    currentAnalysis = await PreFlightEngine.analyze(prompt);
    
    DOM.messagesArea.innerHTML = '';
    renderPreFlightCard(currentAnalysis);
    DOM.promptInput.value = '';
    autoResize(DOM.promptInput);
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

    let html = `<div class="message" style="flex-direction: column; align-items: center; gap: 8px; width: 100%;">`;
    
    // User bubble
    html += `<div class="message-user" style="background:#D96C51; color:white; padding:12px 24px; border-radius:24px; font-size:14px; max-width:90%; text-align:center; z-index: 10; position:relative; box-shadow: 0 4px 12px rgba(217, 108, 81, 0.2); margin-bottom: 24px;">${analysis.prompt}</div>`;

    html += `<div class="preflight-card" style="width: 100%; max-width: 680px; background: white; border: 1px solid var(--border-light); border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); position:relative;">`;

    const recBadgeText = recommendation.mode === 'skill' ? 'Skill recommended' : recommendation.mode === 'agent' ? 'Agent recommended' : 'Manual mode';
    
    html += `<div class="pf-header" style="display: block; background: #FAF8F2; padding: 24px 24px 20px; border-top-left-radius: 16px; border-top-right-radius: 16px; border-bottom: 1px solid var(--border-light);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="display: flex; gap: 16px; align-items: center;">
          <div style="width: 48px; height: 48px; background: ${analysis.color || '#ECA335'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            ${analysis.taskIcon}
          </div>
          <div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px;">PRE-FLIGHT</div>
            <h3 style="font-family: var(--font-serif); font-size: 28px; font-weight: 500; color: var(--text-main); margin: 0;">${analysis.taskLabel}</h3>
          </div>
        </div>
        <div style="background: ${optimizationProfile && optimizationProfile.profileType === 'quality' ? 'var(--accent-orange)' : '#D96C51'}; color: white; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 20px; white-space: nowrap; flex-shrink: 0;">${recBadgeText}</div>
      </div>
      <div style="margin-top: 20px; font-size: 14px; color: var(--text-muted);">
        A ${analysis.taskLabel.toLowerCase()} of ${complexity.contextLoad} scope — ${recommendation.reasoning.split('.')[0]}.
      </div>
    </div>`;

    html += `<div class="pf-meta" style="display: flex; padding: 20px 24px; border-bottom: 1px solid var(--border-light); margin: 0;">
      <div style="flex: 1; border-right: 1px solid var(--border-light); padding-right: 16px;">
        <div style="font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> COMPLEXITY</div>
        <div style="font-family: var(--font-serif); font-size: 24px; color: var(--text-main);">${capitalize(complexity.contextLoad)}</div>
      </div>
      <div style="flex: 1; border-right: 1px solid var(--border-light); padding: 0 16px;">
        <div style="font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> STEPS</div>
        <div style="font-family: var(--font-serif); font-size: 24px; color: var(--text-main);">${complexity.stepCount}</div>
      </div>
      <div style="flex: 1; padding-left: 16px;">
        <div style="font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> CONFIDENCE</div>
        <div style="font-family: var(--font-serif); font-size: 24px; color: var(--text-main);">${Math.round(recommendation.confidence * 100)}%</div>
      </div>
    </div>`;

    html += `<div class="pf-section" style="padding: 24px; border-bottom: 1px solid var(--border-light);">
      <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 16px;">EXECUTION PLAN</div>
      <div style="display: flex; flex-direction: column; gap: 16px;">`;
    executionPlan.steps.forEach(step => {
      html += `<div style="display: flex; gap: 12px; align-items: flex-start;">
        <div style="width: 24px; height: 24px; border-radius: 50%; background: #F3F1EB; color: var(--text-muted); font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${step.id}</div>
        <div>
          <div style="font-size: 14px; font-weight: 500; color: var(--text-main); display: flex; align-items: center; gap: 8px;">${step.action} ${step.checkpoint ? '<span style="font-size:9px; font-weight:700; background:rgba(236, 163, 53, 0.15); color:var(--accent-yellow); padding:2px 6px; border-radius:4px;">CHECKPOINT</span>' : ''}</div>
          <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">${step.desc}</div>
        </div>
      </div>`;
    });
    html += `</div></div>`;

    // Execution Guardrails
    if (constraints.length > 0) {
      html += `<div class="pf-section" style="border-bottom: none; padding-bottom: 24px;">
        <div class="pf-section-title">EXECUTION GUARDRAILS</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Strict rules I will follow to keep this agent on track.</div>
        
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${analysis.skillMatches && analysis.skillMatches.length > 0 ? `
            <div class="skill-nudge" style="padding:16px; background:#EBF4EF; border:1px solid #D1E7DD; border-radius:16px; display:flex; align-items:center; gap:12px; margin-bottom: 8px;">
              <div style="width:24px; height:24px; background:#3D8B63; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div style="font-size:13px; color:#2E694B; font-weight:500; flex:1; display:flex; align-items:center; gap:8px;">
                <span style="font-weight:700;">Intelligence applied:</span>
                <span style="background:black; color:white; padding:2px 8px; border-radius:4px; font-family:var(--font-mono); font-size:11px; letter-spacing:0.5px;">${analysis.skillMatches[0].ref.toUpperCase()}</span>
                <span style="color:rgba(46,105,75,0.7); font-size:12px;">based on your operational preferences.</span>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn-nudge-action btn-discard-skill" style="padding:4px 10px; font-size:11px; background:transparent; border:1px solid #3D8B63; color:#3D8B63; border-radius:6px; cursor:pointer;" data-ref="${analysis.skillMatches[0].ref}">Discard</button>
                <button class="btn-nudge-action btn-edit-skill" style="padding:4px 10px; font-size:11px; background:transparent; border:1px solid #3D8B63; color:#3D8B63; border-radius:6px; cursor:pointer;" data-ref="${analysis.skillMatches[0].ref}">Edit</button>
                <button style="padding:4px 10px; font-size:11px; background:#3D8B63; border:1px solid #3D8B63; color:white; border-radius:6px; cursor:default; opacity:0.8;">Active</button>
              </div>
            </div>
          ` : ''}
          
          ${analysis.suggestedSkills && analysis.suggestedSkills.length > 0 ? `
            <div class="skill-suggestion-card" style="padding:24px; background:rgba(217,108,81,0.03); border:1px solid rgba(217,108,81,0.12); border-radius:24px; margin-bottom: 24px;">
              <div style="display:flex; gap:16px; align-items:flex-start;">
                <div style="width:40px; height:40px; background:var(--accent-orange); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                </div>
                <div style="flex:1;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                      <h4 style="margin:0 0 8px 0; font-size:18px; font-weight:500; font-family:var(--font-serif); color:var(--text-main);">Save this as a one-click action</h4>
                      <div style="display:flex; gap:8px; align-items:center;">
                        <span style="font-size:10px; font-weight:700; color:var(--text-main); background:#F3F1EB; padding:3px 8px; border-radius:4px; letter-spacing:0.5px;">REUSABLE</span>
                        <span style="font-size:10px; font-weight:700; color:#3D8B63; background:#EBF4EF; padding:3px 8px; border-radius:4px; letter-spacing:0.5px;">SET UP FOR YOU</span>
                      </div>
                    </div>
                    <button class="btn btn-save-skill" style="padding:8px 20px; font-size:13px; font-weight:600; border:1px solid var(--accent-orange); color:var(--accent-orange); background:transparent; border-radius:12px; cursor:pointer;" 
                      data-name="${analysis.suggestedSkills[0].name.replace(/"/g, '&quot;')}" 
                      data-pattern="${analysis.suggestedSkills[0].pattern.replace(/"/g, '&quot;')}" 
                      data-ref="${analysis.suggestedSkills[0].ref.replace(/"/g, '&quot;')}">
                      Save as /skill
                    </button>
                  </div>
                  <p style="margin:16px 0; font-size:14px; color:var(--text-muted); line-height:1.5;">I'll bundle the rules I use here into a reusable shortcut you can run again anytime.</p>
                  <div style="display:flex; align-items:center; gap:8px; color:#3D8B63; font-size:14px; font-weight:500;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                    <span><strong>What you get:</strong> Next time, same job takes one click — no re-explaining.</span>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          ${constraints.map(c => `
            <div class="constraint-item" style="display:flex; align-items:center; gap:12px; font-size:14px; color:var(--text-main); padding-left: 8px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ${c.rule}
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    if (optimizationProfile) {
      let optLabel = 'Balanced';
      let optClass = 'opt-badge-balanced';
      if (optimizationProfile.profileType === 'skill') { optLabel = 'Efficiency'; }
      if (optimizationProfile.profileType === 'quality') { optLabel = 'Quality-optimized'; optClass = 'opt-badge-quality'; }
      if (analysis.skillMatches.length > 0) { optLabel = 'Skill-optimized'; optClass = 'opt-badge-quality'; }

      const badgeBg = optClass === 'opt-badge-quality' ? 'var(--accent-orange)' : '#F3F1EB';
      const badgeColor = optClass === 'opt-badge-quality' ? '#FFF' : 'var(--text-main)';

      html += `<div class="pf-section" style="padding-top: 0;">
        <details style="border: 1px solid var(--border-light); border-radius: 16px; padding: 16px; background: #fff;">
          <summary style="list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">
            OPTIMIZATION PROFILE
            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 8px; display: flex; align-items: center; gap: 4px; text-transform: none; font-size: 11px; font-weight: 700;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"></path></svg> ${optLabel}
            </span>
          </summary>
          <div style="margin-top: 20px;">
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
          </div>
        </details>
      </div>`;

    }

    html += `<div class="pf-actions">
      <button class="btn btn-primary" onclick="App.runAgent()">Proceed with Agent &rarr;</button>
      <button class="btn btn-secondary" onclick="App.modifyPrompt()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Modify</button>
      <button class="btn btn-ghost" onclick="App.runManual()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Manual mode</button>
    </div>`;

    html += `</div></div>`; // end card and message wrapper

    DOM.messagesArea.insertAdjacentHTML('beforeend', html);
  }

  function renderAgentRunningCard(analysis, status = 'running') {
    let html = `<div class="agent-running-card" style="width: 100%; max-width: 680px; background: white; border: 1px solid var(--border-light); border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); position:relative; overflow: hidden;">`;
    const title = status === 'running' 
        ? `<div class="ar-dot" style="width:8px; height:8px; background:var(--accent-orange); border-radius:50%; margin-right:12px; animation: pulse 1.5s infinite;"></div> <span style="font-size:18px; font-family:var(--font-serif); font-weight:500; color: var(--text-main);">Agent running</span>` 
        : `<div style="color:#D96C51; display:inline-block; margin-right:12px; font-size:12px; opacity:0.6;">●</div> <span style="font-size:18px; font-family:var(--font-serif); font-weight:500; color: var(--text-main);">Execution complete</span>`;
    
    html += `<div class="ar-header" style="background: #FAF8F2; padding: 20px 24px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light);">
      <div style="display:flex; align-items:center;">${title}</div>
      <button class="btn-ghost" onclick="App.reset()" style="font-size:12px; padding:6px 12px; color:var(--text-muted); display:flex; gap:6px; align-items:center; font-weight:500;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.43-11.44L2.5 8"></path></svg> New task</button>
    </div>`;

    // Removed intelligence nudge banner as requested to prioritize clean execution visibility
    // The optimization is already reflected in the step-level skill badges.

    html += `<div class="ar-content-inner" style="padding: 24px; display:flex; flex-direction:column; gap:16px;">`;
    html += `<div class="ar-steps" id="ar-steps" style="display:flex; flex-direction:column; gap:16px;">`;
    analysis.executionPlan.steps.forEach(step => {
      html += renderStep(step, 'pending');
    });
    html += `</div>`;
    
    if (status === 'complete') {
        html += `<div style="background:rgba(61,139,99,0.05); color:var(--text-main); padding:16px 20px; border-radius:12px; font-size:14px; display:flex; gap:12px; align-items:center; border:1px solid rgba(61,139,99,0.15);">
            <div style="width:24px; height:24px; border-radius:50%; background:var(--accent-green); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
            <div style="flex:1;">Plan executed end-to-end. In a real session, this is where the agent would deliver results.</div>
        </div>`;
    }
    
    html += `</div></div>`; // end inner and card
    return html;
  }

  function renderStep(step, status) {
    let icon = `<div class="ar-icon" style="width:24px; height:24px; border-radius:50%; border:1px solid var(--border-light); display:flex; align-items:center; justify-content:center; flex-shrink:0;"></div>`;
    let classes = `ar-step`;
    let extraHtml = '';
    let containerStyle = `border: 1px solid var(--border-light); border-radius: 12px; padding: 16px; display: flex; gap: 16px; align-items: flex-start;`;
    
    if (status === 'done') {
        classes += ` done`;
        containerStyle = `border: 1px solid #3D8B6322; border-radius: 16px; padding: 16px 20px; display: flex; gap: 16px; align-items: center; background: #3D8B6308;`;
        icon = `<div class="ar-icon" style="width:24px; height:24px; border-radius:50%; background:var(--accent-green); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;
    } else if (status === 'paused') {
        classes += ` paused`;
        containerStyle = `border: 1px solid #ECA33544; border-radius: 16px; padding: 20px; display: flex; gap: 16px; align-items: flex-start; background: #ECA33508; flex-direction: column;`;
        icon = `<div class="ar-icon" style="width:24px; height:24px; border-radius:50%; background:var(--accent-yellow); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg></div>`;
        extraHtml = `<div style="display:flex; align-items:center; gap:16px; width: 100%;">
            <button class="btn" style="padding:10px 24px; font-size:14px; font-weight:600; border-radius:24px; background:#D96C51; color:white; border:none; cursor:pointer; display:flex; align-items:center; gap:8px;" onclick="App.continueExecution(${step.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Approve & continue
            </button>
            <span style="font-size:13px; color:var(--text-muted);">Paused for your review</span>
        </div>`;
    } else if (status === 'running') {
        icon = `<div class="ar-icon" style="width:24px; height:24px; border-radius:50%; border:2px solid var(--border-light); border-top-color:var(--accent-orange); animation: spin 1s linear infinite; flex-shrink:0;"></div>`;
    }
    
    return `<div class="${classes}" id="step-${step.id}" style="${containerStyle}">
        ${icon}
        <div class="ar-content" style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px;">
                <h4 style="font-size:15px; font-weight:600; margin:0; color:var(--text-main);">${step.action}</h4>
                ${step.checkpoint ? `<span style="font-size:9px; font-weight:700; background:rgba(236, 163, 53, 0.15); color:var(--accent-yellow); padding:2px 6px; border-radius:4px;">CHECKPOINT</span>` : ''}
                ${step.skillRef ? `<span style="font-size:10px; font-weight:700; color:white; background:var(--accent-orange); padding:2px 8px; border-radius:4px; box-shadow: 0 2px 4px rgba(217,108,81,0.2); letter-spacing:0.3px;">${step.skillRef}</span>` : ''}
            </div>
            <p style="font-size:13px; color:var(--text-muted); margin:4px 0 0 0; ${status==='pending' ? 'opacity:0.5;' : ''}">${step.desc}</p>
            ${extraHtml}
        </div>
    </div>`;
  }

  function runAgent() {
    if (!currentAnalysis) return;
    isExecuting = true;
    currentStepIndex = 0;
    
    // Find only the card and replace it, keeping the prompt bubble above it
    const card = document.querySelector('.preflight-card');
    if (card) {
      card.outerHTML = renderAgentRunningCard(currentAnalysis, 'running');
    }
    
    scrollToBottom();
    simulateExecution();
  }

  function simulateExecution() {
    const steps = currentAnalysis.executionPlan.steps;
    
    function processStep() {
        if (currentStepIndex >= steps.length) {
            isExecuting = false;
            const card = document.querySelector('.agent-running-card');
            if (card) {
                card.outerHTML = renderAgentRunningCard(currentAnalysis, 'complete');
            }
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

  function reset(repopulatePrompt = null) {
      DOM.messagesArea.innerHTML = '';
      DOM.welcomeView.style.display = 'block';
      DOM.chatView.style.display = 'none';
      currentAnalysis = null;
      isExecuting = false;
      currentStepIndex = 0;
      
      if (repopulatePrompt) {
        DOM.promptInput.value = repopulatePrompt;
        DOM.promptInput.focus();
        // Adjust height if needed
        DOM.promptInput.style.height = 'auto';
        DOM.promptInput.style.height = DOM.promptInput.scrollHeight + 'px';
      } else {
        DOM.promptInput.value = '';
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function modifyPrompt() {
    if (!currentAnalysis) return;
    const prompt = currentAnalysis.prompt;
    reset(prompt);
  }

  async function saveSkill(btn, name, pattern, ref) {
    PreFlightEngine.saveNewSkill(name, pattern, ref);
    
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Skill added`;
    btn.style.background = '#EBF4EF';
    btn.style.color = '#3D8B63';
    btn.style.borderColor = 'var(--accent-green)';
    btn.disabled = true;
    
    // Instant re-analysis using the stored prompt
    setTimeout(async () => {
        const card = document.querySelector('.preflight-card');
        if (card) { card.style.opacity = '0.5'; }
        currentAnalysis = await PreFlightEngine.analyze(lastSubmittedPrompt);
        DOM.messagesArea.innerHTML = '';
        renderPreFlightCard(currentAnalysis);
        scrollToBottom();
    }, 600);
  }

  function discardSkill(ref) {
    if (!currentAnalysis) return;
    // For this prototype, we'll just re-analyze with a flag or just skip the match in the engine
    // Real implementation would have a transient 'ignored_skills' list
    alert(`Ignoring ${ref} for this task. Re-optimizing...`);
    reset(lastSubmittedPrompt);
  }

  function editSkill(ref) {
    const newName = prompt("Edit Skill Name:", ref.replace('.md', '').substring(1));
    if (newName) {
        alert(`Skill updated to: ${newName}. Re-analyzing...`);
        // In a real app, we would update the storage here
        reset(lastSubmittedPrompt);
    }
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  return { init, runAgent, runManual, continueExecution, reset, modifyPrompt, saveSkill, discardSkill, editSkill };
})();

document.addEventListener('DOMContentLoaded', App.init);

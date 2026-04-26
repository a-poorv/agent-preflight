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

    const analysis = PreFlightEngine.analyze(prompt);
    renderPreFlightCard(analysis);
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
      <div class="pf-badge">${recBadgeText}</div>
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
      const optLabel = optimizationProfile.mode === 'skill' ? 'Efficiency' : optimizationProfile.mode === 'agent' ? 'Balanced' : 'Speed';
      html += `<div class="pf-section" style="padding-top: 0;">
        <div class="pf-section-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          OPTIMIZATION PROFILE
          <span style="background: #F3F1EB; color: var(--text-main); padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px; text-transform: none; font-size: 11px; font-weight: 600;">
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
        </div>
        <div class="rec-reasoning"><strong>Why this recommendation:</strong> ${recommendation.reasoning}</div>
      </div>`;
    }

    html += `<div class="pf-actions">
      <button class="btn btn-primary" onclick="App.runAgent('${analysis.id}')">Proceed with Agent &rarr;</button>
      <button class="btn btn-secondary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Modify</button>
      <button class="btn btn-ghost"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Manual mode</button>
    </div>`;

    html += `</div></div>`; // end card and message wrapper

    DOM.messagesArea.insertAdjacentHTML('beforeend', html);
  }

  function runAgent(id) {
    const btn = document.querySelector('.btn-primary');
    if (btn) btn.innerHTML = 'Running...';
    // Simplified running state for prototype
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  return { init, runAgent };
})();

document.addEventListener('DOMContentLoaded', App.init);

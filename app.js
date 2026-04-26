/**
 * App.js — UI Controller for Agent Pre-Flight System
 * Handles: rendering, user interactions, execution simulation, workflows
 */

(function () {
  'use strict';

  // ===== DOM REFS =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const DOM = {
    app: $('#app'),
    sidebar: $('#sidebar'),
    messagesArea: $('#messages-area'),
    welcomeScreen: $('#welcome-screen'),
    quickPrompts: $('#quick-prompts'),
    promptInput: $('#prompt-input'),
    btnSubmit: $('#btn-submit'),
    btnToggleSidebar: $('#btn-toggle-sidebar'),
    btnNewSession: $('#btn-new-session'),
    btnClear: $('#btn-clear'),
    sessionHistory: $('#session-history'),
    sessionTitle: $('#session-title'),
    modeBadge: $('#mode-badge'),
    charCount: $('#char-count'),
    contextBar: $('#input-context-bar'),
    contextLabel: $('#context-label'),
    btnClearContext: $('#btn-clear-context'),
    statSessions: $('#stat-sessions'),
    statTokens: $('#stat-tokens'),
    statWorkflows: $('#stat-workflows'),
    workflowModal: $('#workflow-modal'),
    workflowName: $('#workflow-name'),
    workflowDesc: $('#workflow-desc'),
    workflowTags: $('#workflow-tags'),
    btnSaveWorkflow: $('#btn-save-workflow'),
    btnCancelWorkflow: $('#btn-cancel-workflow'),
    btnCloseModal: $('#btn-close-modal')
  };

  // ===== STATE =====
  let currentAnalysis = null;
  let executionState = null;
  let isExecuting = false;

  // ===== QUICK PROMPTS =====
  const QUICK_PROMPTS = [
    { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>', label: 'Debug auth flow', prompt: 'Fix the authentication bug in our login flow — users are getting logged out after 5 minutes' },
    { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>', label: 'Build REST API', prompt: 'Build a REST API with user registration, login, and profile management using Node.js and Express' },
    { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', label: 'Code review', prompt: 'Review this codebase for security vulnerabilities, performance bottlenecks, and code quality issues' },
    { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>', label: 'Refactor module', prompt: 'Refactor the payment processing module to use the strategy pattern and add support for Stripe and PayPal' },
    { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', label: 'Quick question', prompt: 'What is the difference between useMemo and useCallback in React?' },
    { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>', label: 'Research frameworks', prompt: 'Compare Next.js, Remix, and Astro for building a content-heavy marketing site with dynamic dashboards' }
  ];

  // ===== INIT =====
  function init() {
    renderQuickPrompts();
    bindEvents();
    updateStats();
  }

  function renderQuickPrompts() {
    DOM.quickPrompts.innerHTML = QUICK_PROMPTS.map(qp =>
      `<button class="quick-prompt" data-prompt="${qp.prompt.replace(/"/g, '&quot;')}">${qp.icon}<span>${qp.label}</span></button>`
    ).join('');
  }

  // ===== EVENT BINDING =====
  function bindEvents() {
    // Submit
    DOM.btnSubmit.addEventListener('click', handleSubmit);
    DOM.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    });
    DOM.promptInput.addEventListener('input', () => {
      DOM.charCount.textContent = DOM.promptInput.value.length;
      autoResize(DOM.promptInput);
    });

    // Quick prompts
    DOM.quickPrompts.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-prompt');
      if (btn) {
        DOM.promptInput.value = btn.dataset.prompt;
        DOM.charCount.textContent = DOM.promptInput.value.length;
        autoResize(DOM.promptInput);
        DOM.promptInput.focus();
      }
    });

    // Sidebar
    DOM.btnToggleSidebar.addEventListener('click', () => DOM.sidebar.classList.toggle('collapsed'));
    DOM.btnNewSession.addEventListener('click', startNewSession);
    DOM.btnClear.addEventListener('click', startNewSession);

    // Context bar
    DOM.btnClearContext.addEventListener('click', () => DOM.contextBar.classList.add('hidden'));

    // Modal
    DOM.btnCloseModal.addEventListener('click', closeModal);
    DOM.btnCancelWorkflow.addEventListener('click', closeModal);
    DOM.btnSaveWorkflow.addEventListener('click', handleSaveWorkflow);
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  // ===== SUBMIT HANDLER =====
  function handleSubmit() {
    const prompt = DOM.promptInput.value.trim();
    if (!prompt || isExecuting) return;

    // Hide welcome
    if (DOM.welcomeScreen) DOM.welcomeScreen.style.display = 'none';

    // Add user message
    addMessage('user', prompt);
    DOM.promptInput.value = '';
    DOM.charCount.textContent = '0';
    DOM.promptInput.style.height = 'auto';

    // Set mode
    setMode('analyzing', 'Analyzing...');

    // Show analysis loader
    const loaderId = showAnalysisLoader();

    // Simulate analysis delay
    simulateAnalysisSteps(loaderId, () => {
      // Run engine
      currentAnalysis = PreFlightEngine.analyze(prompt);
      removeElement(loaderId);
      setMode('preflight', 'Pre-Flight');
      renderPreFlightCard(currentAnalysis);
    });
  }

  // ===== ANALYSIS LOADER =====
  function showAnalysisLoader() {
    const id = 'loader-' + Date.now();
    const html = `
      <div id="${id}" class="analysis-loader">
        <div class="loader-ring"></div>
        <div class="loader-text">Analyzing your task...</div>
        <div class="loader-steps">
          <div class="loader-step" data-step="classify"><div class="loader-step-dot"></div>Classifying task type</div>
          <div class="loader-step" data-step="complexity"><div class="loader-step-dot"></div>Estimating complexity</div>
          <div class="loader-step" data-step="constraints"><div class="loader-step-dot"></div>Extracting constraints</div>
          <div class="loader-step" data-step="plan"><div class="loader-step-dot"></div>Building execution plan</div>
          <div class="loader-step" data-step="decision"><div class="loader-step-dot"></div>Generating recommendation</div>
        </div>
      </div>`;
    DOM.messagesArea.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
    return id;
  }

  function simulateAnalysisSteps(loaderId, onComplete) {
    const steps = ['classify', 'complexity', 'constraints', 'plan', 'decision'];
    let i = 0;
    const container = document.getElementById(loaderId);
    if (!container) return onComplete();

    const interval = setInterval(() => {
      if (i > 0) {
        const prev = container.querySelector(`[data-step="${steps[i - 1]}"]`);
        if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
      }
      if (i < steps.length) {
        const curr = container.querySelector(`[data-step="${steps[i]}"]`);
        if (curr) curr.classList.add('active');
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 300);
      }
    }, 400);
  }

  // ===== PRE-FLIGHT CARD RENDERER =====
  function renderPreFlightCard(analysis) {
    const { complexity, constraints, executionPlan, recommendation, patternDetected } = analysis;
    const riskClass = `risk-${complexity.riskLevel}`;
    const recClass = recommendation.mode;

    let html = `<div class="preflight-card">`;

    // Header
    html += `<div class="preflight-header">
      <div class="preflight-title"><span class="icon">${analysis.taskIcon}</span> PRE-FLIGHT CHECK</div>
      <div class="preflight-confidence">${Math.round(recommendation.confidence * 100)}% confidence</div>
    </div>`;

    // Body
    html += `<div class="preflight-body">`;

    // Meta grid
    html += `<div class="preflight-meta">
      <div class="meta-item"><div class="meta-label">TASK TYPE</div><div class="meta-value">${analysis.taskLabel}</div></div>
      <div class="meta-item"><div class="meta-label">COMPLEXITY</div><div class="meta-value">${capitalize(complexity.contextLoad)} (${complexity.stepCount} steps)</div></div>
      <div class="meta-item"><div class="meta-label">EST. TOKENS</div><div class="meta-value">~${formatNumber(complexity.estimatedTokens)}</div></div>
      <div class="meta-item"><div class="meta-label">RISK LEVEL</div><div class="meta-value ${riskClass}">${capitalize(complexity.riskLevel)}</div></div>
    </div>`;

    // Execution Plan
    html += `<div class="preflight-section">
      <div class="preflight-section-title">EXECUTION PLAN</div>
      <div class="step-list">`;
    executionPlan.steps.forEach(step => {
      const cpClass = step.checkpoint ? ' checkpoint' : '';
      html += `<div class="step-item${cpClass}" data-step-id="${step.id}">
        <div class="step-number">${step.id}</div>
        <div class="step-info">
          <div class="step-action">${step.action}</div>
          <div class="step-meta">
            <span>~${formatNumber(step.tokens)} tokens</span>
            <span>Risk: ${capitalize(step.risk)}</span>
          </div>
        </div>
        ${step.checkpoint ? '<span class="step-checkpoint-badge">⏸ USER APPROVAL REQUIRED</span>' : ''}
      </div>`;
    });
    html += `</div></div>`;

    // Constraints
    if (constraints.length > 0) {
      html += `<div class="preflight-section">
        <div class="preflight-section-title">CONSTRAINTS DETECTED</div>
        <div class="constraint-list">`;
      constraints.forEach(c => {
        const isBoundary = c.type === 'boundary';
        const icon = isBoundary ? '🛑' : (c.type === 'explicit' ? '🔒' : c.type === 'implicit' ? '💡' : '⚙️');
        const cClass = isBoundary ? 'constraint-item boundary' : 'constraint-item';
        let ruleHtml = isBoundary ? `<strong>AGENT BOUNDARY:</strong> ${c.rule}` : c.rule;
        html += `<div class="${cClass}"><span class="constraint-icon">${icon}</span><div>${ruleHtml}</div></div>`;
      });
      const hasBoundaries = constraints.some(c => c.type === 'boundary');
      if (hasBoundaries) {
        html += `<div class="constraint-item boundary" style="margin-top: 6px; font-size: 11.5px; opacity: 0.9"><span class="constraint-icon">🪄</span><div><em>Suggestion: To enforce these boundaries reliably across sessions, consider saving them as a <strong>Skill</strong> or <strong>Token Optimization Rule</strong>.</em></div></div>`;
      }
      html += `</div></div>`;
    }

    // Recommendation
    html += `<div class="recommendation-box ${recClass}">
      <div class="recommendation-icon">${recommendation.mode === 'agent' ? '🤖' : '📝'}</div>
      <div class="recommendation-text">
        <h3>${recommendation.mode === 'agent' ? '✅ Agent Mode Recommended' : '📝 Manual Mode Recommended'}</h3>
        <p>${recommendation.reasoning}</p>
      </div>
    </div>`;

    html += `</div>`; // end body

    // Action Buttons
    html += `<div class="preflight-actions">
      <button class="btn btn-primary" id="btn-proceed">▶ Proceed with Agent</button>
      <button class="btn btn-secondary" id="btn-modify">✏️ Modify Instructions</button>
      <button class="btn btn-ghost" id="btn-manual">📝 Use Manual Mode</button>
    </div>`;

    html += `</div>`; // end card

    // Pattern detection (Learning Layer)
    if (patternDetected.detected) {
      html += `<div class="workflow-suggestion">
        <div class="workflow-suggestion-title">💡 Pattern Detected</div>
        <div class="workflow-suggestion-desc">${patternDetected.message}</div>
        <button class="btn btn-save" id="btn-suggest-workflow">Save as Workflow Template</button>
      </div>`;
    }

    DOM.messagesArea.insertAdjacentHTML('beforeend', html);
    scrollToBottom();

    // Bind card actions
    document.getElementById('btn-proceed')?.addEventListener('click', () => startExecution(analysis));
    document.getElementById('btn-modify')?.addEventListener('click', () => handleModify(analysis));
    document.getElementById('btn-manual')?.addEventListener('click', () => handleManual(analysis));
    document.getElementById('btn-suggest-workflow')?.addEventListener('click', () => openWorkflowModal());
  }

  // ===== EXECUTION SIMULATION (Phase 4) =====
  function startExecution(analysis) {
    isExecuting = true;
    setMode('executing', 'Executing...');

    const steps = analysis.executionPlan.steps;
    executionState = {
      taskId: analysis.id,
      currentStep: 0,
      status: 'running',
      completedSteps: [],
      tokensUsed: 0,
      totalTokens: analysis.complexity.estimatedTokens
    };

    // Render execution stream
    let html = `<div class="execution-stream" id="exec-stream">
      <div class="execution-header">
        <div class="execution-title">⚡ AGENT EXECUTION</div>
        <div class="execution-progress">
          <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
          <span class="progress-label" id="progress-label">0/${steps.length}</span>
        </div>
      </div>
      <div class="execution-body">
        <div class="execution-log" id="exec-log"></div>
      </div>
      <div class="execution-footer">
        <div class="token-tracker">
          <div class="token-item">Used: <span id="tokens-used">0</span></div>
          <div class="token-item">Budget: <span id="tokens-budget">${formatNumber(analysis.complexity.estimatedTokens)}</span></div>
        </div>
        <button class="btn btn-danger btn-sm" id="btn-abort" style="padding:6px 14px;font-size:11px">⬛ Abort</button>
      </div>
    </div>`;

    DOM.messagesArea.insertAdjacentHTML('beforeend', html);
    scrollToBottom();

    document.getElementById('btn-abort')?.addEventListener('click', () => abortExecution());

    // Execute steps sequentially
    executeStepByStep(steps, 0);
  }

  function executeStepByStep(steps, index) {
    if (!isExecuting || index >= steps.length) {
      if (isExecuting) completeExecution();
      return;
    }

    const step = steps[index];
    executionState.currentStep = index + 1;

    // Update step in preflight card
    const stepEl = document.querySelector(`.step-item[data-step-id="${step.id}"]`);
    if (stepEl) stepEl.classList.add('active');

    // Add log entry
    addLogEntry('info', `Step ${step.id}: ${step.action}`, 'Starting...');

    // Simulate work
    const duration = 1000 + Math.random() * 1500;
    setTimeout(() => {
      if (!isExecuting) return;

      // Mark complete
      if (stepEl) { stepEl.classList.remove('active'); stepEl.classList.add('completed'); }
      executionState.completedSteps.push(step.id);
      executionState.tokensUsed += step.tokens;

      // Update progress
      const pct = Math.round((executionState.completedSteps.length / steps.length) * 100);
      const fill = document.getElementById('progress-fill');
      const label = document.getElementById('progress-label');
      const tokUsed = document.getElementById('tokens-used');
      if (fill) fill.style.width = pct + '%';
      if (label) label.textContent = `${executionState.completedSteps.length}/${steps.length}`;
      if (tokUsed) tokUsed.textContent = formatNumber(executionState.tokensUsed);

      addLogEntry('success', `Step ${step.id} complete`, `${step.action} — ${formatNumber(step.tokens)} tokens`);

      // Checkpoint?
      if (step.checkpoint && index < steps.length - 1) {
        setMode('paused', 'Checkpoint');
        showCheckpoint(step, () => {
          setMode('executing', 'Executing...');
          executeStepByStep(steps, index + 1);
        });
      } else {
        executeStepByStep(steps, index + 1);
      }
    }, duration);
  }

  function showCheckpoint(step, onContinue) {
    const log = document.getElementById('exec-log');
    if (!log) return onContinue();

    const html = `<div class="execution-checkpoint">
      <div class="checkpoint-title">⏸ CHECKPOINT — Step ${step.id}</div>
      <div class="checkpoint-desc">Paused before next step. Review progress and decide how to proceed.</div>
      <div class="checkpoint-actions">
        <button class="btn btn-primary btn-sm checkpoint-continue" style="padding:8px 16px;font-size:12px">▶ Continue</button>
        <button class="btn btn-ghost btn-sm checkpoint-abort" style="padding:8px 16px;font-size:12px">⬛ Abort</button>
      </div>
    </div>`;
    log.insertAdjacentHTML('beforeend', html);
    scrollToBottom();

    log.querySelector('.checkpoint-continue')?.addEventListener('click', function () {
      this.closest('.execution-checkpoint').remove();
      onContinue();
    });
    log.querySelector('.checkpoint-abort')?.addEventListener('click', () => abortExecution());
  }

  function completeExecution() {
    isExecuting = false;
    setMode('complete', 'Complete');
    addLogEntry('success', 'Execution complete', `All ${executionState.completedSteps.length} steps finished. ${formatNumber(executionState.tokensUsed)} tokens used.`);

    // Summary message
    addMessage('system', `✅ **Task completed successfully!**\n\nAll ${executionState.completedSteps.length} steps executed. Total tokens: ~${formatNumber(executionState.tokensUsed)}.`);

    // Save as session
    addSessionToHistory(currentAnalysis);
    updateStats();
    scrollToBottom();
  }

  function abortExecution() {
    isExecuting = false;
    setMode('idle', 'Aborted');
    addLogEntry('error', 'Execution aborted', 'Stopped by user.');
    addMessage('system', `⬛ Execution aborted at step ${executionState.currentStep}. ${formatNumber(executionState.tokensUsed)} tokens used so far.`);
    updateStats();
  }

  // ===== MODIFY & MANUAL HANDLERS =====
  function handleModify(analysis) {
    DOM.contextBar.classList.remove('hidden');
    DOM.contextLabel.textContent = `✏️ Modifying: ${analysis.taskLabel} plan`;
    DOM.promptInput.placeholder = 'Add constraints or modify the plan...';
    DOM.promptInput.focus();
    addMessage('system', 'You can now add constraints or modify the plan. Type your modifications and submit again.\n\nExamples:\n- "Don\'t modify test files"\n- "Use TypeScript only"\n- "Add a step for documentation"');
    scrollToBottom();
  }

  function handleManual(analysis) {
    setMode('manual', 'Manual Mode');
    addMessage('system', `📝 Switched to **Manual Mode**.\n\nYour task was classified as: **${analysis.taskLabel}**\nEstimated tokens: ~${formatNumber(analysis.complexity.estimatedTokens)}\n\nYou can now interact with Claude directly. The pre-flight analysis above is for your reference.`);
    scrollToBottom();
  }

  // ===== UI HELPERS =====
  function addMessage(role, content) {
    const isUser = role === 'user';
    const avatar = isUser
      ? '<div class="message-avatar avatar-user">U</div>'
      : '<div class="message-avatar avatar-system"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.9723 1C12.352 1 12.6865 1.25883 12.8256 1.63158L13.8055 4.26129L15.3409 1.77663C15.5492 1.44026 15.9392 1.29173 16.3197 1.40428C16.7003 1.51684 16.969 1.86013 16.9943 2.26615L17.159 4.90806L19.5397 5.06456C19.9234 5.08985 20.2483 5.37059 20.3551 5.76997C20.4619 6.16935 20.3204 6.58784 19.9996 6.82025L17.9258 8.32289L21.2464 10.0211C21.6025 10.2033 21.8341 10.5694 21.8285 10.9702C21.8229 11.3711 21.5807 11.7301 21.2201 11.898L18.7297 13.0489L20.8921 15.5401C21.1352 15.8202 21.2001 16.2163 21.0543 16.5645C20.9086 16.9126 20.5824 17.1422 20.2057 17.1428L17.1852 17.1472L17.9042 19.3804C18.026 19.7582 17.8932 20.176 17.5714 20.4287C17.2496 20.6814 16.8049 20.7169 16.4491 20.5173L13.9877 19.1359L13.1259 21.4646C12.9859 21.8427 12.6288 22.0963 12.2215 22.1066C11.8142 22.117 11.4429 21.8817 11.2828 21.5103L10.0827 18.7262L7.86872 20.7818C7.57685 21.0527 7.14811 21.129 6.78265 20.9749C6.41718 20.8207 6.18349 20.4651 6.19069 20.076L6.24151 17.332L3.92135 17.8812C3.52845 17.9742 3.12204 17.7818 2.92344 17.4086C2.72483 17.0354 2.78453 16.5829 3.06995 16.2974L5.27584 14.0906L2.40879 12.9237C2.02506 12.7675 1.77651 12.3995 1.77196 11.9839C1.76741 11.5683 2.00762 11.1963 2.38794 11.0305L5.26388 9.77663L2.35905 8.24375C1.98634 8.04712 1.76182 7.64417 1.8023 7.22415C1.84278 6.80413 2.13845 6.44754 2.54848 6.3218L5.51862 5.41113L4.54226 1.64953C4.4373 1.24523 4.60699 0.819717 4.96541 0.58784C5.32382 0.355963 5.80104 0.366304 6.15549 0.613619L8.49071 2.24249L9.28482 0.718698C9.46733 0.368685 9.83358 0.136893 10.2335 0.118228C10.6335 0.0995642 11.026 0.30138 11.2505 0.640243L11.9723 1Z" fill="currentColor"/></svg></div>';
    const sender = isUser ? 'You' : 'Pre-Flight System';

    // Simple markdown-like formatting
    let formatted = content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    const html = `<div class="message">
      ${avatar}
      <div class="message-body">
        <div class="message-sender">${sender}</div>
        <div class="message-content">${formatted}</div>
      </div>
    </div>`;
    DOM.messagesArea.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
  }

  function addLogEntry(type, title, detail) {
    const log = document.getElementById('exec-log');
    if (!log) return;
    const icons = { success: '✓', info: '●', warn: '⚠', error: '✗', pause: '⏸' };
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const html = `<div class="log-entry">
      <span class="log-timestamp">${time}</span>
      <span class="log-icon ${type}">${icons[type] || '●'}</span>
      <span class="log-message"><strong>${title}</strong> — ${detail}</span>
    </div>`;
    log.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
  }

  function setMode(mode, text) {
    DOM.modeBadge.className = `mode-badge mode-${mode}`;
    DOM.modeBadge.textContent = text;
    if (currentAnalysis) DOM.sessionTitle.textContent = currentAnalysis.taskLabel;
  }

  function removeElement(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      DOM.messagesArea.scrollTop = DOM.messagesArea.scrollHeight;
    });
  }

  function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
  function formatNumber(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString(); }

  // ===== SESSION MANAGEMENT =====
  function startNewSession() {
    currentAnalysis = null;
    executionState = null;
    isExecuting = false;
    DOM.messagesArea.innerHTML = '';
    DOM.welcomeScreen.style.display = '';
    DOM.messagesArea.appendChild(DOM.welcomeScreen);
    setMode('idle', 'Idle');
    DOM.sessionTitle.textContent = 'New Session';
    DOM.contextBar.classList.add('hidden');
    DOM.promptInput.placeholder = 'Describe your task...';
    DOM.promptInput.focus();
  }

  function addSessionToHistory(analysis) {
    if (!analysis) return;
    const html = `<div class="session-item" title="${analysis.prompt.substring(0, 80)}">
      <span class="dot" style="background:${analysis.taskColor}"></span>
      <span>${analysis.taskIcon} ${analysis.taskLabel}</span>
    </div>`;
    DOM.sessionHistory.insertAdjacentHTML('afterbegin', html);
  }

  // ===== WORKFLOW MODAL =====
  function openWorkflowModal() {
    DOM.workflowModal.classList.remove('hidden');
    DOM.workflowName.focus();
  }

  function closeModal() {
    DOM.workflowModal.classList.add('hidden');
    DOM.workflowName.value = '';
    DOM.workflowDesc.value = '';
    DOM.workflowTags.value = '';
  }

  function handleSaveWorkflow() {
    const name = DOM.workflowName.value.trim();
    if (!name || !currentAnalysis) return;
    PreFlightEngine.LearningLayer.saveWorkflow(
      name,
      DOM.workflowDesc.value.trim(),
      DOM.workflowTags.value,
      currentAnalysis
    );
    closeModal();
    addMessage('system', `✅ Workflow template **"${name}"** saved! You can reuse it in future sessions.`);
    updateStats();
  }

  // ===== STATS =====
  function updateStats() {
    const stats = PreFlightEngine.LearningLayer.getStats();
    DOM.statSessions.textContent = stats.sessions;
    DOM.statTokens.textContent = formatNumber(stats.totalTokens);
    DOM.statWorkflows.textContent = stats.workflows;
  }

  // ===== BOOT =====
  init();
})();

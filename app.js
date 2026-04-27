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
  let promptHistory = [];
  let acceptedSkills = new Set();
  let ignoredSkills = new Set();
  let runtimeIntervention = null;
  let confidenceTrend = [];
  let activeMode = 'chat';

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

      const acceptBtn = e.target.closest('.btn-accept-skill');
      if (acceptBtn) {
        acceptSkill(acceptBtn.dataset.ref);
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
    
    // Add loading state (Agentic RAG Status)
    DOM.messagesArea.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="ar-dot" style="width:12px; height:12px; background:var(--accent-orange); border-radius:50%; margin:0 auto 16px; animation: pulse 1.5s infinite;"></div>
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">Claude Agent Orchestration Active</div>
        <div id="loader-status" style="font-size: 14px; font-weight: 500;">Performing RAG retrieval from Skill Bank...</div>
    </div>`;
    
    // Simulate RAG steps in loader
    const loaderStatus = document.getElementById('loader-status');
    setTimeout(() => { if(loaderStatus) loaderStatus.innerText = "Analyzing intent vectors..."; }, 800);
    setTimeout(() => { if(loaderStatus) loaderStatus.innerText = "Matching mission to specialized agents..."; }, 1600);
    setTimeout(() => { if(loaderStatus) loaderStatus.innerText = "Building strategic execution plan..."; }, 2400);
    
    try {
      currentAnalysis = await PreFlightEngine.analyze(prompt, promptHistory, Array.from(ignoredSkills));
      
      // Add to history for next time
      promptHistory.push(prompt);
      if (promptHistory.length > 5) promptHistory.shift();

      DOM.messagesArea.innerHTML = '';
      renderPreFlightCard(currentAnalysis);
    } catch (err) {
      console.error("Critical Analysis Error:", err);
      DOM.messagesArea.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #D96C51;">
          <div style="font-size: 24px; margin-bottom: 16px;">⚠️</div>
          <div style="font-weight: 600;">Analysis Engine Encountered an Error</div>
          <div style="font-size: 13px; margin-top: 8px; opacity: 0.8;">The planner had trouble orchestrating this mission. Please try a different prompt.</div>
          <button onclick="App.reset()" style="margin-top: 20px; padding: 10px 20px; background: var(--accent-orange); color: white; border: none; border-radius: 8px; cursor: pointer;">Reset Session</button>
        </div>
      `;
    } finally {
      DOM.promptInput.value = '';
      autoResize(DOM.promptInput);
      scrollToBottom();
    }
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

  function toLevel(value) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return 'Medium';
    if (numeric >= 70) return 'High';
    if (numeric >= 40) return 'Medium';
    return 'Low';
  }

  function driftToLevel(score) {
    if (score >= 0.6) return 'High';
    if (score >= 0.45) return 'Medium';
    return 'Low';
  }

  function renderModeTabs(mode = 'chat') {
    const chatActive = mode === 'chat';
    const codeActive = mode === 'code';
    return `
      <div style="display:inline-flex; background:#EBE8E0; border-radius:10px; padding:4px; gap:4px; margin-bottom:12px;">
        <span style="font-size:12px; font-weight:700; letter-spacing:0.3px; padding:6px 10px; border-radius:7px; color:${chatActive ? '#FFFFFF' : '#6B6863'}; background:${chatActive ? '#2D2A26' : 'transparent'};">CHAT</span>
        <span style="font-size:12px; font-weight:700; letter-spacing:0.3px; padding:6px 10px; border-radius:7px; color:${codeActive ? '#FFFFFF' : '#6B6863'}; background:${codeActive ? '#2D2A26' : 'transparent'};">CLAUDE CODE</span>
      </div>
    `;
  }

  function buildManualResponse(analysis) {
    const missionText = analysis?.mission || lastSubmittedPrompt;
    const topConstraints = (analysis?.constraints || []).slice(0, 2).map(c => c.rule);
    if (topConstraints.length > 0) {
      return `Here is a direct chat response for: "${missionText}". I will follow your constraints: ${topConstraints.join(' | ')}.`;
    }
    return `Here is a direct chat response for: "${missionText}". I will keep this in simple prompt mode without agent orchestration.`;
  }

  function renderPreFlightCard(analysis) {
    const { mission, complexity, constraints, executionPlan, recommendation, optimizationProfile, systemLimits, agentSetupQuestions } = analysis;
    const confidenceRaw = recommendation.confidence > 1 ? recommendation.confidence : Math.round(recommendation.confidence * 100);
    const confidenceLevel = toLevel(confidenceRaw);
    const decisionText = recommendation.mode === 'agent' ? 'Use Claude Agent' : 'Stay in Manual Prompting';
    const shortWhy = recommendation.reasoning || 'Best available route based on intent and constraints.';
    const constraintChips = constraints.slice(0, 4);
    const topSkillSuggestion = analysis.suggestedSkills && analysis.suggestedSkills.length > 0 ? analysis.suggestedSkills[0] : null;

    let html = `<div class="message" style="flex-direction: column; align-items: center; gap: 8px; width: 100%;">`;
    html += `
      <div id="agent-card-container" style="width:100%; max-width:820px; display:flex; flex-direction:column; align-items:flex-start;">
        ${renderModeTabs('chat')}
        <div class="mission-dashboard" style="width: 100%; background: white; border: 1px solid var(--border-light); border-radius: 20px; overflow: hidden; box-shadow: 0 8px 28px rgba(0,0,0,0.06); margin-bottom: 36px;">
        <div style="background: #F9F9F8; padding: 20px 24px; border-bottom: 1px solid var(--border-light);">
          <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 6px;">Claude Agent Compass</div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: var(--text-main); font-family: var(--font-serif); line-height: 1.35;">${mission}</h2>
        </div>

        <div style="padding: 24px;">
          <div style="border: 1px solid var(--border-light); border-radius: 14px; padding: 16px; background: #FCFCFB; margin-bottom: 14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.6px; text-transform: uppercase;">Recommendation</div>
              <div style="font-size:12px; color:#6B6863;">Confidence ${confidenceLevel}</div>
            </div>
            <div style="font-size: 18px; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">${decisionText}</div>
            <div style="font-size: 13px; color: var(--text-muted); line-height: 1.45;">${shortWhy}</div>
            <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <span style="font-size:11px; background:#F3F1EB; color:#4B4A46; border:1px solid #E4E1D8; padding:4px 8px; border-radius:8px;">Risk: ${capitalize(complexity.riskLevel)}</span>
              <span style="font-size:11px; background:#F3F1EB; color:#4B4A46; border:1px solid #E4E1D8; padding:4px 8px; border-radius:8px;">Task: ${analysis.taskLabel}</span>
              <span style="font-size:11px; background:#F3F1EB; color:#4B4A46; border:1px solid #E4E1D8; padding:4px 8px; border-radius:8px;">Steps: ${executionPlan.totalSteps || executionPlan.steps.length}</span>
              ${acceptedSkills.size > 0 ? `<span style="font-size:11px; background:#FFF0EC; color:var(--accent-orange); border:1px solid #F5C9BC; padding:4px 10px; border-radius:8px; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Skill optimized</span>` : ''}
            </div>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 8px;">Detected Constraints</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${constraintChips.length > 0 ? constraintChips.map(c => `
                <span style="font-size:12px; background:#EEF4F0; color:#2E694B; border:1px solid #D1E7DD; padding:5px 10px; border-radius:999px;">${c.rule}</span>
              `).join('') : '<span style="font-size:12px; color:var(--text-muted);">No explicit constraints detected.</span>'}
              ${systemLimits.slice(0, 2).map(limit => `
                <span style="font-size:12px; background:#FFF5F0; color:#A34B36; border:1px solid #F0D3C8; padding:5px 10px; border-radius:999px;">System: ${limit}</span>
              `).join('')}
            </div>
          </div>

          ${topSkillSuggestion ? `
            <div style="margin-bottom: 16px; border: 1px solid #F0D3C8; background: #FFF8F5; border-radius: 12px; padding: 14px;">
              <div style="font-size: 11px; font-weight: 700; color: #A34B36; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 6px;">Skill Opportunity</div>
              <div style="font-size: 13px; color: #5C3A31; margin-bottom: 12px;">Auto-suggested: <strong>${topSkillSuggestion.name}</strong> — saves tokens and reduces retries on similar tasks.</div>
              <div style="display:flex; gap:8px; align-items:center;">
                <button class="btn btn-save-skill" style="padding:7px 14px; font-size:12px; font-weight:600; border:none; color:white; background:var(--accent-orange); border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:5px;"
                  data-name="${topSkillSuggestion.name.replace(/"/g, '&quot;')}"
                  data-pattern="${topSkillSuggestion.pattern.replace(/"/g, '&quot;')}"
                  data-ref="${topSkillSuggestion.ref.replace(/"/g, '&quot;')}">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Skill
                </button>
                <button class="btn btn-edit-skill" style="padding:7px 14px; font-size:12px; font-weight:600; border:1px solid var(--border-light); color:var(--text-main); background:white; border-radius:8px; cursor:pointer;"
                  data-ref="${topSkillSuggestion.ref.replace(/"/g, '&quot;')}">
                  Edit
                </button>
                <button class="btn btn-discard-skill" style="padding:7px 14px; font-size:12px; font-weight:600; border:1px solid var(--border-light); color:var(--text-muted); background:white; border-radius:8px; cursor:pointer;"
                  data-ref="${topSkillSuggestion.ref.replace(/"/g, '&quot;')}">
                  Discard
                </button>
              </div>
            </div>
          ` : ''}

          ${recommendation.mode === 'agent' ? `
            <div style="margin-bottom: 16px; border: 1px solid #D1E7DD; background: #F4F9F6; border-radius: 12px; padding: 12px;">
              <div style="font-size: 11px; font-weight: 700; color: #2E694B; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 6px;">Agent Created</div>
              <div style="font-size: 13px; color: #365748; margin-bottom: 10px;">I detected an agentic workflow from your prompt. Confirm these setup details to optimize execution and reduce blind spots.</div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${(agentSetupQuestions || []).map(item => `
                  <div style="background:white; border:1px solid #E3EFE8; border-radius:8px; padding:8px 10px;">
                    <div style="font-size:12px; color:#4B5563; margin-bottom:2px;"><strong>Q:</strong> ${item.question}</div>
                    <div style="font-size:13px; color:#1F2937;"><strong>A:</strong> ${item.answer}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <details style="border: 1px solid var(--border-light); border-radius: 12px; padding: 12px; background: #FBFBFB;">
            <summary style="cursor: pointer; list-style: none; font-size: 12px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.4px; text-transform: uppercase;">Show details</summary>
            <div style="margin-top: 10px;">
              <div style="font-size: 12px; color: #4B5563; margin-bottom: 10px;">Checkpointing is auto-managed by Claude Agent Compass based on risk.</div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${executionPlan.steps.map(step => `
                  <div style="padding: 8px 10px; border:1px solid #ECE9E1; border-radius: 8px; background: white;">
                    <div style="display:flex; justify-content:space-between; gap:8px;">
                      <span style="font-size:13px; font-weight:600; color:#2D2A26;">${step.id}. ${step.action}</span>
                      ${step.checkpoint ? '<span style="font-size:10px; color:#A37B30; background:#FFF5DD; padding:2px 6px; border-radius:6px;">CHECKPOINT</span>' : ''}
                    </div>
                    <div style="font-size:12px; color:#6B6863; margin-top:2px;">${step.desc}</div>
                  </div>
                `).join('')}
              </div>
              <div style="margin-top: 10px; display:flex; flex-direction:column; gap:10px;">
                <div>
                  <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; font-weight:700; letter-spacing:0.4px; color:#6B6863; margin-bottom:4px; text-transform:uppercase;">
                    <span>Tokens</span>
                    <span>${toLevel(optimizationProfile.tokens)}</span>
                  </div>
                  <div style="height:6px; background:#ECE9E1; border-radius:999px; overflow:hidden;">
                    <div style="height:100%; width:${optimizationProfile.tokens}%; background:#D96C51; border-radius:999px;"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; font-weight:700; letter-spacing:0.4px; color:#6B6863; margin-bottom:4px; text-transform:uppercase;">
                    <span>Quality</span>
                    <span>${toLevel(optimizationProfile.quality)}</span>
                  </div>
                  <div style="height:6px; background:#ECE9E1; border-radius:999px; overflow:hidden;">
                    <div style="height:100%; width:${optimizationProfile.quality}%; background:#3D8B63; border-radius:999px;"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; font-weight:700; letter-spacing:0.4px; color:#6B6863; margin-bottom:4px; text-transform:uppercase;">
                    <span>Latency</span>
                    <span>${toLevel(optimizationProfile.latency)}</span>
                  </div>
                  <div style="height:6px; background:#ECE9E1; border-radius:999px; overflow:hidden;">
                    <div style="height:100%; width:${optimizationProfile.latency}%; background:#ECA335; border-radius:999px;"></div>
                  </div>
                </div>
              </div>
            </div>
          </details>

          <div style="display: flex; justify-content: center; gap: 12px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border-light);">
            <button onclick="App.runAgent()" style="padding: 12px 26px; background: var(--accent-orange); color: white; border: none; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer;">Proceed with Claude Agent</button>
            <button onclick="App.modifyPrompt()" style="padding: 12px 20px; background: white; border: 1px solid var(--border-light); border-radius: 12px; font-weight: 600; font-size: 14px; color: var(--text-main); cursor: pointer;">Modify Prompt</button>
            <button onclick="App.runManual()" style="padding: 12px 20px; background: white; border: 1px solid var(--border-light); border-radius: 12px; font-weight: 600; font-size: 14px; color: var(--text-main); cursor: pointer;">Stay Manual</button>
          </div>
        </div>
      </div>
      </div>
    `;

    html += `</div>`;
    DOM.messagesArea.insertAdjacentHTML('beforeend', html);
  }

  function renderAgentRunningCard(analysis, status = 'running') {
    let html = `<div class="agent-running-card" style="width: 100%; background: white; border: 1px solid var(--border-light); border-radius: 20px; box-shadow: 0 8px 28px rgba(0,0,0,0.06); position:relative; overflow: hidden; color: var(--text-main); margin-bottom: 36px;">`;
    const title = status === 'running'
        ? `<div class="ar-dot" style="width:8px; height:8px; background:var(--accent-orange); border-radius:50%; margin-right:12px; animation: pulse 1.5s infinite;"></div> <span style="font-size:18px; font-family:var(--font-serif); font-weight:500; color:var(--text-main);">Agent running</span>`
        : `<div style="color:var(--accent-orange); display:inline-block; margin-right:12px; font-size:12px; opacity:0.8;">●</div> <span style="font-size:18px; font-family:var(--font-serif); font-weight:500; color:var(--text-main);">Execution complete</span>`;

    html += `<div class="ar-header" style="background: #F9F9F8; padding: 20px 24px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light);">
      <div style="display:flex; align-items:center;">${title}</div>
      <button class="btn-ghost" onclick="App.reset()" style="font-size:12px; padding:6px 12px; color:var(--text-muted); display:flex; gap:6px; align-items:center; font-weight:500;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.43-11.44L2.5 8"></path></svg> New task</button>
    </div>`;

    // Removed intelligence nudge banner as requested to prioritize clean execution visibility
    // The optimization is already reflected in the step-level skill badges.

    html += `<div class="ar-content-inner" style="padding: 24px; display:flex; flex-direction:column; gap:16px;">`;
    html += `<div id="runtime-intervention-zone"></div>`;
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
        extraHtml = `<div style="margin-top: 10px; margin-bottom: 12px; font-size: 12px; color: #8A6115; background: rgba(236, 163, 53, 0.12); border: 1px solid rgba(236, 163, 53, 0.25); border-radius: 8px; padding: 8px 10px;">
            ${step.pauseReason || "Checkpoint reached. Review before continuing."}
        </div>
        <div style="display:flex; align-items:center; gap:16px; width: 100%;">
            <button class="btn" style="padding:10px 24px; font-size:14px; font-weight:600; border-radius:24px; background:#D96C51; color:white; border:none; cursor:pointer; display:flex; align-items:center; gap:8px;" onclick="App.continueExecution(${step.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Approve & continue
            </button>
            <button class="btn" style="padding:10px 18px; font-size:13px; font-weight:600; border-radius:24px; background:white; color:#A34B36; border:1px solid #F0C7BA; cursor:pointer;" onclick="App.manualStep(${step.id})">
              Switch this step to manual
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
    activeMode = 'code';
    isExecuting = true;
    currentStepIndex = 0;
    runtimeIntervention = null;
    confidenceTrend = [];
    
    const container = document.querySelector('#agent-card-container');
    if (container) {
        container.innerHTML = renderModeTabs('code') + `
          <div class="mission-dashboard" style="width:100%; background:white; border:1px solid var(--border-light); border-radius:20px; overflow:hidden; box-shadow:0 8px 28px rgba(0,0,0,0.06); margin-bottom:36px;">
            <div style="padding: 40px; text-align: center; animation: fadeIn 0.5s ease-out;">
              <div class="ar-dot" style="width:16px; height:16px; background:#3D8B63; border-radius:50%; margin:0 auto 20px; animation: pulse 1.5s infinite;"></div>
              <div style="font-size: 11px; font-weight: 700; color: #3D8B63; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">Claude Agent Orchestration Phase</div>
              <h2 style="font-family: var(--font-serif); font-size: 24px; color: var(--text-main); margin: 0 0 16px 0;">Specialized Agent Creation</h2>
              <p style="font-size: 15px; color: var(--text-muted); max-width: 500px; margin: 0 auto; line-height: 1.6;">
                Based on your mission intent and strategic constraints, I am creating a specialized ${currentAnalysis.leadAgent?.id || 'Task'} Claude Agent optimized for this specific execution.
              </p>
              <div style="margin-top: 24px; display: flex; justify-content: center; gap: 8px;">
                <div style="padding: 6px 12px; background: #F4F9F6; color: #3D8B63; border-radius: 8px; font-size: 11px; font-weight: 700; border: 1px solid #D1E7DD;">
                  ${currentAnalysis.leadAgent?.icon || '🤖'} LEAD: ${currentAnalysis.leadAgent?.id.toUpperCase() || 'AGENT'}
                </div>
                ${currentAnalysis.skillMatches.length > 0 ? `
                  <div style="padding: 6px 12px; background: #2D2A26; color: white; border-radius: 8px; font-size: 11px; font-weight: 700;">
                    SKILL-OPTIMIZED
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
    }

    scrollToBottom();

    // Wait for "Creation" phase before starting steps
    setTimeout(() => {
        if (container) {
            container.innerHTML = renderModeTabs('code') + renderAgentRunningCard(currentAnalysis, 'running');
        }
        simulateExecution();
    }, 2500);
  }

  function simulateExecution() {
    setTimeout(runNextStep, 500);
  }

  function continueExecution(stepId) {
      if (!currentAnalysis || !isExecuting) return;
      const step = currentAnalysis.executionPlan.steps.find(s => s.id === stepId);
      if (!step) return;

      const stepEl = document.getElementById(`step-${step.id}`);
      if (stepEl) {
        stepEl.outerHTML = renderStep(step, 'done');
      }

      if (currentStepIndex < currentAnalysis.executionPlan.steps.length && currentAnalysis.executionPlan.steps[currentStepIndex].id === stepId) {
        currentStepIndex++;
      } else {
        currentStepIndex = currentAnalysis.executionPlan.steps.findIndex(s => s.id === stepId) + 1;
      }

      setTimeout(() => {
        runNextStep();
      }, 500);
  }

  function runNextStep() {
    if (!currentAnalysis || !isExecuting) return;

    const steps = currentAnalysis.executionPlan.steps;
    if (currentStepIndex >= steps.length) {
      isExecuting = false;
      if (currentAnalysis?.taskType) {
        PreFlightEngine.recordOutcome(currentAnalysis.taskType, 'success');
      }
      const card = document.querySelector('.agent-running-card');
      if (card) {
        card.outerHTML = renderAgentRunningCard(currentAnalysis, 'complete');
      }
      scrollToBottom();
      return;
    }

    const step = steps[currentStepIndex];
    const stepNode = document.getElementById(`step-${step.id}`);
    if (!stepNode) return;

    const intervention = evaluateRuntimeIntervention(step, currentStepIndex, steps.length, currentAnalysis.complexity?.riskLevel);
    if (intervention) {
      runtimeIntervention = intervention;
      confidenceTrend.push(Math.max(0, 100 - Math.round(intervention.driftScore * 100)));
      if (confidenceTrend.length > 16) confidenceTrend.shift();
      renderRuntimeInterventionBanner(intervention);
      if (intervention.escalateCheckpoint) {
        step.checkpoint = true;
        step.pauseReason = intervention.pauseReason;
      }
    } else {
      runtimeIntervention = null;
      renderRuntimeInterventionBanner(null);
    }

    stepNode.outerHTML = renderStep(step, 'running');
    setTimeout(() => {
      const rerendered = document.getElementById(`step-${step.id}`);
      if (!rerendered) return;

      if (step.checkpoint) {
        rerendered.outerHTML = renderStep(step, 'paused');
      } else {
        rerendered.outerHTML = renderStep(step, 'done');
        currentStepIndex++;
        runNextStep();
      }
    }, 1400);
  }

  function evaluateRuntimeIntervention(step, index, totalSteps, missionRisk = 'low') {
    const progressRatio = totalSteps > 0 ? index / totalSteps : 0;
    const baseDrift = step.risk === 'high' ? 0.52 : step.risk === 'medium' ? 0.34 : 0.18;
    const missionMultiplier = missionRisk === 'high' ? 1.25 : missionRisk === 'medium' ? 1.05 : 0.9;
    const lateStagePressure = progressRatio > 0.65 ? 0.12 : 0;
    const driftScore = Math.min(0.95, (baseDrift * missionMultiplier) + lateStagePressure);

    if (driftScore >= 0.6) {
      return {
        level: 'high',
        driftScore,
        message: 'Confidence dropped during runtime. Escalating to human checkpoint before proceeding.',
        recommendation: 'Review output, tighten constraints, or switch this step to manual execution.',
        escalateCheckpoint: true,
        pauseReason: `Phase 4 intervention: confidence drift (${driftToLevel(driftScore)}). Recommended fallback: review and refine before continuing.`
      };
    }

    if (driftScore >= 0.45) {
      return {
        level: 'medium',
        driftScore,
        message: 'Potential execution drift detected. Suggested to verify assumptions at this step.',
        recommendation: 'Optional fallback: add constraints or convert next step to a manual review.',
        escalateCheckpoint: false,
        pauseReason: null
      };
    }

    return null;
  }

  function renderRuntimeInterventionBanner(intervention) {
    const zone = document.getElementById('runtime-intervention-zone');
    if (!zone) return;

    if (!intervention) {
      zone.innerHTML = '';
      return;
    }

    const palette = intervention.level === 'high'
      ? { bg: '#FFF5F2', border: '#F0C7BA', title: '#A34B36' }
      : { bg: '#FFF9F0', border: '#F4DCB0', title: '#8A6115' };
    const sparkline = buildConfidenceSparkline(confidenceTrend);
    const driftLevel = driftToLevel(intervention.driftScore);

    zone.innerHTML = `
      <div style="padding: 12px 14px; border-radius: 10px; border: 1px solid ${palette.border}; background: ${palette.bg};">
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.4px; color: ${palette.title}; margin-bottom: 6px;">
          PHASE 4: PROACTIVE INTERVENTION · DRIFT ${driftLevel}
        </div>
        <div style="font-size: 11px; color: #6B7280; margin-bottom: 6px; display:flex; align-items:center; gap:8px;">
          <span>Confidence trend</span>
          <span style="font-family: monospace; letter-spacing: -0.5px;">${sparkline}</span>
        </div>
        <div style="font-size: 13px; color: #4B5563; margin-bottom: 4px;">${intervention.message}</div>
        <div style="font-size: 12px; color: #6B7280;">${intervention.recommendation}</div>
      </div>
    `;
  }

  function buildConfidenceSparkline(points) {
    if (!points || points.length === 0) return '▁';
    const levels = '▁▂▃▄▅▆▇█';
    return points.map((p) => {
      const normalized = Math.max(0, Math.min(100, p));
      const index = Math.min(levels.length - 1, Math.floor((normalized / 100) * (levels.length - 1)));
      return levels[index];
    }).join('');
  }

  function manualStep(stepId) {
    if (!currentAnalysis || !isExecuting) return;
    const step = currentAnalysis.executionPlan.steps.find(s => s.id === stepId);
    if (!step) return;
    const stepEl = document.getElementById(`step-${step.id}`);
    if (stepEl) {
      stepEl.outerHTML = `
        <div class="ar-step done" id="step-${step.id}" style="border: 1px solid #3D8B6322; border-radius: 16px; padding: 16px 20px; display: flex; gap: 16px; align-items: center; background: #3D8B6308;">
          <div class="ar-icon" style="width:24px; height:24px; border-radius:50%; background:var(--accent-green); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="ar-content" style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px;">
              <h4 style="font-size:15px; font-weight:600; margin:0; color:var(--text-main);">${step.action}</h4>
              <span style="font-size:9px; font-weight:700; background:rgba(163, 75, 54, 0.15); color:#A34B36; padding:2px 6px; border-radius:4px;">MANUAL OVERRIDE</span>
            </div>
            <p style="font-size:13px; color:var(--text-muted); margin:4px 0 0 0;">Step handled manually by user. Claude Agent will continue from next step.</p>
          </div>
        </div>
      `;
    }

    const currentAt = currentAnalysis.executionPlan.steps.findIndex(s => s.id === stepId);
    currentStepIndex = currentAt + 1;
    setTimeout(() => runNextStep(), 350);
  }

  function runManual() {
    activeMode = 'chat';
    if (currentAnalysis?.taskType) {
      PreFlightEngine.recordOutcome(currentAnalysis.taskType, 'manual');
    }
    const container = document.querySelector('#agent-card-container');
    if (!container) return;
    container.innerHTML = renderModeTabs('chat') + `
      <div class="agent-running-card" style="width:100%; background:white; border:1px solid var(--border-light); border-radius:20px; padding:22px; margin-bottom:36px;">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); letter-spacing:0.6px; text-transform:uppercase; margin-bottom:8px;">Simple Chat Mode</div>
        <div style="font-size:16px; font-weight:600; color:var(--text-main); margin-bottom:8px;">Stayed in manual prompting</div>
        <div style="font-size:14px; color:var(--text-muted); line-height:1.6;">${buildManualResponse(currentAnalysis)}</div>
      </div>
    `;
    scrollToBottom();
  }

  function reset(repopulatePrompt = null) {
      DOM.messagesArea.innerHTML = '';
      DOM.welcomeView.style.display = 'block';
      DOM.chatView.style.display = 'none';
      currentAnalysis = null;
      isExecuting = false;
      currentStepIndex = 0;
      runtimeIntervention = null;
      confidenceTrend = [];
      
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
    acceptedSkills.add(ref);
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

  async function discardSkill(ref) {
    if (!currentAnalysis) return;
    
    ignoredSkills.add(ref);
    
    // Show loading state briefly
    const card = document.querySelector('.preflight-card');
    if (card) { card.style.opacity = '0.5'; }
    
    // Re-analyze with ignored skills
    currentAnalysis = await PreFlightEngine.analyze(lastSubmittedPrompt, [], Array.from(ignoredSkills));
    
    DOM.messagesArea.innerHTML = '';
    renderPreFlightCard(currentAnalysis);
    scrollToBottom();
  }

  function editSkill(ref) {
    const newName = prompt("Edit Skill Name:", ref.replace('.md', '').substring(1));
    if (newName) {
        alert(`Skill updated to: ${newName}. Re-analyzing...`);
        reset(lastSubmittedPrompt);
    }
  }

  function acceptSkill(ref) {
    acceptedSkills.add(ref);
    // Silent re-render to update the nudge UI
    DOM.messagesArea.innerHTML = '';
    renderPreFlightCard(currentAnalysis);
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  return { init, runAgent, runManual, continueExecution, reset, modifyPrompt, saveSkill, discardSkill, editSkill, manualStep };
})();

document.addEventListener('DOMContentLoaded', App.init);

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
    
    // Add loading state
    DOM.messagesArea.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="ar-dot" style="width:12px; height:12px; background:var(--accent-orange); border-radius:50%; margin:0 auto 16px; animation: pulse 1.5s infinite;"></div>
        Analyzing task with AI-native engine...
    </div>`;
    
    currentAnalysis = await PreFlightEngine.analyze(prompt, promptHistory, Array.from(ignoredSkills));
    
    // Add to history for next time
    promptHistory.push(prompt);
    if (promptHistory.length > 5) promptHistory.shift();

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
    const { mission, complexity, constraints, executionPlan, recommendation, optimizationProfile, systemLimits } = analysis;

    let html = `<div class="message" style="flex-direction: column; align-items: center; gap: 8px; width: 100%;">`;
    
    // 1. Mission Dashboard Header
    html += `
      <div class="mission-dashboard" style="width: 100%; max-width: 900px; background: white; border: 1px solid var(--border-light); border-radius: 24px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.08); margin-bottom: 40px;">
        <div style="background: #F9F9F8; padding: 24px 32px; border-bottom: 1px solid var(--border-light);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1; padding-right: 24px;">
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">Mission Intent</div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: var(--text-main); font-family: var(--font-serif); line-height: 1.3;">${mission}</h1>
            </div>
            <div style="background: white; padding: 10px 16px; border-radius: 12px; border: 1px solid var(--border-light); display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
              ${complexity.riskLevel === 'high' ? '<span style="font-size: 10px; font-weight: 700; color: #D96C51; background: #FFF9F2; padding: 4px 8px; border-radius: 6px; margin-right: 4px;">DISCOVERY MODE</span>' : ''}
              <span style="font-size: 20px;">${analysis.taskIcon}</span>
              <span style="font-size: 14px; font-weight: 600; color: var(--text-main);">${analysis.taskLabel}</span>
            </div>
          </div>
        </div>

        <div style="padding: 32px;">
          <!-- 2. System Limits Section -->
          ${systemLimits.length > 0 ? `
            <div style="margin-bottom: 24px; padding: 16px; background: #FFF9F2; border: 1px solid #FFE8D1; border-radius: 16px;">
              <div style="font-size: 11px; font-weight: 700; color: #D96C51; letter-spacing: 0.5px; margin-bottom: 8px;">SYSTEM LIMITS DETECTED</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${systemLimits.map(limit => `
                  <span style="background: white; border: 1px solid #FFE8D1; color: #A34B36; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 500;">
                    ${limit}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 2.5 Discovery Phase (Clarifying Questions) -->
          ${complexity.riskLevel === 'high' ? `
            <div style="margin-bottom: 24px; padding: 20px; background: #F8F9FB; border: 1px solid #E2E8F0; border-radius: 16px;">
              <div style="font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 12px;">DISCOVERY PHASE: CLARIFYING QUESTIONS</div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="font-size: 13px; color: #1E293B; background: white; padding: 10px 14px; border-radius: 8px; border: 1px solid #E2E8F0;">
                  <strong>Q:</strong> What is the primary role or specialization for this agent?
                </div>
                <div style="font-size: 13px; color: #1E293B; background: white; padding: 10px 14px; border-radius: 8px; border: 1px solid #E2E8F0;">
                  <strong>Q:</strong> Which tool categories (File editing, Terminal, Web) should be prioritized?
                </div>
              </div>
              <div style="margin-top: 12px; font-size: 12px; color: #64748B; font-style: italic;">
                Tip: Answering these in your next prompt will highly optimize the /skill.md creation.
              </div>
            </div>
          ` : ''}
          <div style="display: flex; gap: 24px; padding: 20px; background: #FBFBFB; border: 1px solid var(--border-light); border-radius: 16px; margin-bottom: 32px;">
            <div style="flex: 1; border-right: 1px solid var(--border-light); padding-right: 16px;">
              <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px;">COMPLEXITY</div>
              <div style="font-family: var(--font-serif); font-size: 20px; font-weight: 500; color: var(--text-main);">${capitalize(complexity.contextLoad)}</div>
            </div>
            <div style="flex: 1; border-right: 1px solid var(--border-light); padding: 0 16px;">
              <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px;">STEPS</div>
              <div style="font-family: var(--font-serif); font-size: 20px; font-weight: 500; color: var(--text-main);">${executionPlan.totalSteps || executionPlan.steps.length}</div>
            </div>
            <div style="flex: 1; padding-left: 16px;">
              <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px;">CONFIDENCE</div>
              <div style="font-family: var(--font-serif); font-size: 20px; font-weight: 500; color: var(--text-main);">${recommendation.confidence > 1 ? recommendation.confidence : Math.round(recommendation.confidence * 100)}%</div>
            </div>
          </div>

          <!-- 4. Intelligence / Skill Nudge -->
          ${analysis.skillMatches && analysis.skillMatches.length > 0 ? `
            <div class="skill-nudge" style="padding:20px; background:#EBF4EF; border:1px solid #D1E7DD; border-radius:16px; display:flex; align-items:center; gap:16px; margin-bottom: 32px;">
              <div style="width:32px; height:32px; background:#3D8B63; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div style="font-size:14px; color:#2E694B; font-weight:500; flex:1; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-weight:700;">Intelligence applied:</span>
                <span style="background:black; color:white; padding:2px 8px; border-radius:4px; font-family:var(--font-mono); font-size:11px; letter-spacing:0.5px;">${analysis.skillMatches[0].ref.replace('.md', '').toUpperCase()}.md</span>
                <span style="color:rgba(46,105,75,0.7); font-size:13px;">based on operational patterns.</span>
              </div>
              <div style="display:flex; gap:8px;">
                ${acceptedSkills.has(analysis.skillMatches[0].ref) ? `
                  <span style="background:#3D8B63; color:white; padding:6px 16px; border-radius:8px; font-size:12px; font-weight:700;">Confirmed</span>
                ` : `
                  <button class="btn-nudge-action btn-discard-skill" style="padding:6px 12px; font-size:12px; background:transparent; border:1px solid #3D8B63; color:#3D8B63; border-radius:8px; cursor:pointer; font-weight:600;">Discard</button>
                  <button class="btn-nudge-action btn-accept-skill" style="padding:6px 12px; font-size:12px; background:#3D8B63; border:1px solid #3D8B63; color:white; border-radius:8px; cursor:pointer; font-weight:600;">Accept</button>
                `}
              </div>
            </div>
          ` : ''}

          <!-- 5. Suggested Skills (Discovery) -->
          ${analysis.suggestedSkills && analysis.suggestedSkills.length > 0 ? 
            analysis.suggestedSkills.map(skill => `
            <div class="skill-suggestion-card" style="padding:24px; background:rgba(217,108,81,0.03); border:1px solid rgba(217,108,81,0.12); border-radius:20px; margin-bottom: 24px;">
              <div style="display:flex; gap:16px; align-items:flex-start;">
                <div style="width:40px; height:40px; background:var(--accent-orange); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                </div>
                <div style="flex:1;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div>
                      <h4 style="margin:0 0 4px 0; font-size:18px; font-weight:600; font-family: var(--font-serif); color:var(--text-main);">Strategic Optimization Found</h4>
                      <div style="display:flex; gap:8px;">
                        <span style="font-size:10px; font-weight:700; color:var(--text-main); background:#F3F1EB; padding:3px 8px; border-radius:4px;">${skill.name.toUpperCase()}</span>
                        <span style="font-size:10px; font-weight:700; color:#3D8B63; background:#EBF4EF; padding:3px 8px; border-radius:4px;">AI-NATIVE</span>
                      </div>
                    </div>
                    <button class="btn btn-save-skill" style="padding:8px 20px; font-size:13px; font-weight:600; border:1px solid var(--accent-orange); color:var(--accent-orange); background:transparent; border-radius:10px; cursor:pointer;" 
                      data-name="${skill.name.replace(/"/g, '&quot;')}" 
                      data-pattern="${skill.pattern.replace(/"/g, '&quot;')}" 
                      data-ref="${skill.ref.replace(/"/g, '&quot;')}">
                      Save as /skill
                    </button>
                  </div>
                  <p style="margin:12px 0; font-size:14px; color:var(--text-muted); line-height:1.5;">${skill.rationale || "I've identified an operational pattern that should be bundled into a deterministic workflow."}</p>
                </div>
              </div>
            </div>
            `).join('') : ''}

          <!-- 6. Execution Plan Steps -->
          <div style="margin-bottom: 32px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 20px;">STRATEGIC EXECUTION PLAN</div>
            <div style="display: flex; flex-direction: column; gap: 20px;">
              ${executionPlan.steps.map(step => `
                <div style="display: flex; gap: 16px; align-items: flex-start;">
                  <div style="width: 28px; height: 28px; border-radius: 50%; background: #F3F1EB; color: var(--text-muted); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${step.id}</div>
                  <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                      <div style="font-size: 15px; font-weight: 600; color: var(--text-main);">${step.action}</div>
                      ${step.checkpoint ? '<span style="font-size:9px; font-weight:700; background:rgba(236, 163, 53, 0.15); color:#A37B30; padding:2px 8px; border-radius:4px; letter-spacing:0.5px;">CHECKPOINT</span>' : ''}
                    </div>
                    <div style="font-size: 14px; color: var(--text-muted); line-height: 1.4;">${step.desc}</div>
                    ${step.skillRef ? `
                      <div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; background: black; color: white; padding: 4px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.5px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                        USING ${step.skillRef.toUpperCase()}
                      </div>
                    ` : ''}
                    ${step.reasoning ? `
                      <div style="margin-top: 6px; font-size: 12px; color: #3D8B63; font-style: italic; background: #F4F9F6; padding: 6px 10px; border-radius: 8px; border-left: 2px solid #3D8B63;">
                        <strong>Planner reasoning:</strong> ${step.reasoning}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 7. Optimization Profile (Collapsible) -->
          <details style="border: 1px solid var(--border-light); border-radius: 20px; padding: 20px; background: #FBFBFB;">
            <summary style="list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">
              OPTIMIZATION PROFILE
              <span style="background: var(--accent-orange); color: white; padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: 700;">+ Skill-optimized</span>
            </summary>
            <div style="margin-top: 24px;">
              <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                <div style="flex: 1;">
                  <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; margin-bottom: 6px;"><span>TOKENS</span><span>${optimizationProfile.tokens}%</span></div>
                  <div style="height: 4px; background: #EEE; border-radius: 2px; overflow: hidden;"><div style="height: 100%; width: ${optimizationProfile.tokens}%; background: var(--accent-orange);"></div></div>
                </div>
                <div style="flex: 1;">
                  <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; margin-bottom: 6px;"><span>QUALITY</span><span>${optimizationProfile.quality}%</span></div>
                  <div style="height: 4px; background: #EEE; border-radius: 2px; overflow: hidden;"><div style="height: 100%; width: ${optimizationProfile.quality}%; background: var(--accent-green);"></div></div>
                </div>
                <div style="flex: 1;">
                  <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; margin-bottom: 6px;"><span>LATENCY</span><span>${optimizationProfile.latency}%</span></div>
                  <div style="height: 4px; background: #EEE; border-radius: 2px; overflow: hidden;"><div style="height: 100%; width: ${optimizationProfile.latency}%; background: #999;"></div></div>
                </div>
              </div>
              <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px;">
                ${optimizationProfile.bullets.map(b => `
                  <li style="font-size: 13px; color: var(--text-main); display: flex; gap: 8px; align-items: flex-start;">
                    <span style="color: var(--accent-orange); margin-top: 3px;">•</span>
                    ${b}
                  </li>
                `).join('')}
              </ul>
            </div>
          </details>

          <!-- 8. Actions Footer -->
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 40px; padding-top: 32px; border-top: 1px solid var(--border-light);">
            <button onclick="App.runAgent()" style="padding: 14px 40px; background: var(--accent-orange); color: white; border: none; border-radius: 14px; font-weight: 600; font-size: 15px; cursor: pointer; box-shadow: 0 4px 12px rgba(217, 108, 81, 0.25);">Proceed with Agent →</button>
            <button onclick="App.modifyPrompt()" style="padding: 14px 28px; background: white; border: 1px solid var(--border-light); border-radius: 14px; font-weight: 600; font-size: 15px; color: var(--text-main); cursor: pointer;">Modify Mission</button>
          </div>
        </div>
      </div>
    `;

    html += `</div>`;
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

  return { init, runAgent, runManual, continueExecution, reset, modifyPrompt, saveSkill, discardSkill, editSkill };
})();

document.addEventListener('DOMContentLoaded', App.init);

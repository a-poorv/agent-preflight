import { analyze, saveSkillToServer, updateSkillOnServer, recordOutcome } from './engine';
import type { PreFlightAnalysis, ExecutionStep, RuntimeIntervention, Skill, SuggestedSkill } from './types';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const dom = {
  welcomeView: document.getElementById('welcome-view')!,
  chatView: document.getElementById('chat-view')!,
  messagesArea: document.getElementById('messages-area')!,
  quickPrompts: document.getElementById('quick-prompts')!,
  promptInput: document.getElementById('prompt-input') as HTMLTextAreaElement,
  btnSend: document.getElementById('btn-send')!,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let isExecuting = false;
let currentAnalysis: PreFlightAnalysis | null = null;
let currentStepIndex = 0;
let lastPrompt = '';
let promptHistory: string[] = [];
let acceptedSkillRefs = new Set<string>();
let ignoredSkillRefs = new Set<string>();
let confidenceTrend: number[] = [];

// ---------------------------------------------------------------------------
// Quick prompts
// ---------------------------------------------------------------------------
const QUICK_PROMPTS = [
  'Debug why my login form is throwing a 500 error after the latest deploy',
  'Refactor the dashboard components to use a shared layout — don\'t change behavior',
  'Build a Kanban board with drag-and-drop, persisted to localStorage',
  'What\'s the difference between useMemo and useCallback?',
];

function renderQuickPrompts(): void {
  dom.quickPrompts.innerHTML = QUICK_PROMPTS.map(p =>
    `<button class="quick-prompt" data-prompt="${p.replace(/"/g, '&quot;')}">${p}</button>`
  ).join('');
}

// ---------------------------------------------------------------------------
// Auto-resize textarea
// ---------------------------------------------------------------------------
function autoResize(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

// ---------------------------------------------------------------------------
// Mode tabs
// ---------------------------------------------------------------------------
function renderModeTabs(mode: 'chat' | 'code'): string {
  return `
    <div style="display:inline-flex; background:#EBE8E0; border-radius:10px; padding:4px; gap:4px; margin-bottom:12px;">
      <span style="font-size:12px; font-weight:700; letter-spacing:0.3px; padding:6px 10px; border-radius:7px;
        color:${mode === 'chat' ? '#FFFFFF' : '#6B6863'};
        background:${mode === 'chat' ? '#2D2A26' : 'transparent'};">CHAT</span>
      <span style="font-size:12px; font-weight:700; letter-spacing:0.3px; padding:6px 10px; border-radius:7px;
        color:${mode === 'code' ? '#FFFFFF' : '#6B6863'};
        background:${mode === 'code' ? '#2D2A26' : 'transparent'};">CLAUDE CODE</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function toLevel(v: number): string { return v >= 70 ? 'High' : v >= 40 ? 'Medium' : 'Low'; }
function driftToLevel(score: number): string { return score >= 0.6 ? 'High' : score >= 0.45 ? 'Medium' : 'Low'; }
function scrollBottom(): void { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }
function getContainer(): HTMLElement | null { return document.getElementById('agent-card-container'); }

// ---------------------------------------------------------------------------
// Skill opportunity — only surface when real boundary conditions exist
// ---------------------------------------------------------------------------
const SKILL_ELIGIBLE_TASKS = new Set(['debugging', 'refactor', 'code_gen', 'multi_step']);

function shouldSuggestSkill(analysis: PreFlightAnalysis): boolean {
  if (!analysis.suggestedSkills.length) return false;
  if (!SKILL_ELIGIBLE_TASKS.has(analysis.taskType)) return false;
  const hasUserBoundary = analysis.constraints.some(c => c.type === 'boundary' || c.type === 'explicit');
  const hasSystemLimit = analysis.systemLimits.length > 0;
  return hasUserBoundary || hasSystemLimit;
}

function skillTriggerReason(analysis: PreFlightAnalysis): string {
  const boundary = analysis.constraints.find(c => c.type === 'boundary');
  if (boundary) return `Boundary detected: <em>${boundary.rule}</em> — this constraint will repeat on similar tasks.`;
  const explicit = analysis.constraints.find(c => c.type === 'explicit');
  if (explicit) return `Constraint detected: <em>${explicit.rule}</em> — encoding this as a skill avoids re-specifying it each time.`;
  if (analysis.systemLimits.length > 0)
    return `System limit detected: <em>${analysis.systemLimits[0]}</em> — a skill here reduces token overhead on repeat runs.`;
  return 'Recurring pattern detected — saving as a skill optimizes future executions.';
}

// ---------------------------------------------------------------------------
// Skill panel
// ---------------------------------------------------------------------------
function renderSkillPanel(skill: SuggestedSkill, analysis: PreFlightAnalysis, isEditing = false, editValue = ''): string {
  if (isEditing) {
    return `
      <div id="skill-panel" style="margin-bottom:16px; border:1px solid #F0D3C8; background:#FFF8F5; border-radius:12px; padding:14px;">
        <div style="font-size:11px; font-weight:700; color:#A34B36; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:6px;">Edit Skill Name</div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input id="skill-name-input" type="text" value="${editValue.replace(/"/g, '&quot;')}"
            style="flex:1; padding:7px 12px; font-size:13px; border:1px solid var(--border-light); border-radius:8px; outline:none; font-family:var(--font-sans);"
            placeholder="Skill name…" />
          <button id="skill-save-confirm"
            style="padding:7px 14px; font-size:12px; font-weight:600; border:none; color:white; background:var(--accent-orange); border-radius:8px; cursor:pointer;"
            data-ref="${skill.ref.replace(/"/g, '&quot;')}"
            data-pattern="${skill.pattern.replace(/"/g, '&quot;')}">Save</button>
          <button id="skill-edit-cancel"
            style="padding:7px 12px; font-size:12px; font-weight:600; border:1px solid var(--border-light); color:var(--text-muted); background:white; border-radius:8px; cursor:pointer;">Cancel</button>
        </div>
      </div>`;
  }

  const reason = skillTriggerReason(analysis);
  return `
    <div id="skill-panel" style="margin-bottom:16px; border:1px solid #F0D3C8; background:#FFF8F5; border-radius:12px; padding:14px;">
      <div style="font-size:11px; font-weight:700; color:#A34B36; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:6px;">Skill Opportunity</div>
      <div style="font-size:13px; font-weight:600; color:#3D2B25; margin-bottom:4px;">${skill.name}</div>
      <div style="font-size:12px; color:#7A4A3A; margin-bottom:12px; line-height:1.5;">${reason}</div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <button id="skill-add"
          style="padding:7px 14px; font-size:12px; font-weight:600; border:none; color:white; background:var(--accent-orange); border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:5px;"
          data-name="${skill.name.replace(/"/g, '&quot;')}"
          data-pattern="${skill.pattern.replace(/"/g, '&quot;')}"
          data-ref="${skill.ref.replace(/"/g, '&quot;')}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Skill
        </button>
        <button id="skill-edit"
          style="padding:7px 14px; font-size:12px; font-weight:600; border:1px solid var(--border-light); color:var(--text-main); background:white; border-radius:8px; cursor:pointer;"
          data-ref="${skill.ref.replace(/"/g, '&quot;')}"
          data-name="${skill.name.replace(/"/g, '&quot;')}">Edit</button>
        <button id="skill-discard"
          style="padding:7px 14px; font-size:12px; font-weight:600; border:1px solid var(--border-light); color:var(--text-muted); background:white; border-radius:8px; cursor:pointer;"
          data-ref="${skill.ref.replace(/"/g, '&quot;')}">Discard</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Pre-flight card render
// ---------------------------------------------------------------------------
function renderPreFlightCard(analysis: PreFlightAnalysis): void {
  const { mission, complexity, constraints, executionPlan, recommendation, optimizationProfile, systemLimits, agentSetupQuestions } = analysis;
  const confidenceRaw = recommendation.confidence > 1 ? recommendation.confidence : Math.round(recommendation.confidence * 100);
  const decisionText = recommendation.mode === 'agent' ? 'Use Claude Agent' : 'Stay in Manual Prompting';
  const constraintChips = constraints.filter(c => c.type !== 'system').slice(0, 4);
  // Only show skill opportunity when real boundary conditions are detected
  const topSkill = shouldSuggestSkill(analysis) ? (analysis.suggestedSkills[0] ?? null) : null;
  const skillOptimized = acceptedSkillRefs.size > 0;

  const html = `
    <div class="message" style="flex-direction:column; align-items:center; gap:8px; width:100%;">
      <div id="agent-card-container" style="width:100%; max-width:820px; display:flex; flex-direction:column; align-items:flex-start;">
        ${renderModeTabs('chat')}
        <div class="mission-dashboard" style="width:100%; background:white; border:1px solid var(--border-light); border-radius:20px; overflow:hidden; box-shadow:0 8px 28px rgba(0,0,0,0.06); margin-bottom:36px;">

          <div style="background:#F9F9F8; padding:20px 24px; border-bottom:1px solid var(--border-light);">
            <div style="font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:0.8px; text-transform:uppercase; margin-bottom:6px;">Claude Agent Compass</div>
            <h2 style="margin:0; font-size:20px; font-weight:600; color:var(--text-main); font-family:var(--font-serif); line-height:1.35;">${mission}</h2>
          </div>

          <div style="padding:24px;">

            <!-- Recommendation -->
            <div style="border:1px solid var(--border-light); border-radius:14px; padding:16px; background:#FCFCFB; margin-bottom:14px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
                <div style="font-size:11px; font-weight:700; color:var(--text-muted); letter-spacing:0.6px; text-transform:uppercase;">Recommendation</div>
                <div style="font-size:12px; color:#6B6863;">Confidence ${toLevel(confidenceRaw)}</div>
              </div>
              <div style="font-size:18px; font-weight:600; color:var(--text-main); margin-bottom:6px;">${decisionText}</div>
              <div style="font-size:13px; color:var(--text-muted); line-height:1.45;">${recommendation.reasoning}</div>
              <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <span style="font-size:11px; background:#F3F1EB; color:#4B4A46; border:1px solid #E4E1D8; padding:4px 8px; border-radius:8px;">Risk: ${cap(complexity.riskLevel)}</span>
                <span style="font-size:11px; background:#F3F1EB; color:#4B4A46; border:1px solid #E4E1D8; padding:4px 8px; border-radius:8px;">Task: ${analysis.taskLabel}</span>
                <span style="font-size:11px; background:#F3F1EB; color:#4B4A46; border:1px solid #E4E1D8; padding:4px 8px; border-radius:8px;">Steps: ${executionPlan.totalSteps}</span>
                ${skillOptimized ? `<span style="font-size:11px; background:#FFF0EC; color:var(--accent-orange); border:1px solid #F5C9BC; padding:4px 10px; border-radius:8px; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Skill optimized</span>` : ''}
              </div>
            </div>

            <!-- Constraints -->
            <div style="margin-bottom:14px;">
              <div style="font-size:11px; font-weight:700; color:var(--text-muted); letter-spacing:0.6px; text-transform:uppercase; margin-bottom:8px;">Detected Constraints</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${constraintChips.length > 0
                  ? constraintChips.map(c => `<span style="font-size:12px; background:#EEF4F0; color:#2E694B; border:1px solid #D1E7DD; padding:5px 10px; border-radius:999px;">${c.rule}</span>`).join('')
                  : '<span style="font-size:12px; color:var(--text-muted);">No explicit constraints detected.</span>'}
                ${systemLimits.slice(0, 2).map(l => `<span style="font-size:12px; background:#FFF5F0; color:#A34B36; border:1px solid #F0D3C8; padding:5px 10px; border-radius:999px;">System: ${l}</span>`).join('')}
              </div>
            </div>

            <!-- Skill panel — only when boundary conditions exist -->
            ${topSkill ? renderSkillPanel(topSkill, analysis) : ''}

            <!-- Agent Created -->
            ${recommendation.mode === 'agent' ? `
              <div style="margin-bottom:16px; border:1px solid #D1E7DD; background:#F4F9F6; border-radius:12px; padding:12px;">
                <div style="font-size:11px; font-weight:700; color:#2E694B; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:6px;">Agent Created</div>
                <div style="font-size:13px; color:#365748; margin-bottom:10px;">Confirm these setup details to optimize execution and reduce blind spots.</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  ${agentSetupQuestions.map(q => `
                    <div style="background:white; border:1px solid #E3EFE8; border-radius:8px; padding:8px 10px;">
                      <div style="font-size:12px; color:#4B5563; margin-bottom:2px;"><strong>Q:</strong> ${q.question}</div>
                      <div style="font-size:13px; color:#1F2937;"><strong>A:</strong> ${q.answer}</div>
                    </div>`).join('')}
                </div>
              </div>` : ''}

            <!-- Details expandable -->
            <details style="border:1px solid var(--border-light); border-radius:12px; padding:12px; background:#FBFBFB;">
              <summary style="cursor:pointer; list-style:none; font-size:12px; font-weight:700; color:var(--text-muted); letter-spacing:0.4px; text-transform:uppercase;">Show details</summary>
              <div style="margin-top:10px;">
                <div style="font-size:12px; color:#4B5563; margin-bottom:10px;">Checkpointing is auto-managed based on risk.</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  ${executionPlan.steps.map(s => `
                    <div style="padding:8px 10px; border:1px solid #ECE9E1; border-radius:8px; background:white;">
                      <div style="display:flex; justify-content:space-between; gap:8px;">
                        <span style="font-size:13px; font-weight:600; color:#2D2A26;">${s.id}. ${s.action}</span>
                        ${s.checkpoint ? '<span style="font-size:10px; color:#A37B30; background:#FFF5DD; padding:2px 6px; border-radius:6px;">CHECKPOINT</span>' : ''}
                      </div>
                      <div style="font-size:12px; color:#6B6863; margin-top:2px;">${s.desc}</div>
                    </div>`).join('')}
                </div>
                <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
                  ${(['Tokens', 'Quality', 'Latency'] as const).map((label, i) => {
                    const val = [optimizationProfile.tokens, optimizationProfile.quality, optimizationProfile.latency][i];
                    const color = ['#D96C51', '#3D8B63', '#ECA335'][i];
                    return `
                      <div>
                        <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; font-weight:700; letter-spacing:0.4px; color:#6B6863; margin-bottom:4px; text-transform:uppercase;">
                          <span>${label}</span><span>${toLevel(val)}</span>
                        </div>
                        <div style="height:6px; background:#ECE9E1; border-radius:999px; overflow:hidden;">
                          <div style="height:100%; width:${val}%; background:${color}; border-radius:999px;"></div>
                        </div>
                      </div>`;
                  }).join('')}
                </div>
              </div>
            </details>

            <!-- Actions -->
            <div style="display:flex; justify-content:center; gap:12px; margin-top:22px; padding-top:18px; border-top:1px solid var(--border-light);">
              <button id="btn-run-agent" style="padding:12px 26px; background:var(--accent-orange); color:white; border:none; border-radius:12px; font-weight:600; font-size:14px; cursor:pointer;">Proceed with Claude Agent</button>
              <button id="btn-modify" style="padding:12px 20px; background:white; border:1px solid var(--border-light); border-radius:12px; font-weight:600; font-size:14px; color:var(--text-main); cursor:pointer;">Modify Prompt</button>
              <button id="btn-manual" style="padding:12px 20px; background:white; border:1px solid var(--border-light); border-radius:12px; font-weight:600; font-size:14px; color:var(--text-main); cursor:pointer;">Stay Manual</button>
            </div>

          </div>
        </div>
      </div>
    </div>`;

  dom.messagesArea.insertAdjacentHTML('beforeend', html);
  bindCardEvents();
}

// ---------------------------------------------------------------------------
// Event binding
// ---------------------------------------------------------------------------
function bindCardEvents(): void {
  document.getElementById('btn-run-agent')?.addEventListener('click', runAgent);
  document.getElementById('btn-modify')?.addEventListener('click', modifyPrompt);
  document.getElementById('btn-manual')?.addEventListener('click', runManual);
  bindSkillPanelEvents();
}

function bindSkillPanelEvents(): void {
  document.getElementById('skill-add')?.addEventListener('click', handleSkillAdd);
  document.getElementById('skill-edit')?.addEventListener('click', handleSkillEditOpen);
  document.getElementById('skill-discard')?.addEventListener('click', handleSkillDiscard);
  document.getElementById('skill-save-confirm')?.addEventListener('click', handleSkillEditConfirm);
  document.getElementById('skill-edit-cancel')?.addEventListener('click', handleSkillEditCancel);
}

// ---------------------------------------------------------------------------
// Skill handlers
// ---------------------------------------------------------------------------
async function handleSkillAdd(e: Event): Promise<void> {
  if (!currentAnalysis) return;
  const btn = e.currentTarget as HTMLButtonElement;
  const { name, pattern, ref } = btn.dataset as Record<string, string>;
  setSkillPanelLoading(true);
  const skill: Skill = { name, pattern, ref, efficiency: 10 };
  acceptedSkillRefs.add(ref);
  await saveSkillToServer(skill);
  currentAnalysis = await analyze(lastPrompt, [], Array.from(ignoredSkillRefs));
  rerenderPreFlightCard();
}

async function handleSkillDiscard(e: Event): Promise<void> {
  if (!currentAnalysis) return;
  const btn = e.currentTarget as HTMLButtonElement;
  const ref = btn.dataset['ref']!;
  setSkillPanelLoading(true);
  ignoredSkillRefs.add(ref);
  currentAnalysis = await analyze(lastPrompt, [], Array.from(ignoredSkillRefs));
  rerenderPreFlightCard();
}

function handleSkillEditOpen(e: Event): void {
  if (!currentAnalysis) return;
  const btn = e.currentTarget as HTMLButtonElement;
  const name = btn.dataset['name'] ?? '';
  const skill = currentAnalysis.suggestedSkills[0];
  if (!skill) return;
  const panel = document.getElementById('skill-panel');
  if (panel) {
    panel.outerHTML = renderSkillPanel(skill, currentAnalysis, true, name);
    bindSkillPanelEvents();
    (document.getElementById('skill-name-input') as HTMLInputElement | null)?.focus();
  }
}

async function handleSkillEditConfirm(e: Event): Promise<void> {
  if (!currentAnalysis) return;
  const btn = e.currentTarget as HTMLButtonElement;
  const ref = btn.dataset['ref']!;
  const pattern = btn.dataset['pattern'] ?? '';
  const input = document.getElementById('skill-name-input') as HTMLInputElement | null;
  const newName = input?.value.trim() ?? '';
  if (!newName) return;
  setSkillPanelLoading(true);
  const skill: Skill = { name: newName, pattern, ref, efficiency: 10 };
  acceptedSkillRefs.add(ref);
  await updateSkillOnServer(ref, { name: newName });
  await saveSkillToServer(skill);
  currentAnalysis = await analyze(lastPrompt, [], Array.from(ignoredSkillRefs));
  rerenderPreFlightCard();
}

function handleSkillEditCancel(): void {
  if (!currentAnalysis) return;
  const skill = currentAnalysis.suggestedSkills[0];
  if (!skill) return;
  const panel = document.getElementById('skill-panel');
  if (panel) {
    panel.outerHTML = renderSkillPanel(skill, currentAnalysis);
    bindSkillPanelEvents();
  }
}

function setSkillPanelLoading(loading: boolean): void {
  ['skill-add', 'skill-edit', 'skill-discard', 'skill-save-confirm'].forEach(id => {
    const el = document.getElementById(id) as HTMLButtonElement | null;
    if (el) {
      el.disabled = loading;
      el.style.opacity = loading ? '0.5' : '1';
      el.style.cursor = loading ? 'not-allowed' : 'pointer';
    }
  });
}

function rerenderPreFlightCard(): void {
  if (!currentAnalysis) return;
  dom.messagesArea.innerHTML = '';
  renderPreFlightCard(currentAnalysis);
  scrollBottom();
}

// ---------------------------------------------------------------------------
// Submit handler
// ---------------------------------------------------------------------------
async function handleSubmit(): Promise<void> {
  const prompt = dom.promptInput.value.trim();
  if (!prompt || isExecuting) return;

  dom.welcomeView.style.display = 'none';
  dom.chatView.style.display = 'block';
  lastPrompt = prompt;

  dom.messagesArea.innerHTML = `
    <div style="padding:40px; text-align:center; color:var(--text-muted);">
      <div style="width:12px; height:12px; background:var(--accent-orange); border-radius:50%; margin:0 auto 16px; animation:pulse 1.5s infinite;"></div>
      <div style="font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:8px;">Analyzing…</div>
      <div id="loader-status" style="font-size:14px; font-weight:500;">Performing RAG retrieval from Skill Bank…</div>
    </div>`;

  const loaderEl = (): HTMLElement | null => document.getElementById('loader-status');
  const t1 = setTimeout(() => { const el = loaderEl(); if (el) el.textContent = 'Analyzing intent vectors…'; }, 700);
  const t2 = setTimeout(() => { const el = loaderEl(); if (el) el.textContent = 'Matching mission to specialized agents…'; }, 1400);
  const t3 = setTimeout(() => { const el = loaderEl(); if (el) el.textContent = 'Building strategic execution plan…'; }, 2100);

  try {
    currentAnalysis = await analyze(prompt, promptHistory, Array.from(ignoredSkillRefs));
    promptHistory.push(prompt);
    if (promptHistory.length > 5) promptHistory.shift();
    dom.messagesArea.innerHTML = '';
    renderPreFlightCard(currentAnalysis);
  } catch (err) {
    console.error('Analysis error:', err);
    dom.messagesArea.innerHTML = `
      <div style="padding:40px; text-align:center; color:#D96C51;">
        <div style="font-size:24px; margin-bottom:16px;">⚠️</div>
        <div style="font-weight:600;">Analysis engine encountered an error</div>
        <div style="font-size:13px; margin-top:8px; opacity:0.8;">Try a different prompt.</div>
        <button onclick="window.App.reset()" style="margin-top:20px; padding:10px 20px; background:var(--accent-orange); color:white; border:none; border-radius:8px; cursor:pointer;">Reset</button>
      </div>`;
  } finally {
    clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    dom.promptInput.value = '';
    autoResize(dom.promptInput);
    scrollBottom();
  }
}

// ---------------------------------------------------------------------------
// Agent execution
// ---------------------------------------------------------------------------
function runAgent(): void {
  if (!currentAnalysis) return;
  isExecuting = true;
  currentStepIndex = 0;
  confidenceTrend = [];

  const container = getContainer();
  if (!container) return;

  container.innerHTML = renderModeTabs('code') + `
    <div class="mission-dashboard" style="width:100%; background:white; border:1px solid var(--border-light); border-radius:20px; overflow:hidden; box-shadow:0 8px 28px rgba(0,0,0,0.06); margin-bottom:36px;">
      <div style="padding:40px; text-align:center;">
        <div style="width:16px; height:16px; background:#3D8B63; border-radius:50%; margin:0 auto 20px; animation:pulse 1.5s infinite;"></div>
        <div style="font-size:11px; font-weight:700; color:#3D8B63; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:12px;">Claude Agent Orchestration Phase</div>
        <h2 style="font-family:var(--font-serif); font-size:24px; color:var(--text-main); margin:0 0 16px;">Specialized Agent Creation</h2>
        <p style="font-size:15px; color:var(--text-muted); max-width:500px; margin:0 auto; line-height:1.6;">
          Creating a specialized ${currentAnalysis.leadAgent?.id ?? 'Task'} Claude Agent optimized for this execution.
        </p>
        <div style="margin-top:24px; display:flex; justify-content:center; gap:8px;">
          <div style="padding:6px 12px; background:#F4F9F6; color:#3D8B63; border-radius:8px; font-size:11px; font-weight:700; border:1px solid #D1E7DD;">
            ${currentAnalysis.leadAgent?.icon ?? '🤖'} LEAD: ${(currentAnalysis.leadAgent?.id ?? 'AGENT').toUpperCase()}
          </div>
          ${currentAnalysis.skillMatches.length > 0 ? '<div style="padding:6px 12px; background:#2D2A26; color:white; border-radius:8px; font-size:11px; font-weight:700;">SKILL-OPTIMIZED</div>' : ''}
        </div>
      </div>
    </div>`;

  scrollBottom();

  setTimeout(() => {
    const c = getContainer();
    if (c) c.innerHTML = renderModeTabs('code') + renderAgentRunningCard(currentAnalysis!, 'running');
    simulateExecution();
  }, 2500);
}

function simulateExecution(): void {
  setTimeout(runNextStep, 500);
}

function runNextStep(): void {
  if (!currentAnalysis || !isExecuting) return;
  const steps = currentAnalysis.executionPlan.steps;

  if (currentStepIndex >= steps.length) {
    isExecuting = false;
    recordOutcome(currentAnalysis.taskType, 'success');
    const card = document.querySelector('.agent-running-card');
    if (card) card.outerHTML = renderAgentRunningCard(currentAnalysis, 'complete');
    scrollBottom();
    return;
  }

  const step = steps[currentStepIndex];
  const stepEl = document.getElementById(`step-${step.id}`);
  if (!stepEl) return;

  const intervention = evaluateIntervention(step, currentStepIndex, steps.length, currentAnalysis.complexity.riskLevel);
  if (intervention) {
    confidenceTrend.push(Math.max(0, 100 - Math.round(intervention.driftScore * 100)));
    if (confidenceTrend.length > 16) confidenceTrend.shift();
    renderInterventionBanner(intervention);
    if (intervention.escalateCheckpoint) {
      step.checkpoint = true;
      step.pauseReason = intervention.pauseReason ?? undefined;
    }
  } else {
    renderInterventionBanner(null);
  }

  stepEl.outerHTML = renderStep(step, 'running');

  setTimeout(() => {
    const el = document.getElementById(`step-${step.id}`);
    if (!el) return;
    if (step.checkpoint) {
      el.outerHTML = renderStep(step, 'paused');
    } else {
      el.outerHTML = renderStep(step, 'done');
      currentStepIndex++;
      runNextStep();
    }
  }, 1400);
}

export function continueExecution(stepId: number): void {
  if (!currentAnalysis || !isExecuting) return;
  const step = currentAnalysis.executionPlan.steps.find(s => s.id === stepId);
  if (!step) return;
  const el = document.getElementById(`step-${step.id}`);
  if (el) el.outerHTML = renderStep(step, 'done');
  currentStepIndex = currentAnalysis.executionPlan.steps.findIndex(s => s.id === stepId) + 1;
  setTimeout(runNextStep, 500);
}

export function manualStep(stepId: number): void {
  if (!currentAnalysis || !isExecuting) return;
  const step = currentAnalysis.executionPlan.steps.find(s => s.id === stepId);
  if (!step) return;
  const el = document.getElementById(`step-${step.id}`);
  if (el) {
    el.outerHTML = `
      <div id="step-${step.id}" style="border:1px solid #3D8B6322; border-radius:16px; padding:16px 20px; display:flex; gap:16px; align-items:center; background:#3D8B6308;">
        <div style="width:24px; height:24px; border-radius:50%; background:var(--accent-green); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h4 style="font-size:15px; font-weight:600; margin:0; color:var(--text-main);">${step.action}</h4>
            <span style="font-size:9px; font-weight:700; background:rgba(163,75,54,0.15); color:#A34B36; padding:2px 6px; border-radius:4px;">MANUAL OVERRIDE</span>
          </div>
          <p style="font-size:13px; color:var(--text-muted); margin:4px 0 0;">Step handled manually. Agent continues from next step.</p>
        </div>
      </div>`;
  }
  currentStepIndex = currentAnalysis.executionPlan.steps.findIndex(s => s.id === stepId) + 1;
  setTimeout(runNextStep, 350);
}

function runManual(): void {
  if (currentAnalysis) recordOutcome(currentAnalysis.taskType, 'manual');
  const container = getContainer();
  if (!container || !currentAnalysis) return;
  container.innerHTML = renderModeTabs('chat') + `
    <div style="width:100%; background:white; border:1px solid var(--border-light); border-radius:20px; padding:22px; margin-bottom:36px;">
      <div style="font-size:11px; font-weight:700; color:var(--text-muted); letter-spacing:0.6px; text-transform:uppercase; margin-bottom:8px;">Simple Chat Mode</div>
      <div style="font-size:16px; font-weight:600; color:var(--text-main); margin-bottom:8px;">Stayed in manual prompting</div>
      <div style="font-size:14px; color:var(--text-muted); line-height:1.6;">
        Here is a direct chat response for: "${currentAnalysis.mission}". I will keep this in simple prompt mode without agent orchestration.
      </div>
    </div>`;
  scrollBottom();
}

function modifyPrompt(): void {
  if (!currentAnalysis) return;
  reset(currentAnalysis.prompt);
}

export function reset(repopulate?: string): void {
  dom.messagesArea.innerHTML = '';
  dom.welcomeView.style.display = 'block';
  dom.chatView.style.display = 'none';
  currentAnalysis = null;
  isExecuting = false;
  currentStepIndex = 0;
  confidenceTrend = [];
  if (repopulate) {
    dom.promptInput.value = repopulate;
    dom.promptInput.focus();
    autoResize(dom.promptInput);
  } else {
    dom.promptInput.value = '';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Agent running card
// ---------------------------------------------------------------------------
function renderAgentRunningCard(analysis: PreFlightAnalysis, status: 'running' | 'complete'): string {
  const titleHtml = status === 'running'
    ? `<div class="ar-dot" style="width:8px; height:8px; background:var(--accent-orange); border-radius:50%; margin-right:12px; animation:pulse 1.5s infinite;"></div>
       <span style="font-size:18px; font-family:var(--font-serif); font-weight:500; color:var(--text-main);">Agent running</span>`
    : `<div style="color:var(--accent-orange); margin-right:12px; font-size:12px;">●</div>
       <span style="font-size:18px; font-family:var(--font-serif); font-weight:500; color:var(--text-main);">Execution complete</span>`;

  let html = `<div class="agent-running-card" style="width:100%; background:white; border:1px solid var(--border-light); border-radius:20px; box-shadow:0 8px 28px rgba(0,0,0,0.06); overflow:hidden; color:var(--text-main); margin-bottom:36px;">`;
  html += `
    <div style="background:#F9F9F8; padding:20px 24px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light);">
      <div style="display:flex; align-items:center;">${titleHtml}</div>
      <button onclick="window.App.reset()" style="font-size:12px; padding:6px 12px; color:var(--text-muted); background:transparent; border:none; display:flex; gap:6px; align-items:center; font-weight:500; cursor:pointer;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.43-11.44L2.5 8"/></svg>
        New task
      </button>
    </div>
    <div style="padding:24px; display:flex; flex-direction:column; gap:16px;">
      <div id="runtime-intervention-zone"></div>
      <div id="ar-steps" style="display:flex; flex-direction:column; gap:16px;">
        ${analysis.executionPlan.steps.map(s => renderStep(s, 'pending')).join('')}
      </div>`;

  if (status === 'complete') {
    html += `
      <div style="background:rgba(61,139,99,0.05); color:var(--text-main); padding:16px 20px; border-radius:12px; font-size:14px; display:flex; gap:12px; align-items:center; border:1px solid rgba(61,139,99,0.15);">
        <div style="width:24px; height:24px; border-radius:50%; background:var(--accent-green); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>Plan executed end-to-end. In a real session, this is where the agent would deliver results.</div>
      </div>`;
  }
  html += `</div></div>`;
  return html;
}

// ---------------------------------------------------------------------------
// Step render
// ---------------------------------------------------------------------------
function renderStep(step: ExecutionStep, status: 'pending' | 'running' | 'done' | 'paused'): string {
  let iconHtml = `<div style="width:24px; height:24px; border-radius:50%; border:1px solid var(--border-light); display:flex; align-items:center; justify-content:center; flex-shrink:0;"></div>`;
  let containerStyle = `border:1px solid var(--border-light); border-radius:12px; padding:16px; display:flex; gap:16px; align-items:flex-start;`;
  let extraHtml = '';

  if (status === 'done') {
    containerStyle = `border:1px solid #3D8B6322; border-radius:16px; padding:16px 20px; display:flex; gap:16px; align-items:center; background:#3D8B6308;`;
    iconHtml = `<div style="width:24px; height:24px; border-radius:50%; background:var(--accent-green); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>`;
  } else if (status === 'running') {
    iconHtml = `<div style="width:24px; height:24px; border-radius:50%; border:2px solid var(--border-light); border-top-color:var(--accent-orange); animation:spin 1s linear infinite; flex-shrink:0;"></div>`;
  } else if (status === 'paused') {
    containerStyle = `border:1px solid #ECA33544; border-radius:16px; padding:20px; display:flex; gap:16px; align-items:flex-start; background:#ECA33508; flex-direction:column;`;
    iconHtml = `<div style="width:24px; height:24px; border-radius:50%; background:var(--accent-yellow); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></div>`;
    extraHtml = `
      <div style="margin-top:10px; margin-bottom:12px; font-size:12px; color:#8A6115; background:rgba(236,163,53,0.12); border:1px solid rgba(236,163,53,0.25); border-radius:8px; padding:8px 10px;">
        ${step.pauseReason ?? 'Checkpoint reached. Review before continuing.'}
      </div>
      <div style="display:flex; align-items:center; gap:16px; width:100%;">
        <button style="padding:10px 24px; font-size:14px; font-weight:600; border-radius:24px; background:#D96C51; color:white; border:none; cursor:pointer; display:flex; align-items:center; gap:8px;"
          onclick="window.App.continueExecution(${step.id})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Approve &amp; continue
        </button>
        <button style="padding:10px 18px; font-size:13px; font-weight:600; border-radius:24px; background:white; color:#A34B36; border:1px solid #F0C7BA; cursor:pointer;"
          onclick="window.App.manualStep(${step.id})">
          Switch to manual
        </button>
        <span style="font-size:13px; color:var(--text-muted);">Paused for review</span>
      </div>`;
  }

  return `
    <div id="step-${step.id}" style="${containerStyle}">
      ${iconHtml}
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap:8px;">
          <h4 style="font-size:15px; font-weight:600; margin:0; color:var(--text-main);">${step.action}</h4>
          ${step.checkpoint ? `<span style="font-size:9px; font-weight:700; background:rgba(236,163,53,0.15); color:var(--accent-yellow); padding:2px 6px; border-radius:4px;">CHECKPOINT</span>` : ''}
          ${step.skillRef ? `<span style="font-size:10px; font-weight:700; color:white; background:var(--accent-orange); padding:2px 8px; border-radius:4px; letter-spacing:0.3px;">${step.skillRef}</span>` : ''}
        </div>
        <p style="font-size:13px; color:var(--text-muted); margin:4px 0 0; ${status === 'pending' ? 'opacity:0.5;' : ''}">${step.desc}</p>
        ${extraHtml}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Runtime intervention
// ---------------------------------------------------------------------------
function evaluateIntervention(step: ExecutionStep, index: number, total: number, missionRisk: string): RuntimeIntervention | null {
  const progressRatio = total > 0 ? index / total : 0;
  const baseDrift = step.risk === 'high' ? 0.52 : step.risk === 'medium' ? 0.34 : 0.18;
  const missionMult = missionRisk === 'high' ? 1.25 : missionRisk === 'medium' ? 1.05 : 0.9;
  const latePressure = progressRatio > 0.65 ? 0.12 : 0;
  const driftScore = Math.min(0.95, baseDrift * missionMult + latePressure);

  if (driftScore >= 0.6) {
    return { level: 'high', driftScore, message: 'Confidence dropped during runtime. Escalating to human checkpoint.', recommendation: 'Review output, tighten constraints, or switch this step to manual.', escalateCheckpoint: true, pauseReason: `Confidence drift (${driftToLevel(driftScore)}). Recommend review before continuing.` };
  }
  if (driftScore >= 0.45) {
    return { level: 'medium', driftScore, message: 'Potential execution drift detected. Verify assumptions at this step.', recommendation: 'Optional: add constraints or convert next step to manual review.', escalateCheckpoint: false, pauseReason: null };
  }
  return null;
}

function renderInterventionBanner(intervention: RuntimeIntervention | null): void {
  const zone = document.getElementById('runtime-intervention-zone');
  if (!zone) return;
  if (!intervention) { zone.innerHTML = ''; return; }

  const palette = intervention.level === 'high'
    ? { bg: '#FFF5F2', border: '#F0C7BA', title: '#A34B36' }
    : { bg: '#FFF9F0', border: '#F4DCB0', title: '#8A6115' };
  const sparkline = buildSparkline(confidenceTrend);

  zone.innerHTML = `
    <div style="padding:12px 14px; border-radius:10px; border:1px solid ${palette.border}; background:${palette.bg};">
      <div style="font-size:11px; font-weight:700; letter-spacing:0.4px; color:${palette.title}; margin-bottom:6px;">
        PROACTIVE INTERVENTION · DRIFT ${driftToLevel(intervention.driftScore)}
      </div>
      <div style="font-size:11px; color:#6B7280; margin-bottom:6px; display:flex; align-items:center; gap:8px;">
        <span>Confidence trend</span>
        <span style="font-family:monospace; letter-spacing:-0.5px;">${sparkline}</span>
      </div>
      <div style="font-size:13px; color:#4B5563; margin-bottom:4px;">${intervention.message}</div>
      <div style="font-size:12px; color:#6B7280;">${intervention.recommendation}</div>
    </div>`;
}

function buildSparkline(points: number[]): string {
  if (!points.length) return '▁';
  const levels = '▁▂▃▄▅▆▇█';
  return points.map(p =>
    levels[Math.min(levels.length - 1, Math.floor((Math.max(0, Math.min(100, p)) / 100) * (levels.length - 1)))]
  ).join('');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init(): void {
  renderQuickPrompts();
  dom.btnSend.addEventListener('click', () => void handleSubmit());
  dom.promptInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit(); }
  });
  dom.promptInput.addEventListener('input', () => autoResize(dom.promptInput));
  dom.quickPrompts.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest('.quick-prompt') as HTMLButtonElement | null;
    if (btn?.dataset['prompt']) {
      dom.promptInput.value = btn.dataset['prompt'];
      autoResize(dom.promptInput);
      dom.promptInput.focus();
    }
  });
}

declare global {
  interface Window {
    App: { reset: (p?: string) => void; continueExecution: (id: number) => void; manualStep: (id: number) => void; };
  }
}
window.App = { reset, continueExecution, manualStep };

init();

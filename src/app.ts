import { recordOutcome } from './engine';
import type { ExecutionStep, RuntimeIntervention } from './types';

// ─── Scenario data ────────────────────────────────────────────────────────────

interface ConstraintCard {
  type: 'guardrail' | 'scope' | 'preference';
  label: string;
  title: string;
  quote: string;
}

interface SkillCard {
  name: string;
  saving: string;
  desc: string;
}

interface PlanStep {
  title: string;
  desc: string;
  skill?: string;
}

interface Scenario {
  id: string;
  tabLabel: string;
  prompt: string;
  files: Array<{ name: string; icon: 'file' | 'folder' }>;
  q1: {
    confidence: 'high' | 'medium' | 'low';
    mode: 'agent' | 'skill' | 'manual';
    modeIcon: string;
    title: string;
    subtitle: string;
    reasoning: string; // HTML with <span class="hl-*"> highlights
  };
  q2: {
    count: number;
    constraints: ConstraintCard[];
  };
  q3: {
    savings: string;
    skills: SkillCard[];
  };
  metrics: { tokens: string; latency: string; toolCalls: string };
  plan: PlanStep[];
  risks: string;
  // used to drive the execution simulation
  execSteps: ExecutionStep[];
  taskType: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'refactor',
    tabLabel: 'Refactor — don\'t change features',
    prompt: 'Refactor the authentication module for readability. Don\'t change any user-facing behavior, keep all existing tests passing, and don\'t touch the database schema.',
    files: [
      { name: 'src/auth/', icon: 'folder' },
      { name: 'tests/auth.spec.ts', icon: 'file' },
    ],
    q1: {
      confidence: 'high',
      mode: 'agent',
      modeIcon: '🗂',
      title: 'Run as Agent',
      subtitle: 'Multi-step delegation',
      reasoning: 'Multi-file edits across a known directory with <span class="hl-green">verifiable success criteria (tests)</span>. Strong fit for an <span class="hl-orange">agent loop</span>.',
    },
    q2: {
      count: 3,
      constraints: [
        { type: 'guardrail', label: 'GUARDRAIL', title: 'No behavior changes', quote: '"Don\'t change any user-facing behavior"' },
        { type: 'guardrail', label: 'GUARDRAIL', title: 'Tests must stay green', quote: '"keep all existing tests passing"' },
        { type: 'scope',     label: 'SCOPE',     title: 'Schema is off-limits', quote: '"don\'t touch the database schema"' },
      ],
    },
    q3: {
      savings: '~60% fewer tokens',
      skills: [
        { name: 'test-runner', saving: '-38% tokens', desc: 'Run the auth test suite after each edit batch — catches regressions before the next loop.' },
        { name: 'code-map',    saving: '-22% tokens', desc: 'Build a one-shot dependency graph of src/auth/ so the agent edits with full context, not file-by-file discovery.' },
      ],
    },
    metrics: { tokens: '42.0k–78.0k', latency: '95–180s', toolCalls: '18–34' },
    plan: [
      { title: 'Map the module', desc: 'Index src/auth/ files and their cross-references.', skill: 'code-map skill' },
      { title: 'Propose refactor diff', desc: 'Generate a single coherent diff, not incremental edits.' },
      { title: 'Run tests', desc: 'Execute auth.spec.ts; loop only on failures.', skill: 'test-runner skill' },
      { title: 'Summarize changes', desc: 'List files touched + behavior-preservation notes.' },
    ],
    risks: 'Agent may attempt schema-adjacent changes if auth touches user table — Compass will block edits to /db/* paths.',
    taskType: 'refactor',
    execSteps: [
      { id: 1, action: 'Map the module', desc: 'Index src/auth/ files and their cross-references.', checkpoint: false, risk: 'low', skillRef: 'code-map skill' },
      { id: 2, action: 'Propose refactor diff', desc: 'Generate a single coherent diff, not incremental edits.', checkpoint: true, risk: 'medium' },
      { id: 3, action: 'Run tests', desc: 'Execute auth.spec.ts; loop only on failures.', checkpoint: false, risk: 'low', skillRef: 'test-runner skill' },
      { id: 4, action: 'Summarize changes', desc: 'List files touched + behavior-preservation notes.', checkpoint: false, risk: 'low' },
    ],
  },
  {
    id: 'analyze',
    tabLabel: 'Analyze CSV + report',
    prompt: 'Look at sales_q3.csv and tell me which regions are underperforming. Use the existing chart styling from /branding/charts.md.',
    files: [
      { name: 'sales_q3.csv (2.1 MB)', icon: 'file' },
      { name: '/branding/charts.md',   icon: 'file' },
    ],
    q1: {
      confidence: 'high',
      mode: 'skill',
      modeIcon: '◈',
      title: 'Prompt + Skill',
      subtitle: 'Skill-assisted, no agent loop',
      reasoning: 'Analysis itself is <span class="hl-blue">one-shot reasoning</span> — but reading a 2.1 MB CSV and applying a brand spec benefits from a <span class="hl-orange">focused skill</span>, not a full agent loop.',
    },
    q2: {
      count: 2,
      constraints: [
        { type: 'preference', label: 'PREFERENCE', title: 'Use brand chart spec', quote: '"existing chart styling from /branding/charts.md"' },
        { type: 'scope',      label: 'SCOPE',      title: 'Single artifact expected', quote: '"tell me which regions are underperforming"' },
      ],
    },
    q3: {
      savings: '~85% fewer tokens',
      skills: [
        { name: 'csv-analyst',  saving: '-71% tokens', desc: 'Streams the CSV server-side instead of loading 2.1 MB into context. Roughly 60k tokens saved.' },
        { name: 'brand-charts', saving: '-14% tokens', desc: 'Pre-loads /branding/charts.md once and applies it to all generated visuals.' },
      ],
    },
    metrics: { tokens: '9.0k–16.0k', latency: '22–45s', toolCalls: '3–6' },
    plan: [
      { title: 'Stream CSV', desc: 'Read sales_q3.csv in chunks, aggregate by region.', skill: 'csv-analyst skill' },
      { title: 'Load brand spec', desc: 'Pull chart config from /branding/charts.md.', skill: 'brand-charts skill' },
      { title: 'Generate report', desc: 'Identify underperforming regions and apply brand chart styling.' },
    ],
    risks: 'CSV may contain PII — Compass will not log raw row data. Chart output is markdown-only; no image generation.',
    taskType: 'analysis',
    execSteps: [
      { id: 1, action: 'Stream CSV', desc: 'Read sales_q3.csv in chunks, aggregate by region.', checkpoint: false, risk: 'low', skillRef: 'csv-analyst skill' },
      { id: 2, action: 'Load brand spec', desc: 'Pull chart config from /branding/charts.md.', checkpoint: false, risk: 'low', skillRef: 'brand-charts skill' },
      { id: 3, action: 'Generate report', desc: 'Identify underperforming regions and apply chart styling.', checkpoint: false, risk: 'low' },
    ],
  },
  {
    id: 'feature',
    tabLabel: 'Build a new feature end-to-end',
    prompt: 'Add a referral program: invite link, signup attribution, dashboard widget showing top 10 referrers. Optimize for cost on the backend.',
    files: [
      { name: 'src/', icon: 'folder' },
      { name: 'supabase/', icon: 'folder' },
    ],
    q1: {
      confidence: 'medium',
      mode: 'agent',
      modeIcon: '🗂',
      title: 'Run as Agent',
      subtitle: 'Multi-step delegation',
      reasoning: 'Spans <span class="hl-orange">schema, backend, frontend</span>, and a measurable goal. Too broad for prompting; agent must <span class="hl-blue">plan in stages</span>.',
    },
    q2: {
      count: 2,
      constraints: [
        { type: 'preference', label: 'PREFERENCE', title: 'Cost-aware backend', quote: '"Optimize for cost on the backend"' },
        { type: 'scope',      label: 'SCOPE',      title: 'Top-10 only', quote: '"top 10 referrers"' },
      ],
    },
    q3: {
      savings: '~74% fewer tokens',
      skills: [
        { name: 'schema-planner',   saving: '-31% tokens', desc: 'Drafts and validates the migration before any code is written. Avoids mid-build schema rewrites.' },
        { name: 'ui-component-lib', saving: '-19% tokens', desc: 'Reuses existing dashboard widget patterns instead of generating from scratch.' },
        { name: 'test-runner',      saving: '-24% tokens', desc: 'Validates each stage so the agent doesn\'t compound errors across 4 layers.' },
      ],
    },
    metrics: { tokens: '180k–320k', latency: '420–900s', toolCalls: '65–120' },
    plan: [
      { title: 'Draft schema', desc: 'Plan referral tables + indexes, validate migration.', skill: 'schema-planner skill' },
      { title: 'Backend API', desc: 'Invite link generation + signup attribution endpoints.' },
      { title: 'Dashboard widget', desc: 'Top-10 referrer widget using existing component library.', skill: 'ui-component-lib skill' },
      { title: 'Cost optimization', desc: 'Review query plans, add caching layer.', skill: 'test-runner skill' },
    ],
    risks: 'Feature spans 4 layers — schema errors compound. Compass will checkpoint after each layer before proceeding.',
    taskType: 'multi_step',
    execSteps: [
      { id: 1, action: 'Draft schema', desc: 'Plan referral tables + indexes, validate migration.', checkpoint: true, risk: 'high', skillRef: 'schema-planner skill' },
      { id: 2, action: 'Backend API', desc: 'Invite link generation + signup attribution endpoints.', checkpoint: true, risk: 'medium' },
      { id: 3, action: 'Dashboard widget', desc: 'Top-10 referrer widget using existing component library.', checkpoint: false, risk: 'medium', skillRef: 'ui-component-lib skill' },
      { id: 4, action: 'Cost optimization', desc: 'Review query plans, add caching layer.', checkpoint: true, risk: 'medium', skillRef: 'test-runner skill' },
    ],
  },
];

// ─── State ────────────────────────────────────────────────────────────────────
let activeScenario: Scenario = SCENARIOS[0]!;
let hasAnalyzed = false;
let isExecuting = false;
let currentStepIndex = 0;
let confidenceTrend: number[] = [];

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dom = {
  scenarioTabs:    $('scenario-tabs'),
  promptText:      $('prompt-text'),
  fileChips:       $('file-chips'),
  btnSend:         $('btn-send'),
  resultsSection:  $('results-section'),
  loadingState:    $('loading-state'),
  loadingSub:      $('loading-sub'),
  preflightContent:$('preflight-content'),
  colQ1:           $('col-q1'),
  colQ2:           $('col-q2'),
  colQ3:           $('col-q3'),
  metricsBar:      $('metrics-bar'),
  advancedBody:    $('advanced-body'),
  btnRunAgent:     $('btn-run-agent'),
  btnTune:         $('btn-tune'),
  executionView:   $('execution-view'),
  executionContent:$('execution-content'),
};

// ─── Init ─────────────────────────────────────────────────────────────────────
function init(): void {
  renderTabs();
  loadScenario(SCENARIOS[0]!);

  dom.btnSend.addEventListener('click', handleAnalyze);
  dom.btnRunAgent.addEventListener('click', handleRunAgent);
  dom.btnTune.addEventListener('click', handleTune);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function renderTabs(): void {
  dom.scenarioTabs.innerHTML = SCENARIOS.map(s => `
    <button class="scenario-tab${s.id === activeScenario.id ? ' active' : ''}" data-id="${s.id}">
      ${s.tabLabel}
    </button>`).join('');

  dom.scenarioTabs.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest('.scenario-tab') as HTMLButtonElement | null;
    if (!btn) return;
    const s = SCENARIOS.find(x => x.id === btn.dataset['id']);
    if (!s) return;
    activeScenario = s;
    loadScenario(s);
  });
}

function updateTabActive(): void {
  dom.scenarioTabs.querySelectorAll('.scenario-tab').forEach(el => {
    const btn = el as HTMLButtonElement;
    btn.classList.toggle('active', btn.dataset['id'] === activeScenario.id);
  });
}

// ─── Load scenario ─────────────────────────────────────────────────────────────
function loadScenario(s: Scenario): void {
  activeScenario = s;
  hasAnalyzed = false;
  updateTabActive();

  // Prompt text
  dom.promptText.textContent = s.prompt;

  // File chips
  dom.fileChips.innerHTML = s.files.map(f => `
    <span class="file-chip">
      ${f.icon === 'folder'
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>'
      }
      ${f.name}
    </span>`).join('');

  // Hide results if visible
  dom.resultsSection.style.display = 'none';
  dom.executionView.style.display = 'none';
}

// ─── Analyze ──────────────────────────────────────────────────────────────────
async function handleAnalyze(): Promise<void> {
  if (isExecuting) return;

  dom.resultsSection.style.display = 'flex';
  dom.resultsSection.style.flexDirection = 'column';
  dom.resultsSection.style.gap = '16px';
  dom.executionView.style.display = 'none';
  dom.loadingState.style.display = 'block';
  dom.preflightContent.style.display = 'none';

  const stages = [
    'Running RAG retrieval from skill bank…',
    'Classifying intent and estimating risk…',
    'Extracting constraints from prompt…',
    'Surfacing skill opportunities…',
  ];
  let si = 0;
  dom.loadingSub.textContent = stages[0]!;
  const tick = setInterval(() => {
    si = (si + 1) % stages.length;
    dom.loadingSub.textContent = stages[si]!;
  }, 600);

  await new Promise(r => setTimeout(r, 2200));
  clearInterval(tick);

  dom.loadingState.style.display = 'none';
  renderPreflight(activeScenario);
  dom.preflightContent.style.display = 'block';
  hasAnalyzed = true;
  window.scrollTo({ top: dom.resultsSection.offsetTop - 20, behavior: 'smooth' });
}

// ─── Render preflight ─────────────────────────────────────────────────────────
function renderPreflight(s: Scenario): void {
  renderQ1(s);
  renderQ2(s);
  renderQ3(s);
  renderMetrics(s);
  renderAdvanced(s);
}

function renderQ1(s: Scenario): void {
  dom.colQ1.innerHTML = `
    <div class="q-col-label">
      Q1 · SHOULD THIS BE AGENTIC?
      <span class="q-confidence">confidence: ${s.q1.confidence}</span>
    </div>
    <div class="q1-header">
      <div class="q1-mode-icon ${s.q1.mode}">${s.q1.modeIcon}</div>
      <div>
        <div class="q1-title">${s.q1.title}</div>
        <div class="q1-subtitle">${s.q1.subtitle}</div>
      </div>
    </div>
    <div class="q1-reasoning">${s.q1.reasoning}</div>`;
}

function renderQ2(s: Scenario): void {
  dom.colQ2.innerHTML = `
    <div class="q-col-label">
      Q2 · WHICH CONSTRAINTS ARE ACTIVE?
      <span class="q-confidence">${s.q2.count} detected</span>
    </div>
    ${s.q2.constraints.map(c => `
      <div class="constraint-card ${c.type}">
        <div class="constraint-type-row">
          <span class="constraint-type-badge">
            <span class="badge-dot"></span>${c.label}
          </span>
          <span class="constraint-title">${c.title}</span>
        </div>
        <div class="constraint-quote">${c.quote}</div>
      </div>`).join('')}`;
}

function renderQ3(s: Scenario): void {
  dom.colQ3.innerHTML = `
    <div class="q-col-label">
      Q3 · SKILL OPPORTUNITIES
      <span class="q3-savings-badge">${s.q3.savings}</span>
    </div>
    ${s.q3.skills.map((sk, i) => `
      <div class="skill-card">
        <div class="skill-icon">⚡</div>
        <div class="skill-body">
          <div class="skill-name-row">
            <span class="skill-name">${sk.name}</span>
            <span class="skill-saving">${sk.saving}</span>
          </div>
          <div class="skill-desc">${sk.desc}</div>
        </div>
        <button class="skill-add-btn" data-skill-idx="${i}" title="Add skill">+</button>
      </div>`).join('')}`;

  dom.colQ3.querySelectorAll('.skill-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      if (b.classList.contains('added')) return;
      b.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
      b.classList.add('added');
      b.title = 'Skill added';
    });
  });
}

function renderMetrics(s: Scenario): void {
  dom.metricsBar.innerHTML = `
    <div class="metric-cell">
      <div class="metric-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        TOKENS
      </div>
      <div class="metric-value">${s.metrics.tokens}</div>
    </div>
    <div class="metric-cell">
      <div class="metric-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        LATENCY
      </div>
      <div class="metric-value">${s.metrics.latency}</div>
    </div>
    <div class="metric-cell">
      <div class="metric-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        TOOL CALLS
      </div>
      <div class="metric-value">${s.metrics.toolCalls}</div>
    </div>`;
}

function renderAdvanced(s: Scenario): void {
  dom.advancedBody.innerHTML = `
    <div>
      <div class="adv-section-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        Execution plan
      </div>
      ${s.plan.map((step, i) => `
        <div class="plan-step">
          <div class="plan-num">${i + 1}</div>
          <div class="plan-body">
            <div class="plan-title">${step.title}</div>
            <div class="plan-desc">${step.desc}</div>
            ${step.skill ? `<span class="plan-skill-tag">${step.skill}</span>` : ''}
          </div>
        </div>`).join('')}
    </div>
    <div>
      <div class="adv-section-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Risks Compass will manage
      </div>
      <div class="risk-box">${s.risks}</div>
    </div>`;
}

// ─── Tune plan ────────────────────────────────────────────────────────────────
function handleTune(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => dom.btnSend.focus(), 400);
}

// ─── Agent execution ──────────────────────────────────────────────────────────
function handleRunAgent(): void {
  if (!hasAnalyzed || isExecuting) return;
  isExecuting = true;
  currentStepIndex = 0;
  confidenceTrend = [];

  dom.resultsSection.style.display = 'none';
  dom.executionView.style.display = 'block';
  dom.executionContent.innerHTML = renderExecCard('running');
  window.scrollTo({ top: dom.executionView.offsetTop - 20, behavior: 'smooth' });

  setTimeout(runNextStep, 600);
}

function renderExecCard(status: 'running' | 'complete'): string {
  const s = activeScenario;
  const dotHtml = status === 'running'
    ? `<span style="width:9px;height:9px;border-radius:50%;background:var(--orange);display:inline-block;margin-right:10px;animation:pulse 1.4s infinite;"></span>`
    : `<span style="width:9px;height:9px;border-radius:50%;background:var(--green);display:inline-block;margin-right:10px;"></span>`;
  const titleText = status === 'running' ? 'Agent running' : 'Execution complete';

  return `
    <div class="exec-header">
      <div class="exec-title">${dotHtml}${titleText}</div>
      <button class="exec-new-task" onclick="window.App.reset()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.43-11.44L2.5 8"/></svg>
        New task
      </button>
    </div>
    <div class="exec-body" id="exec-body">
      <div id="intervention-zone"></div>
      ${s.execSteps.map(step => renderExecStep(step, 'pending')).join('')}
      ${status === 'complete' ? `
        <div class="exec-complete-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Plan executed end-to-end. In a real session, the agent would deliver results here.
        </div>` : ''}
    </div>`;
}

function renderExecStep(step: ExecutionStep, status: 'pending' | 'running' | 'done' | 'paused'): string {
  let iconHtml = `<div class="exec-step-icon"></div>`;
  let extraClass = '';
  let extraHtml = '';

  if (status === 'done') {
    extraClass = 'done';
    iconHtml = `<div class="exec-step-icon done"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>`;
  } else if (status === 'running') {
    iconHtml = `<div class="exec-step-icon running"></div>`;
  } else if (status === 'paused') {
    extraClass = 'paused';
    iconHtml = `<div class="exec-step-icon paused"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></div>`;
    extraHtml = `
      <div class="exec-pause-reason">${step.pauseReason ?? 'Checkpoint reached — review before continuing.'}</div>
      <div class="exec-pause-actions">
        <button class="exec-approve-btn" onclick="window.App.continueExecution(${step.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Approve &amp; continue
        </button>
        <button class="exec-manual-btn" onclick="window.App.manualStep(${step.id})">Switch to manual</button>
        <span class="exec-pause-note">Paused for your review</span>
      </div>`;
  }

  const opacity = status === 'pending' ? 'opacity:0.45;' : '';

  return `
    <div class="exec-step ${extraClass}" id="exec-step-${step.id}">
      ${iconHtml}
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px;">
          <span class="exec-step-title">${step.action}</span>
          ${step.checkpoint ? '<span class="exec-checkpoint-badge">CHECKPOINT</span>' : ''}
          ${step.skillRef ? `<span class="exec-skill-badge">${step.skillRef}</span>` : ''}
        </div>
        <div class="exec-step-desc" style="${opacity}">${step.desc}</div>
        ${extraHtml}
      </div>
    </div>`;
}

function runNextStep(): void {
  const steps = activeScenario.execSteps;
  if (currentStepIndex >= steps.length) {
    isExecuting = false;
    recordOutcome(activeScenario.taskType, 'success');
    dom.executionContent.innerHTML = renderExecCard('complete');
    return;
  }

  const step = steps[currentStepIndex]!;
  const stepEl = document.getElementById(`exec-step-${step.id}`);
  if (!stepEl) return;

  const intervention = evaluateIntervention(step, currentStepIndex, steps.length);
  if (intervention) {
    confidenceTrend.push(Math.max(0, 100 - Math.round(intervention.driftScore * 100)));
    if (confidenceTrend.length > 12) confidenceTrend.shift();
    renderIntervention(intervention);
    if (intervention.escalateCheckpoint) {
      step.checkpoint = true;
      step.pauseReason = `Confidence drift (${driftLevel(intervention.driftScore)}). Review before proceeding.`;
    }
  } else {
    const zone = document.getElementById('intervention-zone');
    if (zone) zone.innerHTML = '';
  }

  stepEl.outerHTML = renderExecStep(step, 'running');

  setTimeout(() => {
    const el = document.getElementById(`exec-step-${step.id}`);
    if (!el) return;
    if (step.checkpoint) {
      el.outerHTML = renderExecStep(step, 'paused');
    } else {
      el.outerHTML = renderExecStep(step, 'done');
      currentStepIndex++;
      runNextStep();
    }
  }, 1500);
}

export function continueExecution(stepId: number): void {
  const step = activeScenario.execSteps.find(s => s.id === stepId);
  if (!step) return;
  const el = document.getElementById(`exec-step-${step.id}`);
  if (el) el.outerHTML = renderExecStep(step, 'done');
  currentStepIndex = activeScenario.execSteps.findIndex(s => s.id === stepId) + 1;
  setTimeout(runNextStep, 500);
}

export function manualStep(stepId: number): void {
  const step = activeScenario.execSteps.find(s => s.id === stepId);
  if (!step) return;
  const el = document.getElementById(`exec-step-${step.id}`);
  if (el) {
    el.outerHTML = `
      <div class="exec-step done" id="exec-step-${step.id}">
        <div class="exec-step-icon done"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div>
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px;">
            <span class="exec-step-title">${step.action}</span>
            <span style="font-size:9px;font-weight:700;background:var(--red-bg);color:var(--red);border:1px solid var(--red-bd);border-radius:4px;padding:1px 6px;">MANUAL OVERRIDE</span>
          </div>
          <div class="exec-step-desc">Step handled manually. Agent continues from next step.</div>
        </div>
      </div>`;
  }
  currentStepIndex = activeScenario.execSteps.findIndex(s => s.id === stepId) + 1;
  setTimeout(runNextStep, 400);
}

export function reset(): void {
  isExecuting = false;
  currentStepIndex = 0;
  confidenceTrend = [];
  hasAnalyzed = false;
  dom.resultsSection.style.display = 'none';
  dom.executionView.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Intervention ─────────────────────────────────────────────────────────────
function evaluateIntervention(step: ExecutionStep, index: number, total: number): RuntimeIntervention | null {
  const ratio = total > 0 ? index / total : 0;
  const base = step.risk === 'high' ? 0.55 : step.risk === 'medium' ? 0.36 : 0.18;
  const riskMult = activeScenario.q1.confidence === 'medium' ? 1.15 : 0.9;
  const late = ratio > 0.65 ? 0.1 : 0;
  const score = Math.min(0.95, base * riskMult + late);

  if (score >= 0.6) return { level: 'high', driftScore: score, message: 'Confidence dropped. Escalating to human checkpoint before proceeding.', recommendation: 'Review output or tighten constraints.', escalateCheckpoint: true, pauseReason: null };
  if (score >= 0.45) return { level: 'medium', driftScore: score, message: 'Execution drift detected. Recommend verifying assumptions.', recommendation: 'Optional: convert next step to manual review.', escalateCheckpoint: false, pauseReason: null };
  return null;
}

function renderIntervention(iv: RuntimeIntervention): void {
  const zone = document.getElementById('intervention-zone');
  if (!zone) return;
  const sparkline = buildSparkline(confidenceTrend);
  const isHigh = iv.level === 'high';
  zone.innerHTML = `
    <div class="exec-intervention ${iv.level}">
      <div class="exec-intervention-label">
        PROACTIVE INTERVENTION · DRIFT ${driftLevel(iv.driftScore)}
        <span style="font-family:monospace;font-size:11px;margin-left:8px;">${sparkline}</span>
      </div>
      <div style="font-size:13px;color:${isHigh ? 'var(--red)' : '#8A6000'};margin-bottom:3px;">${iv.message}</div>
      <div style="font-size:12px;color:var(--muted);">${iv.recommendation}</div>
    </div>`;
}

function driftLevel(score: number): string { return score >= 0.6 ? 'High' : score >= 0.45 ? 'Medium' : 'Low'; }

function buildSparkline(pts: number[]): string {
  if (!pts.length) return '▁';
  const L = '▁▂▃▄▅▆▇█';
  return pts.map(p => L[Math.min(L.length - 1, Math.floor((Math.max(0, Math.min(100, p)) / 100) * (L.length - 1)))]).join('');
}

// ─── Globals for inline onclick ───────────────────────────────────────────────
declare global {
  interface Window {
    App: { reset: () => void; continueExecution: (id: number) => void; manualStep: (id: number) => void; };
  }
}
window.App = { reset, continueExecution, manualStep };

init();

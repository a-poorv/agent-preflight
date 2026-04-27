import type {
  Skill, Constraint, ExecutionStep, ExecutionPlan,
  OptimizationProfile, AgentSetupQuestion, LearningProfile,
  LeadAgent, PreFlightAnalysis, SuggestedSkill, Complexity,
} from './types';
import LLMService from './llm-service';

// ---------------------------------------------------------------------------
// Skill Bank (server-synced, localStorage fallback)
// ---------------------------------------------------------------------------
const DEFAULT_SKILLS: Skill[] = [
  { name: 'Home Page Patterns', pattern: 'home page', ref: '/home-skill.md', efficiency: 15 },
  { name: 'Auth Protocol', pattern: 'login|auth|sign up', ref: '/auth-skill.md', efficiency: 20 },
  { name: 'UI Standards', pattern: 'design|layout|css|style', ref: '/ui-skill.md', efficiency: 10 },
];

let LOCAL_SKILL_BANK: Skill[] = JSON.parse(
  localStorage.getItem('preflight_skills') ?? JSON.stringify(DEFAULT_SKILLS)
) as Skill[];

async function syncSkillsFromServer(): Promise<void> {
  try {
    const res = await fetch('/api/skills');
    if (res.ok) {
      const data = await res.json() as { skills: Skill[] };
      LOCAL_SKILL_BANK = data.skills;
      localStorage.setItem('preflight_skills', JSON.stringify(LOCAL_SKILL_BANK));
    }
  } catch {
    // server not available — use localStorage copy
  }
}

export async function saveSkillToServer(skill: Skill): Promise<void> {
  LOCAL_SKILL_BANK.push(skill);
  localStorage.setItem('preflight_skills', JSON.stringify(LOCAL_SKILL_BANK));
  try {
    await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill),
    });
  } catch {
    // server not available — localStorage already updated
  }
}

export async function updateSkillOnServer(ref: string, updates: Partial<Skill>): Promise<void> {
  LOCAL_SKILL_BANK = LOCAL_SKILL_BANK.map(s =>
    s.ref === ref ? { ...s, ...updates } : s
  );
  localStorage.setItem('preflight_skills', JSON.stringify(LOCAL_SKILL_BANK));
  try {
    await fetch(`/api/skills/${encodeURIComponent(ref)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch { /* noop */ }
}

export async function deleteSkillFromServer(ref: string): Promise<void> {
  LOCAL_SKILL_BANK = LOCAL_SKILL_BANK.filter(s => s.ref !== ref);
  localStorage.setItem('preflight_skills', JSON.stringify(LOCAL_SKILL_BANK));
  try {
    await fetch(`/api/skills/${encodeURIComponent(ref)}`, { method: 'DELETE' });
  } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Vector Store (RAG simulation)
// ---------------------------------------------------------------------------
const EMBEDDINGS: Record<string, string[]> = {
  'ui-standards': ['consistent', 'style', 'design', 'layout', 'css', 'theme', 'look and feel', 'brand'],
  'clean-code': ['refactor', 'standard', 'clean', 'quality', 'patterns', 'technical debt', 'readable'],
  'auth-protocol': ['login', 'security', 'authentication', 'permission', 'access', 'oauth', 'password'],
  'architecture': ['setup', 'agent', 'orchestration', 'structure', 'module', 'system design'],
  'claude-agent': ['claude', 'anthropic', 'agent', 'sonnet', 'opus', 'haiku', 'tool use', 'pre-flight'],
};

function vectorSearch(query: string, topK = 1): Array<{ id: string; score: number }> {
  const lower = query.toLowerCase();
  return Object.entries(EMBEDDINGS)
    .map(([id, terms]) => ({ id, score: terms.filter(t => lower.includes(t)).length }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ---------------------------------------------------------------------------
// Agent Orchestrator
// ---------------------------------------------------------------------------
const AGENTS: Record<string, { icon: string; directive: string }> = {
  ArchitectAgent: { icon: '🏛️', directive: 'Focus on structural integrity and cross-module consistency.' },
  DevAgent: { icon: '💻', directive: 'Focus on clean implementation and following operational skills.' },
  DebugAgent: { icon: '🔍', directive: 'Focus on root cause analysis and minimal regression risk.' },
  SecurityAgent: { icon: '🛡️', directive: 'Focus on authentication flow and data boundary protection.' },
};

function assignAgent(taskType: string, intents: Array<{ id: string }>): LeadAgent {
  if (intents.some(i => i.id === 'auth-protocol')) return { id: 'SecurityAgent', ...AGENTS.SecurityAgent };
  if (taskType === 'debugging') return { id: 'DebugAgent', ...AGENTS.DebugAgent };
  if (taskType === 'code_gen' && intents.some(i => i.id === 'architecture')) return { id: 'ArchitectAgent', ...AGENTS.ArchitectAgent };
  return { id: 'DevAgent', ...AGENTS.DevAgent };
}

// ---------------------------------------------------------------------------
// Task classification
// ---------------------------------------------------------------------------
const TASK_PATTERNS: Record<string, { keywords: string[]; label: string; icon: string; color: string }> = {
  debugging: { keywords: ['debug', 'fix', 'error', 'bug', 'issue', 'exception', 'crash'], label: 'Debugging', icon: '🐛', color: '#D96C51' },
  code_gen: { keywords: ['build', 'create', 'write', 'generate', 'make', 'develop', 'design', 'layout', 'ui', 'page', 'component'], label: 'Generation', icon: '✨', color: '#ECA335' },
  refactor: { keywords: ['refactor', 'restructure', 'clean up', 'optimize', 'rewrite'], label: 'Refactoring', icon: '♻️', color: '#3D8B63' },
  analysis: { keywords: ['explain', 'understand', 'how does', 'what is', 'read', 'analyze'], label: 'Analysis', icon: '🔍', color: '#6B6863' },
  research: { keywords: ['research', 'compare', 'evaluate', 'find', 'search'], label: 'Research', icon: '📚', color: '#5B76A6' },
  multi_step: { keywords: ['pipeline', 'workflow', 'end-to-end', 'full stack', 'setup'], label: 'Complex workflow', icon: '🗺️', color: '#D96C51' },
  simple_qa: { keywords: ['what', 'how', 'why', 'who', 'where', 'when', 'can you'], label: 'Simple Question', icon: '❓', color: '#6B6863' },
};

function classifyTask(prompt: string): { type: string; label: string; icon: string } {
  const lower = prompt.toLowerCase();
  for (const [type, config] of Object.entries(TASK_PATTERNS)) {
    if (config.keywords.some(k => lower.includes(k))) {
      return { type, label: config.label, icon: config.icon };
    }
  }
  return { type: 'code_gen', label: 'Generation', icon: '✨' };
}

// ---------------------------------------------------------------------------
// Constraint extraction
// ---------------------------------------------------------------------------
const CONSTRAINT_REGEXES: Array<{ regex: RegExp; type: Constraint['type'] }> = [
  { regex: /only\s+(use|modify|change|edit)\s+(.+)/gi, type: 'explicit' },
  { regex: /keep\s+(.+?)\s+(unchanged|intact|as is|original)/gi, type: 'explicit' },
  { regex: /preserve\s+(.+)/gi, type: 'boundary' },
  { regex: /without\s+(breaking|changing|modifying|altering)\s+(.+)/gi, type: 'boundary' },
  { regex: /don'?t\s+(break|change|modify|edit|alter|touch|affect)\s+(.+)/gi, type: 'boundary' },
  { regex: /avoid\s+(.+)/gi, type: 'boundary' },
  { regex: /ensure\s+(.+)/gi, type: 'explicit' },
  { regex: /make\s+sure\s+(.+)/gi, type: 'explicit' },
  { regex: /no\s+(code\s+changes|modifications|edits|updates)\s+to\s+(.+)/gi, type: 'boundary' },
  { regex: /must\s+(not|remain|stay|keep)\s+(.+)/gi, type: 'explicit' },
  { regex: /no\s+(new dependencies|external|third.party|changes to existing)/gi, type: 'explicit' },
  { regex: /(.+?)\s+(behavior|logic|flow|style)\s+must\s+remain/gi, type: 'boundary' },
];

function extractConstraints(prompt: string): Constraint[] {
  const found: Constraint[] = [];
  for (const { regex, type } of CONSTRAINT_REGEXES) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(prompt)) !== null) {
      const rule = match[0].trim();
      if (!found.some(c => c.rule === rule)) {
        found.push({ type, rule: rule.charAt(0).toUpperCase() + rule.slice(1) });
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Complexity estimation
// ---------------------------------------------------------------------------
function estimateComplexity(prompt: string, taskType: string): Complexity {
  const words = prompt.split(/\s+/).length;
  const lower = prompt.toLowerCase();

  const highRiskSignals = ['delete', 'remove', 'drop', 'truncate', 'reset', 'migration', 'production', 'deploy'];
  const medRiskSignals = ['update', 'modify', 'change', 'refactor', 'move', 'rename', 'database', 'auth'];

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (highRiskSignals.some(s => lower.includes(s))) riskLevel = 'high';
  else if (medRiskSignals.some(s => lower.includes(s)) || taskType === 'refactor') riskLevel = 'medium';

  const stepCount = ['then', 'after', 'next', 'also', 'and then', 'finally', 'step']
    .reduce((acc, w) => acc + (lower.split(w).length - 1), 1);

  return { riskLevel, wordCount: words, stepCount: Math.min(stepCount, 8) };
}

// ---------------------------------------------------------------------------
// Execution plan builder
// ---------------------------------------------------------------------------
const PLAN_TEMPLATES: Record<string, Array<{ action: string; desc: string; checkpoint: boolean; risk: 'low' | 'medium' | 'high' }>> = {
  debugging: [
    { action: 'Diagnose', desc: 'Trace error source and reproduce the issue.', checkpoint: false, risk: 'low' },
    { action: 'Isolate', desc: 'Narrow the fault to the smallest reproducible scope.', checkpoint: true, risk: 'medium' },
    { action: 'Fix', desc: 'Apply the targeted fix with no regressions.', checkpoint: false, risk: 'medium' },
    { action: 'Verify', desc: 'Run tests and confirm resolution.', checkpoint: true, risk: 'low' },
  ],
  code_gen: [
    { action: 'Design', desc: 'Analyze requirements and define architecture.', checkpoint: true, risk: 'low' },
    { action: 'Implement', desc: 'Write core logic and components.', checkpoint: true, risk: 'medium' },
    { action: 'Review', desc: 'Self-correct and polish.', checkpoint: true, risk: 'low' },
  ],
  refactor: [
    { action: 'Audit', desc: 'Map all affected modules and dependencies.', checkpoint: true, risk: 'medium' },
    { action: 'Plan', desc: 'Define refactor scope to avoid regressions.', checkpoint: false, risk: 'low' },
    { action: 'Refactor', desc: 'Apply changes module by module.', checkpoint: true, risk: 'high' },
    { action: 'Test', desc: 'Verify behavior is preserved.', checkpoint: true, risk: 'medium' },
  ],
  multi_step: [
    { action: 'Scope', desc: 'Break mission into sequential sub-tasks.', checkpoint: true, risk: 'medium' },
    { action: 'Execute Phase 1', desc: 'Complete first batch of work.', checkpoint: true, risk: 'medium' },
    { action: 'Execute Phase 2', desc: 'Continue with next batch.', checkpoint: true, risk: 'medium' },
    { action: 'Integrate', desc: 'Connect all phases and validate end-to-end.', checkpoint: true, risk: 'high' },
  ],
  analysis: [
    { action: 'Read', desc: 'Load and parse all relevant sources.', checkpoint: false, risk: 'low' },
    { action: 'Analyze', desc: 'Extract key insights and patterns.', checkpoint: false, risk: 'low' },
    { action: 'Report', desc: 'Summarize findings clearly.', checkpoint: false, risk: 'low' },
  ],
  research: [
    { action: 'Gather', desc: 'Collect data from available sources.', checkpoint: false, risk: 'low' },
    { action: 'Evaluate', desc: 'Compare and rank options.', checkpoint: false, risk: 'low' },
    { action: 'Recommend', desc: 'Deliver a reasoned recommendation.', checkpoint: false, risk: 'low' },
  ],
  simple_qa: [
    { action: 'Answer', desc: 'Provide a direct, accurate response.', checkpoint: false, risk: 'low' },
  ],
};

function buildExecutionPlan(
  taskType: string,
  complexity: Complexity,
  context: { skillMatches: Skill[]; constraints: Constraint[] },
  checkpointPref: 'strict' | 'balanced' | 'light',
): ExecutionPlan {
  const template = (PLAN_TEMPLATES[taskType] ?? PLAN_TEMPLATES.code_gen).map((s, i) => ({
    id: i + 1,
    ...s,
    skillRef: undefined as string | undefined,
    pauseReason: undefined as string | undefined,
  }));

  if (complexity.riskLevel === 'high') {
    template.forEach(s => { s.checkpoint = true; });
  } else if (checkpointPref === 'light') {
    template.forEach(s => { if (s.risk === 'low') s.checkpoint = false; });
  }

  // inject skill refs
  if (context.skillMatches.length > 0) {
    const firstSkill = context.skillMatches[0];
    if (template[0]) {
      template[0].skillRef = firstSkill.ref;
      template[0].desc = `[Recalling Patterns] ${template[0].desc}`;
    }
  }
  if (context.constraints.some(c => c.type === 'boundary')) {
    const last = template[template.length - 1];
    if (last) {
      last.skillRef = context.skillMatches[0]?.ref ?? '/boundary-skill.md';
      last.desc = `[Applying Guardrails] ${last.desc}`;
    }
  }

  return { steps: template, totalSteps: template.length };
}

// ---------------------------------------------------------------------------
// Optimization profile
// ---------------------------------------------------------------------------
function getOptimizationProfile(
  constraints: Constraint[],
  complexity: Complexity,
  taskType: string,
  skillMatches: Skill[],
): OptimizationProfile {
  const { riskLevel, wordCount, stepCount } = complexity;
  const hasContext = skillMatches.length > 0;
  const skillEfficiency = skillMatches.reduce((a, s) => a + s.efficiency, 0);
  const isAgentic = !(taskType === 'simple_qa' && stepCount <= 1 && wordCount < 20);

  const riskBoost = riskLevel === 'high' ? 25 : riskLevel === 'medium' ? 12 : 0;
  const lengthBoost = Math.min(20, Math.floor(wordCount / 8));
  const stepsBoost = Math.min(20, stepCount * 4);
  const constraintsBoost = Math.min(15, constraints.length * 3);

  const tokens = Math.min(95, 10 + riskBoost + lengthBoost + stepsBoost + constraintsBoost - Math.min(20, Math.floor(skillEfficiency / 2)));
  const latency = Math.min(95, 8 + Math.floor(riskBoost * 0.8) + Math.floor(lengthBoost * 0.7) + stepsBoost - (hasContext ? 8 : 0));
  const quality = Math.max(45, Math.min(98, 60 + (hasContext ? 18 : 0) + Math.min(15, constraints.length * 2) + (riskLevel === 'high' ? 8 : 0)));

  return {
    description: isAgentic
      ? (hasContext ? 'Dynamic agentic routing with skill/context reuse to reduce blind-spot decisions.' : 'Agentic route selected; adding planning and guardrails to improve predictability.')
      : 'Prompt-only route selected for a lightweight task.',
    tokens, quality, latency,
    bullets: isAgentic
      ? ['Metrics adapt to prompt length and complexity', 'Constraints are converted into execution guardrails', 'Skill suggestions reduce repetitive prompt overhead']
      : ['Simple prompt path keeps flow fast', 'Low orchestration overhead', 'Upgrade to agent mode when scope expands'],
    mode: isAgentic ? 'agent' : 'manual',
    profileType: isAgentic ? 'balanced' : 'speed',
  };
}

// ---------------------------------------------------------------------------
// Agent setup questions
// ---------------------------------------------------------------------------
function buildAgentSetupQuestions(prompt: string, taskType: string, constraints: Constraint[], systemLimits: string[]): AgentSetupQuestion[] {
  const lower = prompt.toLowerCase();
  const tools: string[] = [];
  if (lower.includes('file') || lower.includes('refactor') || lower.includes('code')) tools.push('File editing');
  if (lower.includes('debug') || lower.includes('run') || lower.includes('build')) tools.push('Terminal');
  if (lower.includes('research') || lower.includes('api') || lower.includes('docs')) tools.push('Web');
  if (tools.length === 0) tools.push('File editing');

  const guardrails = constraints.slice(0, 2).map(c => c.rule);
  const domain = taskType === 'code_gen' ? 'Frontend development' : taskType === 'debugging' ? 'Bug diagnosis and fixes' : 'General execution';

  return [
    { question: 'What is the primary role for this agent?', answer: 'Not answered yet' },
    { question: 'Which domain should this agent specialize in?', answer: domain },
    { question: 'Which tools should be prioritized?', answer: tools.join(', ') },
    { question: 'Any hard constraints to lock?', answer: guardrails.length > 0 ? guardrails.join(' | ') : (systemLimits[0] ?? 'Not answered yet') },
  ];
}

// ---------------------------------------------------------------------------
// Learning profile (localStorage)
// ---------------------------------------------------------------------------
const LEARNING_DEFAULTS: Record<string, LearningProfile> = {
  debugging: { successRate: 91, checkpointPreference: 'strict', taskStats: { total: 0, success: 0 } },
  code_gen: { successRate: 87, checkpointPreference: 'balanced', taskStats: { total: 0, success: 0 } },
  refactor: { successRate: 83, checkpointPreference: 'strict', taskStats: { total: 0, success: 0 } },
  analysis: { successRate: 95, checkpointPreference: 'light', taskStats: { total: 0, success: 0 } },
  research: { successRate: 89, checkpointPreference: 'light', taskStats: { total: 0, success: 0 } },
  multi_step: { successRate: 78, checkpointPreference: 'strict', taskStats: { total: 0, success: 0 } },
  simple_qa: { successRate: 98, checkpointPreference: 'light', taskStats: { total: 0, success: 0 } },
};

function getLearningProfile(taskType: string): LearningProfile {
  const stored = localStorage.getItem(`preflight_learning_${taskType}`);
  if (stored) return JSON.parse(stored) as LearningProfile;
  return LEARNING_DEFAULTS[taskType] ?? LEARNING_DEFAULTS.code_gen;
}

export function recordOutcome(taskType: string, outcome: 'success' | 'manual'): void {
  const profile = getLearningProfile(taskType);
  profile.taskStats.total += 1;
  if (outcome === 'success') profile.taskStats.success += 1;
  profile.successRate = Math.round((profile.taskStats.success / profile.taskStats.total) * 100);
  localStorage.setItem(`preflight_learning_${taskType}`, JSON.stringify(profile));
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------
const INTENT_MAP: Record<string, SuggestedSkill> = {
  'ui-standards': { name: 'UI Consistency', ref: '/ui-standards-skill.md', pattern: 'ui-standards', rationale: 'RAG Match: Detected high UI/Design affinity. Injecting layout guardrails to save tokens.' },
  'clean-code': { name: 'Coding Standards', ref: '/clean-code-skill.md', pattern: 'clean-code', rationale: 'RAG Match: Semantic link to quality patterns found.' },
  'auth-protocol': { name: 'Security Protocol', ref: '/auth-skill.md', pattern: 'auth-protocol', rationale: 'RAG Match: Security-related intent identified.' },
  'architecture': { name: 'Architecture Guardrails', ref: '/arch-skill.md', pattern: 'architecture', rationale: 'RAG Match: Agent setup mission detected.' },
  'claude-agent': { name: 'Claude Agent Guardrails', ref: '/claude-agent-skill.md', pattern: 'claude-agent', rationale: 'RAG Match: Claude Agent workflow detected.' },
};

const TYPE_NORMALIZE: Record<string, string> = {
  debug: 'debugging', debugging: 'debugging', code_gen: 'code_gen', refactor: 'refactor',
  multi_step: 'multi_step', analysis: 'analysis', research: 'research', simple_qa: 'simple_qa',
};

export async function analyze(prompt: string, history: string[] = [], ignoredSkills: string[] = []): Promise<PreFlightAnalysis> {
  await syncSkillsFromServer();

  const llmResult = await LLMService.analyzePrompt(prompt, history);

  const heuristic = classifyTask(prompt);
  const llmType = llmResult?.taskType ? String(llmResult.taskType).toLowerCase() : '';
  const typeKey = TYPE_NORMALIZE[llmType] ?? heuristic.type;
  const typeConfig = TASK_PATTERNS[typeKey] ?? TASK_PATTERNS.code_gen;
  const mission = llmResult?.mission ?? prompt;

  // RAG intent retrieval
  const retrievedIntents = vectorSearch(prompt, 2);
  const suggestedSkills: SuggestedSkill[] = retrievedIntents
    .map(i => INTENT_MAP[i.id])
    .filter((s): s is SuggestedSkill => !!s)
    .filter((s, _, arr) => arr.findIndex(x => x.ref === s.ref) !== -1);

  if (llmResult?.skill_candidate) {
    suggestedSkills.push(llmResult.skill_candidate as SuggestedSkill);
  }

  const complexity = estimateComplexity(prompt, typeKey);
  let constraints = extractConstraints(prompt);

  if (llmResult?.userConstraints) {
    llmResult.userConstraints.forEach(rule => {
      if (!constraints.some(c => c.rule === rule)) {
        constraints.push({ type: 'explicit', rule });
      }
    });
  }

  const systemLimits: string[] = llmResult?.systemLimits ?? [];
  if (typeKey !== 'simple_qa') {
    constraints.push({ type: 'system', rule: 'Will ask for review before modifying critical files' });
  }

  const leadAgent = assignAgent(typeKey, retrievedIntents);
  const learningProfile = getLearningProfile(typeKey);

  const activeSkillBank = LOCAL_SKILL_BANK.filter(s => !ignoredSkills.includes(s.ref));
  const skillMatches = activeSkillBank.filter(s => new RegExp(s.pattern, 'i').test(prompt));

  const executionPlan = buildExecutionPlan(typeKey, complexity, { skillMatches, constraints }, learningProfile.checkpointPreference);
  const optimizationProfile = getOptimizationProfile(constraints, complexity, typeKey, skillMatches);
  const agentSetupQuestions = buildAgentSetupQuestions(prompt, typeKey, constraints, systemLimits);

  let confidence = 85;
  let reasoning = '';
  if (optimizationProfile.mode === 'agent') {
    reasoning = 'Complex mission detected. Delegating to a Claude Agent loop reduces manual overhead by 80%.';
    if (skillMatches.length > 0) reasoning += ' Applying saved /skill workflows to optimize accuracy.';
    if (systemLimits.length > 0) reasoning += ` Managing identified system limits: ${systemLimits.join(', ')}.`;
  } else {
    reasoning = 'Deterministic task. Manual Claude prompting ensures immediate delivery.';
  }

  if (learningProfile.checkpointPreference === 'strict') confidence = Math.min(99, confidence + 5);
  if (learningProfile.checkpointPreference === 'light') confidence = Math.max(50, confidence - 5);

  return {
    id: `pf_${Date.now()}`,
    platform: 'Claude',
    prompt,
    mission,
    leadAgent,
    systemLimits,
    taskType: typeKey,
    taskLabel: typeConfig.label,
    taskIcon: typeConfig.icon,
    complexity,
    constraints,
    skillMatches,
    suggestedSkills,
    agentSetupQuestions,
    learningProfile,
    executionPlan,
    optimizationProfile,
    recommendation: { mode: optimizationProfile.mode, confidence, reasoning },
  };
}

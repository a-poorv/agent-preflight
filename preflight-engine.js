/**
 * Pre-Flight Engine — Core analysis pipeline
 * Phases: Task Classifier, Complexity Estimator, Constraint Extractor,
 *         Execution Planner, Decision Engine, Learning Layer
 */

const PreFlightEngine = (() => {

  // ===== TASK TAXONOMY =====
  const TASK_PATTERNS = {
    debugging: {
      keywords: ['fix','bug','error','crash','fail','broken','issue','debug','not working','exception','stack trace','undefined','null','TypeError','500','404'],
      label: 'Debugging',
      icon: '🐛',
      color: 'var(--accent-red)'
    },
    code_gen: {
      keywords: ['build','create','implement','make','develop','write','generate','scaffold','set up','initialize','new project','boilerplate','starter'],
      label: 'Code Generation',
      icon: '⚡',
      color: 'var(--accent-blue)'
    },
    analysis: {
      keywords: ['review','analyze','explain','understand','what does','how does','walk through','audit','inspect','check','evaluate','assess'],
      label: 'Analysis',
      icon: '🔍',
      color: 'var(--accent-cyan)'
    },
    refactor: {
      keywords: ['refactor','optimize','improve','clean','restructure','simplify','modernize','upgrade','migrate','performance','reduce','consolidate'],
      label: 'Refactoring',
      icon: '🔧',
      color: 'var(--accent-orange)'
    },
    research: {
      keywords: ['compare','research','find','best practice','recommend','evaluate','pros cons','alternatives','which','should I use','difference between','vs'],
      label: 'Research',
      icon: '📚',
      color: 'var(--accent-purple)'
    },
    multi_step: {
      keywords: ['build and deploy','create test and','end to end','full stack','complete','from scratch','entire','whole','pipeline','ci cd','workflow'],
      label: 'Multi-Step Task',
      icon: '🚀',
      color: 'var(--accent-green)'
    },
    simple_qa: {
      keywords: ['what is','how to','why does','when should','can you explain','define','meaning of','syntax for','difference between','what are','tell me about','is it possible','how do i'],
      label: 'Quick Question',
      icon: '💬',
      color: 'var(--text-secondary)'
    }
  };

  // ===== CONSTRAINT PATTERNS =====
  const CONSTRAINT_PATTERNS = [
    { regex: /don'?t\s+(modify|change|touch|edit|delete|remove|alter|break)\s+(.+)/gi, type: 'boundary' },
    { regex: /no\s+(code changes|modifications|deletions)/gi, type: 'boundary' },
    { regex: /optimize\s+(.+)/gi, type: 'implicit' },
    { regex: /only\s+(use|modify|change|edit)\s+(.+)/gi, type: 'explicit' },
    { regex: /keep\s+(.+?)\s+(unchanged|intact|as is)/gi, type: 'explicit' },
    { regex: /preserve\s+(.+)/gi, type: 'boundary' },
    { regex: /without\s+(breaking|changing|modifying)\s+(.+)/gi, type: 'boundary' },
    { regex: /make sure\s+(.+)/gi, type: 'explicit' },
    { regex: /must\s+(not|remain|stay|keep)\s+(.+)/gi, type: 'explicit' },
    { regex: /no\s+(new dependencies|external|third.party)/gi, type: 'explicit' }
  ];

  // ===== STEP TEMPLATES =====
  const STEP_TEMPLATES = {
    debugging: [
      { action: 'Analyze error context and stack traces', tokens: 1500, risk: 'low' },
      { action: 'Identify root cause and affected files', tokens: 2500, risk: 'low' },
      { action: 'Propose fix strategy', tokens: 1000, risk: 'low', checkpoint: true },
      { action: 'Implement the fix', tokens: 3000, risk: 'medium' },
      { action: 'Verify fix and check for regressions', tokens: 2000, risk: 'low', checkpoint: true }
    ],
    code_gen: [
      { action: 'Analyze requirements and define scope', tokens: 1500, risk: 'low' },
      { action: 'Design architecture and data models', tokens: 2000, risk: 'low', checkpoint: true },
      { action: 'Implement core logic', tokens: 5000, risk: 'medium' },
      { action: 'Add error handling and validation', tokens: 2000, risk: 'low' },
      { action: 'Write tests and documentation', tokens: 2500, risk: 'low' },
      { action: 'Final review and polish', tokens: 1000, risk: 'low', checkpoint: true }
    ],
    analysis: [
      { action: 'Scan codebase structure', tokens: 1500, risk: 'low' },
      { action: 'Deep-dive into target files', tokens: 3000, risk: 'low' },
      { action: 'Generate findings report', tokens: 2000, risk: 'low', checkpoint: true }
    ],
    refactor: [
      { action: 'Analyze current implementation', tokens: 2000, risk: 'low' },
      { action: 'Identify refactoring opportunities', tokens: 1500, risk: 'low' },
      { action: 'Propose refactoring plan', tokens: 1000, risk: 'low', checkpoint: true },
      { action: 'Apply refactoring changes', tokens: 4000, risk: 'high' },
      { action: 'Run tests and validate', tokens: 2000, risk: 'medium', checkpoint: true }
    ],
    research: [
      { action: 'Gather information on options', tokens: 3000, risk: 'low' },
      { action: 'Build comparison matrix', tokens: 2000, risk: 'low' },
      { action: 'Generate recommendation with rationale', tokens: 2500, risk: 'low', checkpoint: true }
    ],
    multi_step: [
      { action: 'Break down task into sub-goals', tokens: 1500, risk: 'low' },
      { action: 'Execute Phase 1: Setup & scaffolding', tokens: 3000, risk: 'medium', checkpoint: true },
      { action: 'Execute Phase 2: Core implementation', tokens: 5000, risk: 'medium' },
      { action: 'Execute Phase 3: Integration & wiring', tokens: 3000, risk: 'medium', checkpoint: true },
      { action: 'Execute Phase 4: Testing & validation', tokens: 2500, risk: 'low' },
      { action: 'Final review and deployment prep', tokens: 1500, risk: 'low', checkpoint: true }
    ],
    simple_qa: [
      { action: 'Formulate comprehensive answer', tokens: 1500, risk: 'low' }
    ]
  };

  // ===== 1. TASK CLASSIFIER =====
  function classifyTask(prompt) {
    const lower = prompt.toLowerCase();
    let bestMatch = 'simple_qa';
    let bestScore = 0;

    for (const [type, config] of Object.entries(TASK_PATTERNS)) {
      let score = 0;
      for (const kw of config.keywords) {
        if (lower.includes(kw)) score += kw.split(' ').length; // multi-word matches score higher
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
      }
    }

    // Short-prompt heuristic: short questions are almost always simple_qa
    const words = prompt.split(/\s+/).length;
    const endsWithQuestion = /\?\s*$/.test(prompt);
    const simpleQaScore = TASK_PATTERNS.simple_qa.keywords.filter(kw => lower.includes(kw)).length;
    if (words <= 20 && endsWithQuestion && simpleQaScore > 0 && bestMatch !== 'debugging') {
      bestMatch = 'simple_qa';
      bestScore = Math.max(bestScore, simpleQaScore);
    }

    // Multi-step boost: if prompt has multiple verbs/actions
    const actionVerbs = ['build','create','test','deploy','fix','add','remove','refactor','write','implement'];
    const verbCount = actionVerbs.filter(v => lower.includes(v)).length;
    if (verbCount >= 3 && bestMatch !== 'multi_step') {
      bestMatch = 'multi_step';
    }

    const pattern = TASK_PATTERNS[bestMatch];
    return {
      type: bestMatch,
      label: pattern.label,
      icon: pattern.icon,
      color: pattern.color,
      confidence: Math.min(0.95, 0.5 + bestScore * 0.08)
    };
  }

  // ===== 2. COMPLEXITY ESTIMATOR =====
  function estimateComplexity(prompt, taskType) {
    const words = prompt.split(/\s+/).length;
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim()).length;
    const hasCode = /```|`[^`]+`|function\s|class\s|const\s|import\s/.test(prompt);
    const mentionsFiles = /\.(js|ts|py|css|html|json|yaml|md|go|rs|java|rb)\b/i.test(prompt);

    let stepCount = STEP_TEMPLATES[taskType]?.length || 3;
    let contextLoad = 'low';
    let ambiguity = 30;
    let riskLevel = 'low';

    // Adjust based on prompt characteristics
    if (words > 50) { stepCount = Math.min(stepCount + 2, 12); contextLoad = 'medium'; }
    if (words > 120) { contextLoad = 'high'; }
    if (words < 15) { ambiguity = Math.min(ambiguity + 30, 90); }
    if (hasCode) { ambiguity = Math.max(ambiguity - 15, 5); contextLoad = 'high'; }
    if (mentionsFiles) { ambiguity = Math.max(ambiguity - 10, 5); }

    const steps = STEP_TEMPLATES[taskType] || STEP_TEMPLATES.simple_qa;
    const estimatedTokens = steps.reduce((sum, s) => sum + s.tokens, 0);

    // Risk
    const riskKeywords = ['delete','remove','drop','overwrite','deploy','production','database','migration'];
    if (riskKeywords.some(k => prompt.toLowerCase().includes(k))) riskLevel = 'high';
    else if (['refactor','code_gen','multi_step'].includes(taskType)) riskLevel = 'medium';

    return {
      stepCount,
      contextLoad,
      ambiguity: Math.round(ambiguity),
      riskLevel,
      estimatedTokens,
      wordCount: words
    };
  }

  // ===== 3. CONSTRAINT EXTRACTOR =====
  function extractConstraints(prompt) {
    const constraints = [];
    const lower = prompt.toLowerCase();

    for (const pattern of CONSTRAINT_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(prompt)) !== null) {
        constraints.push({
          type: pattern.type,
          rule: match[0].trim(),
          source: 'prompt'
        });
      }
    }

    // Implicit constraints
    if (lower.includes('review') || lower.includes('analyze') || lower.includes('explain')) {
      constraints.push({ type: 'implicit', rule: 'Read-only analysis — no file modifications', source: 'inferred' });
    }
    if (lower.includes('test') || lower.includes('spec')) {
      constraints.push({ type: 'implicit', rule: 'Preserve existing test coverage', source: 'inferred' });
    }
    if (lower.includes('security') || lower.includes('auth')) {
      constraints.push({ type: 'system', rule: 'Handle sensitive data carefully', source: 'system' });
    }

    // System constraints always present
    constraints.push({ type: 'system', rule: 'Will pause before destructive operations', source: 'system' });

    return constraints;
  }

  // ===== 4. EXECUTION PLANNER =====
  function buildExecutionPlan(taskType, complexity, constraints) {
    const templateSteps = STEP_TEMPLATES[taskType] || STEP_TEMPLATES.simple_qa;
    const steps = templateSteps.map((step, i) => ({
      id: i + 1,
      action: step.action,
      tokens: step.tokens + Math.round((Math.random() - 0.5) * 400),
      risk: step.risk,
      checkpoint: step.checkpoint || false,
      status: 'pending'
    }));

    // If high risk, add extra checkpoints
    if (complexity.riskLevel === 'high') {
      steps.forEach(s => {
        if (s.risk === 'medium' || s.risk === 'high') s.checkpoint = true;
      });
    }

    return { steps, totalSteps: steps.length };
  }

  // ===== 5. DECISION ENGINE =====
  function recommend(taskClassification, complexity, constraints) {
    const { type } = taskClassification;
    const { stepCount, riskLevel, ambiguity } = complexity;

    // Agent scores
    let agentScore = 0;
    if (stepCount > 2) agentScore += 3;
    if (stepCount > 5) agentScore += 2;
    if (['debugging', 'code_gen', 'refactor', 'multi_step'].includes(type)) agentScore += 3;
    if (['research'].includes(type)) agentScore += 2;
    if (riskLevel === 'high') agentScore += 1; // Agent with checkpoints is safer
    if (ambiguity > 60) agentScore -= 2;

    // Manual scores
    let manualScore = 0;
    if (type === 'simple_qa') manualScore += 5;
    if (stepCount <= 2) manualScore += 3;
    if (ambiguity > 70) manualScore += 2;

    let mode = agentScore > manualScore ? 'agent' : 'manual';
    let confidence = Math.min(0.97, 0.6 + Math.abs(agentScore - manualScore) * 0.05);

    const hasBoundaries = constraints && constraints.some(c => c.type === 'boundary');

    let reasoning;
    if (hasBoundaries) {
      mode = 'skill';
      confidence = 0.95;
      reasoning = `You have defined deterministic boundaries in your prompt. Instead of relying on an exploratory Agent, it is highly recommended to save this context as a <strong>Skill</strong> or <strong>Workflow Template</strong> to guarantee consistent, token-efficient execution.`;
    } else if (mode === 'agent') {
      reasoning = `This is a ${complexity.stepCount}-step ${taskClassification.label.toLowerCase()} task. An agent can handle the complexity while keeping you in control at checkpoints.`;
    } else {
      reasoning = `This looks like a straightforward ${taskClassification.label.toLowerCase()} task. Manual prompting will give you more direct control and faster results.`;
    }

    return { mode, confidence, reasoning, agentScore, manualScore };
  }

  // ===== 6. LEARNING LAYER (Phase 5) =====
  const LearningLayer = {
    STORAGE_KEY: 'preflight_patterns',
    WORKFLOW_KEY: 'preflight_workflows',

    recordExecution(analysis) {
      const patterns = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      patterns.push({
        taskType: analysis.taskType,
        prompt: analysis.prompt.substring(0, 100),
        timestamp: Date.now(),
        recommendation: analysis.recommendation.mode
      });
      // Keep last 50
      if (patterns.length > 50) patterns.splice(0, patterns.length - 50);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patterns));
    },

    detectPattern(analysis) {
      const patterns = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      const recentSameType = patterns.filter(p =>
        p.taskType === analysis.taskType &&
        Date.now() - p.timestamp < 7 * 24 * 60 * 60 * 1000
      );
      if (recentSameType.length >= 3) {
        return {
          detected: true,
          count: recentSameType.length,
          message: `You've used the Agent for ${recentSameType.length} similar ${analysis.taskLabel} tasks recently. Save this exact execution plan as a <strong>Workflow Template</strong> to bypass the agent planning phase, reduce token usage, and ensure deterministic execution.`
        };
      }
      return { detected: false };
    },

    saveWorkflow(name, description, tags, analysis) {
      const workflows = JSON.parse(localStorage.getItem(this.WORKFLOW_KEY) || '[]');
      workflows.push({
        id: 'wf_' + Date.now(),
        name,
        description,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        taskType: analysis.taskType,
        steps: analysis.executionPlan.steps.map(s => s.action),
        constraints: analysis.constraints.map(c => c.rule),
        createdAt: Date.now()
      });
      localStorage.setItem(this.WORKFLOW_KEY, JSON.stringify(workflows));
      return workflows;
    },

    getWorkflows() {
      return JSON.parse(localStorage.getItem(this.WORKFLOW_KEY) || '[]');
    },

    getStats() {
      const patterns = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      const workflows = this.getWorkflows();
      const totalTokens = patterns.length * 8000; // rough estimate
      return {
        sessions: patterns.length,
        totalTokens,
        workflows: workflows.length
      };
    }
  };

  // ===== MAIN ANALYSIS PIPELINE =====
  function analyze(prompt) {
    const taskClassification = classifyTask(prompt);
    const complexity = estimateComplexity(prompt, taskClassification.type);
    const constraints = extractConstraints(prompt);
    const executionPlan = buildExecutionPlan(taskClassification.type, complexity, constraints);
    const recommendation = recommend(taskClassification, complexity, constraints);
    const pattern = LearningLayer.detectPattern({
      taskType: taskClassification.type,
      taskLabel: taskClassification.label
    });

    const analysis = {
      id: 'pf_' + Date.now(),
      prompt,
      taskType: taskClassification.type,
      taskLabel: taskClassification.label,
      taskIcon: taskClassification.icon,
      taskColor: taskClassification.color,
      taskConfidence: taskClassification.confidence,
      complexity,
      constraints,
      executionPlan,
      recommendation,
      patternDetected: pattern
    };

    LearningLayer.recordExecution(analysis);
    return analysis;
  }

  return { analyze, LearningLayer, TASK_PATTERNS };
})();

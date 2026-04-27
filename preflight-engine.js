/**
 * VectorStore Simulation (RAG Layer)
 * This handles semantic retrieval of skills and agent context.
 */
class VectorStore {
  constructor() {
    this.embeddings = {
      "ui-standards": ["consistent", "style", "design", "layout", "css", "theme", "look and feel", "brand"],
      "clean-code": ["refactor", "standard", "clean", "quality", "patterns", "technical debt", "readable"],
      "auth-protocol": ["login", "security", "authentication", "permission", "access", "oauth", "password"],
      "architecture": ["setup", "agent", "orchestration", "structure", "module", "system design"],
      "claude-agent": ["claude", "anthropic", "agent", "sonnet", "opus", "haiku", "tool use", "pre-flight"]
    };
  }

  /**
   * Simulates semantic search by counting overlapping conceptual terms
   */
  search(query, topK = 1) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [key, terms] of Object.entries(this.embeddings)) {
      let score = 0;
      terms.forEach(term => {
        if (lowerQuery.includes(term)) score += 1;
      });
      if (score > 0) results.push({ id: key, score });
    }
    
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

const Store = new VectorStore();

/**
 * Agent Orchestrator (Role Management)
 * Assigns specialized agents based on mission intent.
 */
class AgentOrchestrator {
  constructor() {
    this.agents = {
      "ArchitectAgent": { icon: "🏛️", directive: "Focus on structural integrity and cross-module consistency." },
      "DevAgent": { icon: "💻", directive: "Focus on clean implementation and following operational skills." },
      "DebugAgent": { icon: "🔍", directive: "Focus on root cause analysis and minimal regression risk." },
      "SecurityAgent": { icon: "🛡️", directive: "Focus on authentication flow and data boundary protection." }
    };
  }

  assign(taskType, intents) {
    if (intents.some(i => i.id === 'auth-protocol')) return { id: "SecurityAgent", ...this.agents.SecurityAgent };
    if (taskType === 'debugging') return { id: "DebugAgent", ...this.agents.DebugAgent };
    if (taskType === 'code_gen' && intents.some(i => i.id === 'architecture')) return { id: "ArchitectAgent", ...this.agents.ArchitectAgent };
    return { id: "DevAgent", ...this.agents.DevAgent };
  }
}

const Orchestrator = new AgentOrchestrator();

const PreFlightEngine = (function() {

  const TASK_PATTERNS = {
    debugging: { keywords: ['debug','fix','error','bug','issue','exception','crash'], label: 'Debugging', icon: '🐛', color: '#D96C51' },
    code_gen: { keywords: ['build','create','write','generate','make','develop','design','layout','ui','page','component'], label: 'Generation', icon: '✨', color: '#ECA335' },
    refactor: { keywords: ['refactor','restructure','clean up','optimize','rewrite'], label: 'Refactoring', icon: '♻️', color: '#3D8B63' },
    analysis: { keywords: ['explain','understand','how does','what is','read','analyze'], label: 'Analysis', icon: '🔍', color: '#6B6863' },
    research: { keywords: ['research','compare','evaluate','find','search'], label: 'Research', icon: '📚', color: '#5B76A6' },
    multi_step: { keywords: ['pipeline','workflow','end-to-end','full stack','setup'], label: 'Complex workflow', icon: '🗺️', color: '#D96C51' },
    simple_qa: { keywords: ['what','how','why','who','where','when','can you'], label: 'Simple Question', icon: '❓', color: '#6B6863' }
  };

  const CONSTRAINT_PATTERNS = [
    { regex: /only\s+(use|modify|change|edit)\s+(.+)/gi, type: 'explicit' },
    { regex: /keep\s+(.+?)\s+(unchanged|intact|as is|original)/gi, type: 'explicit' },
    { regex: /preserve\s+(.+)/gi, type: 'boundary' },
    { regex: /without\s+(breaking|changing|modifying|altering)\s+(.+)/gi, type: 'boundary' },
    { regex: /don'?t\s+(break|change|modify|edit|alter|touch|affect)\s+(.+)/gi, type: 'boundary' },
    { regex: /avoid\s+(.+)/gi, type: 'boundary' },
    { regex: /ensure\s+(.+)/gi, type: 'explicit' },
    { regex: /make\s+sure\s+(.+)/gi, type: 'explicit' },
    { regex: /no\s+(code\s+changes|modifications|edits|updates)\s+to\s+(.+)/gi, type: 'boundary' },
    { regex: /propose\s+(?:multiple|optimized|few|2-3|several|\s)+\s*(solutions|options|variants|paths)/gi, type: 'explicit' },
    { regex: /must\s+(not|remain|stay|keep)\s+(.+)/gi, type: 'explicit' },
    { regex: /no\s+(new dependencies|external|third.party|changes to existing)/gi, type: 'explicit' },
    { regex: /(.+?)\s+(behavior|logic|flow|style)\s+must\s+remain/gi, type: 'boundary' }
  ];

  // Initialize local skill bank from storage or defaults
  let LOCAL_SKILL_BANK = JSON.parse(localStorage.getItem('preflight_skills')) || [
    { name: 'Home Page Patterns', pattern: 'home page', ref: '/home-skill.md', efficiency: 15 },
    { name: 'Auth Protocol', pattern: 'login|auth|sign up', ref: '/auth-skill.md', efficiency: 20 },
    { name: 'UI Standards', pattern: 'design|layout|css|style', ref: '/ui-skill.md', efficiency: 10 }
  ];

  function saveNewSkill(name, pattern, ref) {
    LOCAL_SKILL_BANK.push({ name, pattern, ref, efficiency: 10 });
    localStorage.setItem('preflight_skills', JSON.stringify(LOCAL_SKILL_BANK));
    return true;
  }

  const DEFAULT_LEARNING_MEMORY = {
    checkpointPreference: 'adaptive',
    outcomes: {}
  };
  let LEARNING_MEMORY = JSON.parse(localStorage.getItem('preflight_learning_memory')) || DEFAULT_LEARNING_MEMORY;

  function persistLearningMemory() {
    localStorage.setItem('preflight_learning_memory', JSON.stringify(LEARNING_MEMORY));
  }

  function getLearningProfile(taskType) {
    const stats = LEARNING_MEMORY.outcomes[taskType] || { total: 0, success: 0, manual: 0 };
    const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
    return {
      checkpointPreference: LEARNING_MEMORY.checkpointPreference || 'adaptive',
      taskStats: stats,
      successRate
    };
  }

  function recordOutcome(taskType, outcome = 'success') {
    if (!taskType) return;
    if (!LEARNING_MEMORY.outcomes[taskType]) {
      LEARNING_MEMORY.outcomes[taskType] = { total: 0, success: 0, manual: 0 };
    }
    LEARNING_MEMORY.outcomes[taskType].total += 1;
    if (outcome === 'success') LEARNING_MEMORY.outcomes[taskType].success += 1;
    if (outcome === 'manual') LEARNING_MEMORY.outcomes[taskType].manual += 1;
    persistLearningMemory();
  }

  function setCheckpointPreference(mode = 'adaptive') {
    const allowedModes = ['strict', 'adaptive', 'light'];
    LEARNING_MEMORY.checkpointPreference = allowedModes.includes(mode) ? mode : 'adaptive';
    persistLearningMemory();
    return LEARNING_MEMORY.checkpointPreference;
  }

  const CONTEXT_PATTERNS = [
    { regex: /(?:existing|previous|last|earlier|used in|same as)\s+(?:code|layout|design|page|logic|style|home page)/gi, type: 'recall' },
    { regex: /(?:follow|use|refer to)\s+(?:the|existing|our)\s+(?:standard|pattern|style)/gi, type: 'pattern' }
  ];

  const PATTERN_DETECTORS = [
    { id: 'multi-sol', regex: /(?:2-3|multiple|potential)\s+solutions?/i, label: 'Multi-Solution Design', description: 'Requesting multiple candidates for complex architecture.' },
    { id: 'coding-std', regex: /(?:coding|clean)\s+standards?/i, label: 'Quality Standards', description: 'Enforcing strict linting and architectural patterns.' },
    { id: 'optimization', regex: /optimize\s+(?:the\s+)?(?:output|code|performance)/i, label: 'Performance Guardrails', description: 'Prioritizing efficiency and resource management.' }
  ];

  const STEP_TEMPLATES = {
    debugging: [
      { action: 'Reproduce', desc: 'Read the prompt and identify the failure mode', tokens: 1200, risk: 'low' },
      { action: 'Inspect', desc: 'Trace the relevant files, logs, and stack', tokens: 2500, risk: 'low' },
      { action: 'Hypothesize', desc: 'Narrow down likely root causes', tokens: 1800, risk: 'medium', checkpoint: true },
      { action: 'Propose fix', desc: 'Draft the smallest viable change', tokens: 3200, risk: 'medium' }
    ],
    code_gen: [
      { action: 'Design', desc: 'Analyze requirements and define architecture', tokens: 1500, risk: 'low', checkpoint: true },
      { action: 'Implement', desc: 'Write core logic and components', tokens: 5000, risk: 'medium' },
      { action: 'Review', desc: 'Self-correct and polish', tokens: 2000, risk: 'low' }
    ],
    analysis: [
      { action: 'Scan', desc: 'Read target codebase structure', tokens: 1500, risk: 'low' },
      { action: 'Analyze', desc: 'Deep-dive into specified files', tokens: 3000, risk: 'low' },
      { action: 'Report', desc: 'Generate findings', tokens: 2000, risk: 'low' }
    ],
    refactor: [
      { action: 'Analyze', desc: 'Understand current implementation', tokens: 2000, risk: 'low' },
      { action: 'Propose', desc: 'Suggest refactoring plan', tokens: 1000, risk: 'low', checkpoint: true },
      { action: 'Apply', desc: 'Rewrite code to match plan', tokens: 4000, risk: 'high' }
    ],
    research: [
      { action: 'Gather', desc: 'Find information on options', tokens: 3000, risk: 'low' },
      { action: 'Synthesize', desc: 'Build comparison matrix', tokens: 2500, risk: 'low' }
    ],
    multi_step: [
      { action: 'Plan', desc: 'Break down task into sub-goals', tokens: 1500, risk: 'low', checkpoint: true },
      { action: 'Phase 1', desc: 'Setup & scaffolding', tokens: 3000, risk: 'medium' },
      { action: 'Phase 2', desc: 'Core implementation', tokens: 5000, risk: 'medium', checkpoint: true },
      { action: 'Phase 3', desc: 'Testing & validation', tokens: 2500, risk: 'low' }
    ],
    simple_qa: [
      { action: 'Answer', desc: 'Formulate comprehensive response', tokens: 1500, risk: 'low' }
    ]
  };

  function classifyTask(prompt) {
    const lower = prompt.toLowerCase();
    let bestMatch = 'simple_qa';
    let bestScore = 0;

    for (const [type, config] of Object.entries(TASK_PATTERNS)) {
      let score = 0;
      for (const kw of config.keywords) {
        if (lower.includes(kw)) score += kw.split(' ').length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
      }
    }
    const pattern = TASK_PATTERNS[bestMatch];
    return {
      type: bestMatch,
      label: pattern.label,
      icon: pattern.icon,
      color: pattern.color,
      confidence: Math.min(0.98, 0.85 + (bestScore * 0.05))
    };
  }

  function estimateComplexity(prompt, taskType) {
    const words = prompt.split(/\s+/).length;
    let stepCount = (STEP_TEMPLATES[taskType] || STEP_TEMPLATES.simple_qa).length;
    let contextLoad = 'low';
    let riskLevel = 'low';
    if (words > 50) { stepCount = Math.min(stepCount + 1, 10); contextLoad = 'medium'; }
    if (words > 120) { contextLoad = 'high'; }

    const riskKeywords = ['delete','remove','drop','overwrite','deploy','production','database'];
    if (riskKeywords.some(k => prompt.toLowerCase().includes(k))) riskLevel = 'high';
    else if (['refactor','code_gen','multi_step'].includes(taskType)) riskLevel = 'medium';

    const steps = STEP_TEMPLATES[taskType] || STEP_TEMPLATES.simple_qa;
    const estimatedTokens = steps.reduce((sum, s) => sum + s.tokens, 0);

    return { stepCount, contextLoad, riskLevel, estimatedTokens, wordCount: words };
  }

  function extractConstraints(prompt) {
    const constraints = [];
    const lower = prompt.toLowerCase();

    for (const pattern of CONSTRAINT_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(prompt)) !== null) {
        constraints.push({ type: pattern.type, rule: match[0].trim() });
      }
    }

    if (lower.includes('review') || lower.includes('analyze') || lower.includes('explain')) {
      constraints.push({ type: 'implicit', rule: 'Read-only analysis — no file modifications' });
    }
    
    return constraints;
  }

  function buildExecutionPlan(taskType, complexity, analysis = null, checkpointPreference = 'adaptive') {
    const template = STEP_TEMPLATES[taskType] || STEP_TEMPLATES.simple_qa;
    const steps = template.map((s, idx) => {
      let step = { 
        ...s, 
        id: idx + 1,
        tokens: s.tokens + Math.round((Math.random() - 0.5) * 400),
        checkpoint: s.checkpoint || false,
        reasoning: s.reasoning || "Standard operational procedure for this task type."
      };
      
      // Dynamic reasoning based on complexity
      if (complexity.riskLevel === 'high' && idx === 0) {
        step.reasoning = "High risk mission. Forcing deep architecture analysis before any file modifications.";
      }
      
      // Mimic skill injection logic
      if (analysis && analysis.contextTriggers && analysis.contextTriggers.length > 0) {
        if (idx === 0) {
           const skillMatch = analysis.skillMatches && analysis.skillMatches.length > 0 ? analysis.skillMatches[0].ref : '/context-skill.md';
           step.skillRef = skillMatch;
           step.desc = `[Recalling Patterns] ${step.desc}`;
           step.reasoning = "Using saved operational context to skip redundant discovery phases and save tokens.";
        }
      }
      
      if (analysis && analysis.constraints && analysis.constraints.some(c => c.type === 'boundary')) {
        if (idx === template.length - 1) {
           const skillMatch = analysis.skillMatches && analysis.skillMatches.length > 0 ? analysis.skillMatches[0].ref : '/boundary-skill.md';
           step.skillRef = skillMatch;
           step.desc = `[Applying Guardrails] ${step.desc}`;
           step.reasoning = "Enforcing mission boundaries to prevent hallucination or unwanted side-effects.";
        }
      }

      // Phase 2: risk-based runtime checkpoints
      if (step.risk === 'high') {
        step.checkpoint = true;
        step.pauseReason = "High-risk operation detected. Approve before Claude Agent continues.";
      } else if (step.risk === 'medium' && complexity.riskLevel === 'high') {
        step.checkpoint = true;
        step.pauseReason = "Medium-risk step in a high-risk mission. Confirm execution.";
      } else if (step.checkpoint) {
        step.pauseReason = "Strategic checkpoint: verify direction before proceeding.";
      }
      
      return step;
    });

    if (checkpointPreference === 'strict') {
      steps.forEach(s => {
        s.checkpoint = true;
        if (!s.pauseReason) s.pauseReason = "Strict mode enabled. Approval required at each step.";
      });
    } else if (checkpointPreference === 'light') {
      steps.forEach(s => {
        if (s.risk !== 'high') {
          s.checkpoint = false;
          s.pauseReason = null;
        }
      });
    }

    if (complexity.riskLevel === 'high') {
      steps.forEach(s => {
        if (s.risk === 'medium' || s.risk === 'high') {
          s.checkpoint = true;
          if (!s.pauseReason) {
            s.pauseReason = "High-risk mission guardrail. Human approval required.";
          }
        }
      });
    }

    return { steps, totalSteps: steps.length };
  }

  function getOptimizationProfile(constraints, complexity, taskType, contextTriggers = [], skillMatches = []) {
    const riskLevel = complexity?.riskLevel || 'low';
    const wordCount = complexity?.wordCount || 0;
    const stepCount = complexity?.stepCount || 1;
    const hasContext = contextTriggers.length > 0 || skillMatches.length > 0;
    const constraintCount = constraints.length;
    const skillEfficiency = skillMatches.reduce((acc, s) => acc + (s.efficiency || 0), 0);
    const isAgentic = !(taskType === 'simple_qa' && stepCount <= 1 && wordCount < 20);

    const riskBoost = riskLevel === 'high' ? 25 : riskLevel === 'medium' ? 12 : 0;
    const lengthBoost = Math.min(20, Math.floor(wordCount / 8));
    const stepsBoost = Math.min(20, stepCount * 4);
    const constraintsBoost = Math.min(15, constraintCount * 3);

    const tokenLoad = Math.min(95, 10 + riskBoost + lengthBoost + stepsBoost + constraintsBoost - Math.min(20, Math.floor(skillEfficiency / 2)));
    const latencyLoad = Math.min(95, 8 + Math.floor(riskBoost * 0.8) + Math.floor(lengthBoost * 0.7) + stepsBoost - (hasContext ? 8 : 0));
    const qualityScore = Math.max(45, Math.min(98, 60 + (hasContext ? 18 : 0) + Math.min(15, constraintCount * 2) + (riskLevel === 'high' ? 8 : 0)));

    return {
      description: isAgentic
        ? (hasContext
          ? "Dynamic agentic routing with skill/context reuse to reduce blind-spot decisions."
          : "Agentic route selected; adding planning and guardrails to improve predictability.")
        : "Prompt-only route selected for a lightweight task.",
      tokens: tokenLoad,
      quality: qualityScore,
      latency: latencyLoad,
      bullets: isAgentic ? [
        "Metrics adapt to prompt length and complexity",
        "Constraints are converted into execution guardrails",
        "Skill suggestions reduce repetitive prompt overhead"
      ] : [
        "Simple prompt path keeps flow fast",
        "Low orchestration overhead",
        "Upgrade to agent mode when scope expands"
      ],
      mode: isAgentic ? "agent" : "manual",
      profileType: isAgentic ? "balanced" : "speed"
    };
  }

  function buildAgentSetupQuestions(prompt, taskType, constraints = [], systemLimits = []) {
    const lowerPrompt = prompt.toLowerCase();
    const suggestedTools = [];
    if (lowerPrompt.includes('file') || lowerPrompt.includes('refactor') || lowerPrompt.includes('code')) suggestedTools.push('File editing');
    if (lowerPrompt.includes('debug') || lowerPrompt.includes('run') || lowerPrompt.includes('build')) suggestedTools.push('Terminal');
    if (lowerPrompt.includes('research') || lowerPrompt.includes('api') || lowerPrompt.includes('docs')) suggestedTools.push('Web');
    if (suggestedTools.length === 0) suggestedTools.push('File editing');

    const guardrails = constraints.slice(0, 2).map(c => c.rule);
    const defaultArea = taskType === 'code_gen' ? 'Frontend development' : taskType === 'debugging' ? 'Bug diagnosis and fixes' : 'General execution';

    return [
      { question: 'What is the primary role for this agent?', answer: 'Not answered yet' },
      { question: 'Which domain should this agent specialize in?', answer: defaultArea },
      { question: 'Which tools should be prioritized?', answer: suggestedTools.join(', ') },
      { question: 'Any hard constraints to lock?', answer: guardrails.length > 0 ? guardrails.join(' | ') : (systemLimits.length > 0 ? systemLimits[0] : 'Not answered yet') }
    ];
  }

  async function analyze(prompt, history = [], ignoredSkills = []) {
    console.log("Analyzing mission with history:", history.length);
    try {
        // 1. LLM Analysis (The Brain)
        let llmResult = null;
        if (typeof LLMService !== 'undefined' && LLMService.hasKey()) {
            llmResult = await LLMService.analyzePrompt(prompt, history);
        }
        
        // 2. Identify Task Type & Objective
        const heuristicClassification = classifyTask(prompt);
        const normalizedTaskMap = {
            debug: 'debugging',
            debugging: 'debugging',
            code_gen: 'code_gen',
            refactor: 'refactor',
            multi_step: 'multi_step',
            analysis: 'analysis',
            research: 'research',
            simple_qa: 'simple_qa'
        };
        const llmTaskType = llmResult?.taskType ? String(llmResult.taskType).toLowerCase() : '';
        const typeKey = normalizedTaskMap[llmTaskType] || heuristicClassification.type || 'code_gen';
        const typeConfig = TASK_PATTERNS[typeKey] || TASK_PATTERNS.code_gen;
        const mission = llmResult?.mission || prompt;

        // 3. RAG Intent Engine (New AI-Native Layer)
        console.log("Performing RAG Retrieval from VectorStore...");
        const retrievedIntents = Store.search(prompt, 2);
        
        let suggestedSkills = [];
        
        // Map retrieved intents to strategic skills
        const intentMap = {
            "ui-standards": { name: "UI Consistency", ref: "/ui-standards-skill.md", rationale: "RAG Match: Detected high UI/Design affinity. Injecting layout guardrails to save tokens." },
            "clean-code": { name: "Coding Standards", ref: "/clean-code-skill.md", rationale: "RAG Match: Semantic link to quality patterns found. Enforcing clean code constraints." },
            "auth-protocol": { name: "Security Protocol", ref: "/auth-skill.md", rationale: "RAG Match: Security-related intent identified. Standardizing auth implementation." },
            "architecture": { name: "Architecture Guardrails", ref: "/arch-skill.md", rationale: "RAG Match: Agent setup mission detected. Forcing structural reviews." },
            "claude-agent": { name: "Claude Agent Guardrails", ref: "/claude-agent-skill.md", rationale: "RAG Match: Claude Agent workflow detected. Enforcing checkpoint-first delegation." }
        };

        retrievedIntents.forEach(intent => {
            const skill = intentMap[intent.id];
            if (skill && !suggestedSkills.some(s => s.ref === skill.ref)) {
                suggestedSkills.push({
                    ...skill,
                    pattern: intent.id,
                    score: intent.score
                });
            }
        });

        if (llmResult?.skill_candidate) {
            suggestedSkills.push(llmResult.skill_candidate);
        }

        const complexity = estimateComplexity(prompt, typeKey);
        let mergedConstraints = extractConstraints(prompt);
        const systemLimits = llmResult?.systemLimits || [];
        const learningProfile = getLearningProfile(typeKey);

        if (llmResult?.userConstraints) {
            llmResult.userConstraints.forEach(rule => {
                if (!mergedConstraints.some(c => c.rule === rule)) {
                    mergedConstraints.push({ type: 'explicit', rule });
                }
            });
        }      
        // 3.5 Agent Orchestration
        const leadAgent = Orchestrator.assign(typeKey, retrievedIntents);
        console.log(`Orchestrating mission with Lead Agent: ${leadAgent.id}`);

        // 4. Complexity & Metrics
        if (typeKey !== 'simple_qa') {
            mergedConstraints.push({ type: 'system', rule: 'Will ask for review before modifying critical files' });
        }

        // 4. Pattern Recognition
        const activeSkillBank = LOCAL_SKILL_BANK.filter(s => !ignoredSkills.includes(s.ref));
        const skillMatches = activeSkillBank.filter(s => new RegExp(s.pattern, 'i').test(prompt));
        
        // Identify potential NEW skills
        const newSkills = [];
        const isPatternAlreadySaved = (pattern) => activeSkillBank.some(s => 
            s.pattern.toLowerCase().includes(pattern.toLowerCase()) || 
            pattern.toLowerCase().includes(s.pattern.toLowerCase())
        );
        
        if (llmResult?.skill_candidate) {
            const candidate = llmResult.skill_candidate;
            if (!isPatternAlreadySaved(candidate.pattern)) {
                newSkills.push(candidate);
            }
        }

        // Merge suggested and new skills
        const allSuggestions = [...suggestedSkills, ...newSkills];

        // 5. Build Final Execution Assets
        const finalExecutionPlan = buildExecutionPlan(typeKey, complexity, { skillMatches, constraints: mergedConstraints }, learningProfile.checkpointPreference);
        const optimizationProfile = getOptimizationProfile(mergedConstraints, complexity, typeKey, [], skillMatches);
        const agentSetupQuestions = buildAgentSetupQuestions(prompt, typeKey, mergedConstraints, systemLimits);

        // 6. Recommendation logic
        let confidence = 85;
        let reasoning = "";
        if (optimizationProfile.mode === 'agent') {
            reasoning = "Complex mission detected. Delegating to a Claude Agent loop reduces manual overhead by 80%.";
            if (skillMatches.length > 0) reasoning += " Applying saved /skill workflows to optimize accuracy.";
            if (systemLimits.length > 0) reasoning += ` Managing identified system limits: ${systemLimits.join(', ')}.`;
            // Historical success rate intentionally omitted to keep reasoning concise
        } else {
            reasoning = "Deterministic task. Manual Claude prompting ensures immediate delivery.";
        }

        if (learningProfile.checkpointPreference === 'strict') confidence = Math.min(99, confidence + 5);
        if (learningProfile.checkpointPreference === 'light') confidence = Math.max(50, confidence - 5);

        return {
            id: 'pf_' + Date.now(),
            platform: 'Claude',
            prompt,
            mission,
            leadAgent,
            systemLimits,
            taskType: typeKey,
            taskLabel: typeConfig.label,
            taskIcon: typeConfig.icon, 
            complexity,
            constraints: mergedConstraints,
            skillMatches,
            suggestedSkills: allSuggestions,
            agentSetupQuestions,
            learningProfile,
            executionPlan: finalExecutionPlan,
            optimizationProfile,
            recommendation: {
                mode: optimizationProfile.mode,
                confidence,
                reasoning
            }
        };
    } catch (e) {
        console.error("Analysis failed:", e);
        // Bulletproof fallback
        return {
            id: 'pf_err_' + Date.now(),
            prompt,
            mission: "Execution Plan (Fallback)",
            systemLimits: [],
            taskType: 'code_gen',
            taskLabel: 'Code Generation',
            taskIcon: '⚡',
            complexity: { riskLevel: 'low', stepCount: 3 },
            constraints: [],
            skillMatches: [],
            suggestedSkills: [],
            agentSetupQuestions: [],
            learningProfile: getLearningProfile('code_gen'),
            executionPlan: { steps: [] },
            optimizationProfile: { tokens: 50, quality: 50, latency: 50, bullets: ["Standard execution path"], mode: "agent" },
            recommendation: { mode: "agent", confidence: 50, reasoning: "Error in analysis engine. Using safe defaults." }
        };
    }
  }

  return { analyze, saveNewSkill, recordOutcome, setCheckpointPreference, getLearningProfile };
})();

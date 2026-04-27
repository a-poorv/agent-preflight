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

  function buildExecutionPlan(taskType, complexity, analysis = null) {
    const template = STEP_TEMPLATES[taskType] || STEP_TEMPLATES.simple_qa;
    const steps = template.map((s, idx) => {
      let step = { 
        ...s, 
        id: idx + 1,
        tokens: s.tokens + Math.round((Math.random() - 0.5) * 400),
        checkpoint: s.checkpoint || false
      };
      
      // Mimic skill injection logic
      if (analysis && analysis.contextTriggers && analysis.contextTriggers.length > 0) {
        if (idx === 0) {
           step.skillRef = '/shared-context.md';
           step.desc = `[Recalling Patterns] ${step.desc}`;
        }
      }
      
      if (analysis && analysis.constraints && analysis.constraints.some(c => c.type === 'boundary')) {
        if (idx === template.length - 1) {
           const skillMatch = analysis.skillMatches && analysis.skillMatches.length > 0 ? analysis.skillMatches[0].ref : '/boundary-skill.md';
           step.skillRef = skillMatch;
           step.desc = `[Applying Guardrails] ${step.desc}`;
        }
      }
      
      return step;
    });

    if (complexity.riskLevel === 'high') {
      steps.forEach(s => { if (s.risk === 'medium' || s.risk === 'high') s.checkpoint = true; });
    }

    return { steps, totalSteps: steps.length };
  }

  function getOptimizationProfile(constraints, riskLevel, taskType, contextTriggers = [], skillMatches = []) {
    const isHighRiskOrMultiStep = riskLevel === 'high' || taskType === 'multi_step' || taskType === 'code_gen';
    const hasContext = contextTriggers.length > 0 || skillMatches.length > 0;
    
    if (isHighRiskOrMultiStep) {
      const totalEfficiency = skillMatches.reduce((acc, s) => acc + s.efficiency, 0);
      return {
        description: hasContext ? "Delegated agentic flow with verified skill matches. Pattern recall reduces token overhead." : "Unstructured agentic flow — requires full exploration which increases token consumption.",
        tokens: Math.max(10, (hasContext ? 20 : 35) - totalEfficiency),
        quality: 95,
        latency: hasContext ? 30 : 45,
        bullets: hasContext ? [
          "Minimize reasoning overhead using /skill workflows",
          "Recall existing implementation patterns",
          "Prioritize execution integrity over speed",
          "Automated boundary verification"
        ] : [
          "Full exploration loop required",
          "High token consumption for context-building",
          "Manual intervention likely at checkpoints",
          "Self-correction enabled"
        ],
        mode: "agent",
        profileType: hasContext ? "balanced" : "quality"
      };
    } else if (taskType === 'simple_qa') {
      return {
        description: "Simple task detected. Optimizing for speed and minimal token usage.",
        tokens: 15,
        quality: 75,
        latency: 10,
        bullets: [
          "Direct single-shot response",
          "No planning phase required"
        ],
        mode: "manual",
        profileType: "speed"
      };
    } else {
      return {
        description: "No strong signal either way — I'll keep tokens, quality, and speed in proportion.",
        tokens: 65,
        quality: 75,
        latency: 65,
        bullets: [
          "Plan briefly, then execute",
          "Verify only critical changes",
          "Ask before destructive ops"
        ],
        mode: "agent",
        profileType: "balanced"
      };
    }
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
        const typeKey = llmResult?.taskType || heuristicClassification.type || 'code_gen';
        const typeConfig = TASK_PATTERNS[typeKey] || TASK_PATTERNS.code_gen;
        const mission = llmResult?.mission || prompt.substring(0, 60) + '...';

        // 3. Complexity & Constraints
        const complexity = estimateComplexity(prompt, typeKey);
        
        let mergedConstraints = extractConstraints(prompt);
        if (llmResult?.userConstraints) {
            llmResult.userConstraints.forEach(rule => {
                if (!mergedConstraints.some(c => c.rule === rule)) {
                    mergedConstraints.push({ type: 'explicit', rule });
                }
            });
        }
        
        // System Limits (New AI-Native Layer)
        const systemLimits = llmResult?.systemLimits || [];
        if (typeKey !== 'simple_qa') {
            mergedConstraints.push({ type: 'system', rule: 'Will ask for review before modifying critical files' });
        }

        // 4. Pattern Recognition
        const activeSkillBank = LOCAL_SKILL_BANK.filter(s => !ignoredSkills.includes(s.ref));
        const skillMatches = activeSkillBank.filter(s => new RegExp(s.pattern, 'i').test(prompt));
        
        // Identify potential NEW skills
        const suggestedSkills = [];
        const isPatternAlreadySaved = (pattern) => activeSkillBank.some(s => 
            s.pattern.toLowerCase().includes(pattern.toLowerCase()) || 
            pattern.toLowerCase().includes(s.pattern.toLowerCase())
        );
        
        if (llmResult?.skill_candidate) {
            const candidate = llmResult.skill_candidate;
            if (!isPatternAlreadySaved(candidate.pattern)) {
                suggestedSkills.push(candidate);
            }
        }

        // 5. Build Final Execution Assets
        const finalExecutionPlan = buildExecutionPlan(typeKey, complexity, { skillMatches, constraints: mergedConstraints });
        const optimizationProfile = getOptimizationProfile(mergedConstraints, complexity.riskLevel, typeKey, [], skillMatches);

        // 6. Recommendation logic
        let confidence = 85;
        let reasoning = "";
        if (optimizationProfile.mode === 'agent') {
            reasoning = "Complex mission detected. Delegating to an agent loop reduces manual overhead by 80%.";
            if (skillMatches.length > 0) reasoning += " Applying saved /skill workflows to optimize accuracy.";
            if (systemLimits.length > 0) reasoning += ` Managing identified system limits: ${systemLimits.join(', ')}.`;
        } else {
            reasoning = "Deterministic task. Direct execution ensures immediate delivery.";
        }

        return {
            id: 'pf_' + Date.now(),
            prompt,
            mission,
            systemLimits,
            taskType: typeKey,
            taskLabel: typeConfig.label,
            taskIcon: typeConfig.icon, 
            complexity,
            constraints: mergedConstraints,
            skillMatches,
            suggestedSkills,
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
            executionPlan: { steps: [] },
            optimizationProfile: { tokens: 50, quality: 50, latency: 50, bullets: ["Standard execution path"], mode: "agent" },
            recommendation: { mode: "agent", confidence: 50, reasoning: "Error in analysis engine. Using safe defaults." }
        };
    }
  }

  return { analyze, saveNewSkill };
})();

const LLMService = (function() {
  let apiKey = localStorage.getItem('preflight_api_key') || '';

  function setApiKey(key) {
    apiKey = key;
    localStorage.setItem('preflight_api_key', key);
  }

  function hasKey() {
    return apiKey && apiKey.length > 10;
  }

  async function analyzePrompt(prompt, history = []) {
    if (!hasKey()) {
      // Fallback to local heuristic if no key is provided
      return null; 
    }

    const systemPrompt = `You are the Pre-Flight Execution Planner for an Agentic System.
Design an optimized execution path by bifurcating input into:
1. MISSION_INTENT: The core objective.
2. SYSTEM_LIMITS: Potential bottlenecks (large file counts, complex refactors).
3. USER_CONSTRAINTS: Explicit rules.
4. STRATEGIC_SKILLS: Patterns for /.skill.md.

Output valid JSON:
{
  "mission": "Core objective summary",
  "taskType": "code_gen | refactor | debug | multi_step | analysis",
  "systemLimits": ["list of bottlenecks"],
  "userConstraints": ["extracted rules"],
  "skill_candidate": {
    "name": "Refined Name",
    "pattern": "regex trigger",
    "ref": "/name-skill.md",
    "rationale": "Why this optimization helps"
  }
}`;

    const userContent = history.length > 0 
      ? `History: ${JSON.stringify(history.slice(-3))}\n\nCurrent Prompt: ${prompt}`
      : prompt;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      clearTimeout(timeoutId);
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      if (error.name === 'AbortError') console.warn('LLM Analysis timed out - falling back to heuristic');
      else console.error('LLM Analysis failed:', error);
      return null;
    }
  }

  return { setApiKey, hasKey, analyzePrompt };
})();

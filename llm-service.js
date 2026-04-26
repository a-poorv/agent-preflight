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

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s strict timeout

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
            {
              role: 'system',
              content: `Analyze this developer prompt and return a JSON object for a pre-flight check.
        Focus on:
        1. Task classification (debugging, refactor, etc.)
        2. Complexity (Low/Medium/High)
        3. Strategic steps (3-5 steps)
        4. Operational Patterns: Identify reusable rules (e.g., 'don't change behavior', 'coding standards').
        5. Skill Suggestion: If you see a recurring habit, suggest a name and pattern for a shortcut.

        Return EXACTLY this JSON structure:
        {
          "type": "refactor",
          "complexity": "Medium",
          "confidence": 85,
          "steps": [{"action": "Analyze", "desc": "...", "checkpoint": false}],
          "constraints": ["don't change behavior", "propose 3 solutions"],
          "reasoning": "...",
          "skill_candidate": { "name": "Preserve Behavior", "pattern": "don't change behavior", "ref": "/behavior-guard.md" }
        }`
            },
            ...history.map(h => ({ role: 'user', content: h })),
            { role: 'user', content: prompt }
          ],
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

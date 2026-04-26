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
              content: `You are the Pre-Flight Analysis engine for an agentic coding system. 
              Analyze the user prompt and return a JSON object with:
              - taskType: (debugging, code_gen, refactor, analysis, multi_step, simple_qa)
              - taskLabel: User friendly label
              - confidence: 0-1
              - reasoning: Detailed PM-style reasoning about cognitive load and delegation
              - constraints: Array of {type, rule}
              - contextTriggers: Array of {type, rule}
              - patternDetected: (Optional) Description of identified user prompting patterns based on history.`
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

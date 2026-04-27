interface LLMResult {
  mission?: string;
  taskType?: string;
  systemLimits?: string[];
  userConstraints?: string[];
  skill_candidate?: {
    name: string;
    pattern: string;
    ref: string;
    rationale: string;
  };
}

const LLMService = (() => {
  let apiKey = localStorage.getItem('preflight_api_key') || '';

  function setApiKey(key: string): void {
    apiKey = key;
    localStorage.setItem('preflight_api_key', key);
  }

  function hasKey(): boolean {
    return apiKey.length > 10;
  }

  async function analyzePrompt(prompt: string, history: string[] = []): Promise<LLMResult | null> {
    if (!hasKey()) return null;

    const systemPrompt = `You are the Pre-Flight Execution Planner for an Agentic System.
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
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      clearTimeout(timeoutId);
      if (!response.ok) return null;

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      return JSON.parse(data.choices[0].message.content) as LLMResult;
    } catch {
      return null;
    }
  }

  return { setApiKey, hasKey, analyzePrompt };
})();

export default LLMService;

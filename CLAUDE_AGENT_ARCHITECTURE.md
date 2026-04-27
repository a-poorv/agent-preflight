# Claude Agent Compass — Architecture & Product Brief

## The Problem

Claude users aren't blocked by capability. They are blocked by **decisions**:

- Should I use simple prompting or delegate to a Claude Agent?
- What will actually happen if I delegate this task?
- How do constraints and skills affect token usage, quality, and risk?

These decisions happen silently — and when they go wrong, users get silent failures, wasted tokens, and low trust in agentic delegation.

---

## The Product Solution

**Claude Agent Compass** is a decision-first pre-flight layer that appears _before_ execution. It gives users a clear, structured view of what will happen — and lets them tune it before it starts.

Three questions answered by default:
1. Should this task be agentic?
2. Which constraints are active?
3. Is there a skill opportunity to reduce retries and tokens?

Advanced detail is opt-in. This keeps decision quality high without overwhelming.

---

## Tech Stack (Current Prototype)

| Layer | Technology |
|---|---|
| Frontend | Vite + TypeScript (vanilla) |
| Analysis Engine | Heuristic RAG + optional OpenAI API |
| Skill API | Node.js + Express (REST, file-persisted) |
| Skill Storage | `data/skills.json` (server) + localStorage (fallback) |
| Deployment | Vercel (static frontend) |

---

## System Design — 4 Engines

### Engine 1: Intent Router
**What it does:** Classifies the prompt as `manual` vs `agentic` and estimates risk.

Inputs → Prompt text, task history  
Outputs → Recommendation (`Use Claude Agent` / `Stay Manual`), confidence score, 1-line reasoning

### Engine 2: Constraint + Skill Engine
**What it does:** Extracts boundary conditions from the prompt and surfaces system limits. Only proposes skill creation when a real recurring constraint is detected (not on every task).

Inputs → Prompt text, system limits, existing skill bank  
Outputs → Constraint chips, skill opportunity panel (gated by boundary detection), `Skill optimized` badge post-add

**Skill suggestion logic (when it fires):**
- Task type is `debugging`, `refactor`, `code_gen`, or `multi_step`
- AND the prompt has explicit/boundary constraints (`don't change behavior`, `keep X intact`) OR system limits are detected
- Simple Q&A and analysis tasks never show a skill suggestion

### Engine 3: Intervention Engine
**What it does:** Monitors confidence drift during simulated agent execution and escalates checkpoints before silent failure.

Inputs → Step risk level, mission risk, execution progress ratio  
Outputs → Runtime intervention banner (medium/high drift), paused step with approve/manual-override gate

### Engine 4: Learning Profile
**What it does:** Tracks checkpoint preferences and success rates by task type across sessions.

Inputs → Task type, outcome (success / manual)  
Outputs → Adaptive checkpoint strictness, per-type success rate (stored in localStorage)

---

## Skill Flow — Fully Functional

```
User prompt has constraint detected
         ↓
Skill Opportunity panel appears
(shows boundary reason, not generic text)
         ↓
User picks: Add Skill | Edit | Discard
         ↓
Add Skill → POST /api/skills → saved to skills.json
         ↓
Re-analysis runs → skill now matches → "Skill optimized" badge
         ↓
During agent run → skill ref injected into relevant step badges
```

Edit opens inline input (no browser `prompt()` dialog).  
Discard adds ref to `ignoredSkillRefs` — excluded from future suggestions.  
All buttons disable with opacity during async re-analysis (loading state).

---

## User Journey (5 Steps)

1. **Enter prompt** — any task description
2. **Pre-flight analysis** — RAG retrieval + intent classification (2–3 sec)
3. **Review the compass card:**
   - Recommendation + reasoning
   - Detected constraints
   - Skill opportunity _(only if boundary detected)_
   - Agent setup questions _(agent mode only)_
   - Expandable step plan + optimization profile
4. **Choose path:**
   - Proceed with Claude Agent → simulated execution with live step updates
   - Modify Prompt → pre-populate input with current text
   - Stay Manual → chat mode response
5. **During execution:**
   - Steps animate through pending → running → done
   - Checkpoints pause for human approval
   - High-risk drift triggers proactive intervention banner
   - Each step can be manually overridden

---

## UX Principles

**Progressive disclosure** — Default view shows only what matters for the decision. Details are behind "Show details."

**Boundary-gated suggestions** — Skill opportunities appear only when the system detects a real recurring constraint worth encoding. Not on every prompt.

**Explainable recommendations** — Every recommendation comes with a 1-line reason. Every skill suggestion shows what boundary triggered it.

**Reversible actions** — Discard, Edit, Cancel, Manual override — every action has an escape hatch.

---

## Phase Roadmap

| Phase | Focus | Status |
|---|---|---|
| 1 | Decision Advisor — intent, constraints, skill suggestion | ✅ Done |
| 2 | Guided Execution — checkpoints, pause/approve, step-level override | ✅ Done |
| 3 | Learning Loop — checkpoint preference memory, outcome tracking | ✅ Done |
| 4 | Proactive Intervention — runtime drift scoring, auto-escalation | ✅ Done |
| 5 | Real Agent Integration — live Claude API execution, skill.md file writes | 🔜 Next |

---

## Success Metrics

| Metric | What it measures |
|---|---|
| First-run success rate | Users who delegated and got the result they wanted |
| Retry count per task | Wasted iterations before a correct outcome |
| Token waste per successful task | Efficiency of constraint + skill layer |
| Claude Agent adoption rate | Whether users trust and use agent mode |
| Time-to-confident-decision | UX efficiency of the pre-flight card |

---

## API Reference (Skill CRUD)

```
GET    /api/skills              → list all skills
POST   /api/skills              → { name, pattern, ref, efficiency }
PATCH  /api/skills/:ref         → { name?, pattern?, efficiency? }
DELETE /api/skills/:ref         → removes skill
```

Skills persist in `data/skills.json` server-side, with localStorage as fallback when API is unavailable (e.g. static Vercel deployment).

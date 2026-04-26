# 🛫 Agent Pre-Flight System

> **Product Solution for Claude's Agentic Capability Adoption**
> Submitted as part of the Growth PM Lens — Anthropic

---

## 🎯 Problem Statement

As Claude evolves beyond simple prompting, users can now perform complex tasks through **Skills, Agents, and Workflows**. But this introduces a new decision layer:

- Users **can't predict** when to use agentic mode vs manual prompting
- They **don't understand** what the agent will do before it starts
- They **waste tokens** through trial-and-error
- They **fail to adopt** advanced capabilities despite their potential

**Result:** Low agent adoption (~20%), high failure rate (~35%), and 3.2 retries per task on average.

---

## 💡 Solution: Agent Pre-Flight

Before any agent executes, the system **analyzes the user's prompt** and presents a transparent **execution preview** — showing the plan, constraints, token budget, and risk level. The user then decides: **Proceed**, **Modify**, or **Switch to Manual**.

### How It Works

```
User Prompt → Task Classifier → Complexity Estimator → Constraint Extractor
                                                              ↓
                    Execution Preview ← Decision Engine ← Execution Planner
                           ↓
           [▶ Proceed]  [✏️ Modify]  [📝 Manual Mode]
```

### Core Innovation

The **Pre-Flight Card** turns the "black box" of agentic execution into a transparent, controllable process:

| Before Pre-Flight | After Pre-Flight |
|---|---|
| "I hope this agent does what I want" | "I can see exactly what it will do" |
| No idea about token cost | Token budget shown upfront |
| Agent runs unchecked | Checkpoints pause for user review |
| Trial-and-error | Informed decision-making |

### The Token Optimization Loop: Agent vs. Workflow

A key PM challenge in agent adoption is **token efficiency and execution determinism**. The Pre-Flight system introduces a clear paradigm to solve this:

1. **Agent Execution (Exploratory):** High autonomy, high token usage. Best for net-new problems where Claude must dynamically plan and reason through steps (e.g., "Fix this unknown bug").
2. **Workflow Execution (Deterministic):** Low token usage, high reliability. Once a task is solved repeatedly (e.g., "Review PR for security"), the dynamic planning phase becomes redundant.
3. **The Value Proposition:** The system acts as a "Token Optimization Loop." It detects when an Agent is repeatedly solving similar tasks and suggests converting the successful execution plan into a **Workflow Template**. This bypasses the expensive reasoning/planning phase, saving ~40% in token costs, and ensures the exact same tools and constraints are reliably applied every time.

---

## 🏗️ Architecture

### Core Components

1. **Task Classifier** — Categorizes user intent (debugging, code gen, analysis, refactor, research, multi_step, Q&A)
2. **Complexity Estimator** — Scores step count, context load, risk level, and token budget.
3. **Constraint Extractor** — Parses explicit ("don't modify tests") and implicit (read-only analysis) boundaries.
4. **Context Engine** — Scans for "Context Links" (references to existing work) and matches them against the **Skill Bank** (`/skill.md` recall).
5. **Execution Planner** — Generates a step-by-step plan with visual "Skill Badges" showing exactly where optimizations are applied.
6. **Intelligent Pattern Detector** — Identifies recurring "Operational Habits" (e.g., requesting multiple solutions) and suggests converting them into permanent skills to optimize future tokens.
7. **Decision Engine** — Recommends Agent vs Manual mode by resolving the "Decision Blind Spot" regarding risk and cost.

### System Flow

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ User enters │ ──→ │  Pre-Flight     │ ──→ │  Execution       │
│ prompt      │     │  Analysis       │     │  Preview Card    │
└─────────────┘     └─────────────────┘     └──────────────────┘
                                                     │
                                          ┌──────────┼──────────┐
                                          ▼          ▼          ▼
                                     [Proceed]  [Modify]  [Manual]
                                          │
                                          ▼
                                    ┌──────────────┐
                                    │ Step-by-Step │
                                    │ Execution    │
                                    │ w/ Checkpoints│
                                    └──────────────┘
```

---

## 🖥️ Prototype Demo

### 📍 [Live Demo →](https://agent-preflight.vercel.app/)

> The prototype is live and fully interactive in the browser.

### What to Try

1. **Click any quick prompt pill** — e.g., "Debug auth flow" or "Build REST API"
2. **Review the Pre-Flight Card** — See task type, complexity, token estimate, and execution plan
3. **Click "Proceed with Agent"** — Watch the step-by-step execution with real-time progress
4. **Hit a checkpoint** — Agent pauses for your review before critical steps
5. **Try "Quick question"** — Notice it recommends Manual Mode instead of Agent Mode
6. **Try "Modify Plan"** — Add constraints like "Don't modify test files"

---

## 📊 Target Metrics

| Metric | Baseline | Target | How Pre-Flight Helps |
|--------|----------|--------|---------------------|
| Agent adoption rate | ~20% | 60%+ | Reduces fear of the unknown |
| Failed agent runs | ~35% | <10% | Better task-mode matching |
| User retries/task | 3.2 avg | <1.5 | Right approach on first try |
| Task completion rate | 55% | 85%+ | Transparent execution with control |
| Time to first agent use | 15 min | <3 min | Guided onboarding via Pre-Flight |

---

## 🔮 Future Roadmap

| Phase | Feature | Impact |
|-------|---------|--------|
| **v0.2** | Real Claude API integration | Live task analysis |
| **v0.3** | Team workflow library | Shared best practices |
| **v0.4** | Cost forecasting with historical data | Budget optimization |
| **v0.5** | A/B test: Pre-Flight ON vs OFF | Validate adoption lift |

---

## 🧩 Build Phases

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 | Claude-Code-style terminal UI | ✅ Complete |
| Phase 2 | Pre-Flight analysis engine (classifier, estimator, planner) | ✅ Complete |
| Phase 3 | Decision layer (Agent vs Manual + user controls) | ✅ Complete |
| Phase 4 | Execution simulation with checkpoints & progress tracking | ✅ Complete |
| Phase 5 | Learning layer (pattern detection, workflow templates) | ✅ Complete |

---

## 🛠️ Tech Stack

- **Frontend:** HTML + CSS + Vanilla JS (no framework dependencies)
- **Design:** Claude-Code-inspired dark terminal aesthetic
- **Logic:** Client-side simulated analysis engine
- **Storage:** LocalStorage for learning layer persistence

---

## 📁 Project Structure

```
├── index.html           # UI structure
├── styles.css           # Design system (dark theme, animations)
├── preflight-engine.js  # Analysis engine (6 core components)
├── app.js               # UI controller + execution simulation
└── README.md            # This file
```

---

## 🚀 Deployment

### Quick: Open Locally
Just double-click `index.html` — no server needed.

### Share: Deploy to GitHub Pages
```bash
git init
git add .
git commit -m "Agent Pre-Flight System prototype"
git remote add origin https://github.com/YOUR_USERNAME/agent-preflight.git
git push -u origin main
# Then enable GitHub Pages in repo Settings → Pages → Source: main branch
```

### Alternative: Netlify (Drag & Drop)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the entire project folder onto the page
3. Get an instant shareable link

---

*Built as a Product Solution for the Anthropic Growth PM challenge — focusing on Claude's agentic capability adoption.*

# Claude Agent Compass — Diagrams for Presentation

Copy any Mermaid block below into [mermaid.live](https://mermaid.live) to export as PNG/SVG for slides.

---

## 1. User Flow (PM-friendly — for stakeholder slides)

```mermaid
flowchart TD
    A([👤 User enters a prompt]) --> B[Pre-Flight Analysis\n2–3 sec RAG + intent engine]

    B --> C{Is this task\nagentic?}

    C -- Yes --> D[Show Agent Compass Card\n• Recommendation\n• Constraints detected\n• Skill opportunity if boundary found\n• Step plan preview]
    C -- No --> E[Show Manual Mode Card\n• Recommendation: Stay Manual\n• Direct response path]

    D --> F{User Decision}

    F -- Proceed with Agent --> G[Simulated Agent Execution\nStep-by-step with live updates]
    F -- Modify Prompt --> A
    F -- Stay Manual --> E

    G --> H{Checkpoint\nor Drift?}

    H -- Checkpoint hit --> I[⏸ Pause for Human Approval\nApprove or Switch to Manual]
    H -- High drift detected --> J[🔔 Proactive Intervention Banner\nEscalate checkpoint automatically]
    H -- Clean run --> K[✅ Execution Complete]

    I --> K
    J --> I
    E --> K
```

---

## 2. Skill Suggestion Flow (when it fires and when it doesn't)

```mermaid
flowchart LR
    P([Prompt submitted]) --> T{Task type?}

    T -- simple_qa / analysis / research --> X[❌ No skill suggestion\nOne-off task]
    T -- debugging / refactor\ncode_gen / multi_step --> B{Boundary condition\ndetected?}

    B -- No constraints\nNo system limits --> X
    B -- Explicit constraint\ne.g. don't change behavior --> S[✅ Show Skill Opportunity\nReason shown clearly]
    B -- System limit detected\nfrom tools or files --> S

    S --> U{User action}
    U -- Add Skill --> API[POST /api/skills\nSaved to skills.json]
    U -- Edit --> EDIT[Inline name editor\nSave → re-analyze]
    U -- Discard --> IGN[Add to ignore list\nHide from future runs]

    API --> RA[Re-analyze prompt]
    EDIT --> RA
    RA --> BADGE[🔶 Skill optimized badge\nappears in recommendation]
```

---

## 3. System Architecture (Technical — for engineering slides)

```mermaid
flowchart TD
    subgraph Browser["🌐 Browser (Vite + TypeScript)"]
        UI[app.ts\nUI Logic + Event Binding]
        ENG[engine.ts\nRAG · Classification · Plan Builder]
        LLM[llm-service.ts\nOpenAI API optional]
        LS[(localStorage\nSkill Bank fallback\nLearning profiles)]
        UI --> ENG
        ENG --> LLM
        ENG <--> LS
    end

    subgraph Server["🖥 Node.js Server (Express)"]
        API[/api/skills\nGET · POST · PATCH · DELETE]
        FILE[(data/skills.json\nPersisted skill bank)]
        API <--> FILE
    end

    subgraph Vercel["☁️ Vercel Deployment"]
        STATIC[Static Frontend\ndist/ from vite build]
    end

    UI <-->|/api/skills calls\nFalls back to localStorage\nif server unavailable| API
    Browser --> Vercel
```

---

## 4. The 4-Engine Model (1-slide overview)

```mermaid
flowchart LR
    PR([Prompt]) --> E1

    subgraph E1["⚡ Engine 1\nIntent Router"]
        E1A[Classify: manual vs agentic]
        E1B[Estimate risk + complexity]
        E1C[Generate reasoning]
    end

    subgraph E2["🛡 Engine 2\nConstraint + Skill Engine"]
        E2A[Extract boundary conditions]
        E2B[Detect system limits]
        E2C[Suggest skill — only when\nboundary detected]
    end

    subgraph E3["🔔 Engine 3\nIntervention Engine"]
        E3A[Score confidence drift per step]
        E3B[Escalate checkpoints]
        E3C[Offer manual override]
    end

    subgraph E4["🧠 Engine 4\nLearning Profile"]
        E4A[Track outcomes by task type]
        E4B[Adapt checkpoint strictness]
        E4C[Tune confidence scoring]
    end

    E1 --> E2 --> Card([Pre-Flight Card])
    Card --> Exec([Agent Execution])
    Exec --> E3 --> E4
    E4 -->|Feeds back into| E1
```

---

## 5. Pre-Flight Card — Anatomy (UI breakdown for slides)

```mermaid
flowchart TD
    CARD["📋 Pre-Flight Card"]

    CARD --> REC["🎯 Recommendation\nUse Claude Agent / Stay Manual\nConfidence level · 1-line reason"]
    CARD --> CHIPS["🔒 Constraint Chips\nDetected boundary conditions\n(only explicit + boundary types shown)"]
    CARD --> SKILL["💡 Skill Opportunity\n(only appears when boundary detected)\nAdd Skill · Edit · Discard"]
    CARD --> AGENT["🤖 Agent Setup Questions\n(agent mode only)\nDomain · Tools · Hard constraints"]
    CARD --> DETAIL["📐 Show Details (expandable)\nStep plan · Token · Quality · Latency bars"]
    CARD --> ACTIONS["▶️ Actions\nProceed · Modify Prompt · Stay Manual"]
```

---

## 6. Phase Roadmap (Timeline for slides)

```mermaid
timeline
    title Claude Agent Compass — Phase Roadmap
    Phase 1 : Decision Advisor
            : Intent classification
            : Constraint visibility
            : Basic skill suggestion
    Phase 2 : Guided Execution
            : Risk-based checkpoints
            : Pause and approve controls
            : Step-level manual override
    Phase 3 : Learning Loop
            : Checkpoint preference memory
            : Outcome tracking per task type
            : Adaptive tuning
    Phase 4 : Proactive Intervention
            : Runtime drift scoring
            : Auto-escalated checkpoints
            : Confidence sparkline
    Phase 5 : Real Integration
            : Live Claude API execution
            : skill.md file writes
            : Multi-agent orchestration
```

---

> **How to export for PPT:**
> 1. Go to [mermaid.live](https://mermaid.live)
> 2. Paste any block above
> 3. Click **Export → PNG** (transparent background) or **SVG**
> 4. Insert into PowerPoint / Google Slides as image

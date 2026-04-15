# Intelligent Wealth Advisor — Demo UX & Sample Flow

## The Persona

**User:** Sarah Chen, a Relationship Manager (RM) at a large retail bank. She manages 150+ high-net-worth clients and uses the Wealth Advisor AI as her daily copilot to prepare for meetings, answer client questions, and track portfolio changes.

**Client in this demo:** James Morrison, 52, senior executive. Long-standing client with a diversified portfolio (~$2.4M AUM). Planning for retirement in ~5 years.

---

## Architecture — How Live Transcript Flows Through Redis

```
┌──────────────┐      ┌────────────────────┐      ┌─────────────────────────┐
│ Google Meet  │      │  Transcript        │      │  Redis Agent Memory     │
│ Media API    │─────▶│  Ingestion Service │─────▶│  Server                 │
│ (live audio) │      │  (streaming chunks)│      │                         │
└──────────────┘      └────────────────────┘      │  ┌───────────────────┐  │
                             │                     │  │ Working Memory    │  │
                             │ real-time           │  │ (live transcript  │  │
                             │ transcript          │  │  chunks, current  │  │
                             │ chunks              │  │  meeting context) │  │
                             │                     │  └────────┬──────────┘  │
                             ▼                     │           │ auto        │
                      ┌────────────────────┐      │           │ extraction  │
                      │  AI Advisor Agent  │◀────▶│           ▼             │
                      │  (LangGraph)       │      │  ┌───────────────────┐  │
                      │                    │      │  │ Long-term Memory  │  │
                      │  - suggestions│      │  │ (durable facts,   │  │
                      │  - Q&A             │      │  │  client prefs,    │  │
                      │  - post-call notes │      │  │  life events)     │  │
                      └────────────────────┘      │  └───────────────────┘  │
                             │                     │                         │
                             ▼                     │  ┌───────────────────┐  │
                      ┌────────────────────┐      │  │ Summarization     │  │
                      │  Redis Hybrid      │      │  │ (multi-session    │  │
                      │  Search + RAG      │      │  │  condensation)    │  │
                      │  + LangCache       │      │  └───────────────────┘  │
                      └────────────────────┘      └─────────────────────────┘
```

**How it works:**

1. Google Meet Media API streams real-time audio → a transcription service (Gemini / Deepgram) converts to text chunks
2. Each transcript chunk is written to Redis **working memory** with speaker labels and timestamps
3. The AI agent reads working memory continuously — detects topics, sentiment shifts, and actionable items as they happen
4. After the call, Redis auto-extracts **long-term memories** (durable facts, decisions, life events) from the full transcript
5. **Summarization** condenses the transcript into key points and merges with prior session summaries
6. **Memory maintenance** ages out stale info, marks resolved items, and keeps the memory store clean

---

## UI Screens

### Screen 1 — Client Dashboard (Home)

_Where Sarah starts her day. Shows all her clients at a glance._

```
┌──────────────────────────────────────────────────────────────────────┐
│  WEALTH ADVISOR AI                                 Sarah Chen (RM)  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔍 Search clients...                         [+ New Client]        │
│                                                                      │
│  TODAY'S SCHEDULE                                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  10:00 AM  James Morrison     📞 Quarterly review             │  │
│  │  11:30 AM  Priya Kapoor       📹 Google Meet — portfolio      │  │
│  │   2:00 PM  David & Lisa Park  📹 Google Meet — estate plan    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  CLIENT CARDS                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ James Morrison   │  │ Priya Kapoor     │  │ David Park       │   │
│  │ AUM: $2.4M       │  │ AUM: $1.8M       │  │ AUM: $3.1M       │   │
│  │ Risk: Moderate    │  │ Risk: Aggressive  │  │ Risk: Conserv.   │   │
│  │                   │  │                   │  │                   │   │
│  │ ⚡ 3 pending      │  │ ✅ No actions     │  │ ⚡ 1 pending      │   │
│  │    actions        │  │                   │  │    action         │   │
│  │                   │  │                   │  │                   │   │
│  │ Last meeting:     │  │ Last meeting:     │  │ Last meeting:     │   │
│  │ Jan 15 (42d ago)  │  │ Feb 10 (16d ago)  │  │ Dec 5 (83d ago)  │   │
│  │                   │  │                   │  │                   │   │
│  │ AI memory:        │  │ AI memory:        │  │ AI memory:        │   │
│  │ 12 facts │ 7 sess │  │ 8 facts │ 4 sess  │  │ 15 facts │ 9 sess│   │
│  │                   │  │                   │  │                   │   │
│  │ [Open Profile]    │  │ [Open Profile]    │  │ [Open Profile]    │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                      │
│  ALERTS                                                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ ⚠ James Morrison — REIT rebalance pending since Jan 15        │  │
│  │ 📈 Priya Kapoor — portfolio up 12% YTD, above target          │  │
│  │ 🕐 David Park — no meeting in 83 days, suggest outreach       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  © Acme Bank — Powered by Redis                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Screen 2 — Client Profile & Chat (Pre-Call Prep)

_Sarah clicks into James Morrison's profile. The AI advisor chat panel is on the right._

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back    JAMES MORRISON                        Sarah Chen (RM)    │
├────────────────────┬─────────────────────────────────────────────────┤
│                    │                                                  │
│  CLIENT INFO       │  AI ADVISOR CHAT                                │
│  ┌──────────────┐  │  ┌─────────────────────────────────────────┐   │
│  │ James        │  │  │ 🤖 Good morning Sarah. James's 10am   │   │
│  │ Morrison     │  │  │    call is in 25 minutes. Want a        │   │
│  │ Age: 52      │  │  │    briefing?                            │   │
│  │ AUM: $2.4M   │  │  │                                         │   │
│  │ Risk: Mod.   │  │  │ 👤 Yes, give me the full briefing.     │   │
│  │ Goal: $3M by │  │  │                                         │   │
│  │   2031       │  │  │ 🤖 Here's your briefing for James:     │   │
│  └──────────────┘  │  │                                         │   │
│                    │  │    Portfolio snapshot:                    │   │
│  MEMORY INSIGHTS   │  │    ┌────────────────────────────┐       │   │
│  ┌──────────────┐  │  │    │ Equities  45%  +8.2% YTD  │       │   │
│  │ 12 long-term │  │  │    │ Bonds     30%  +3.1%      │       │   │
│  │ facts stored │  │  │    │ REITs     15%  -2.4%      │       │   │
│  │              │  │  │    │ Cash      10%  +4.8%      │       │   │
│  │ Key memories:│  │  │    └────────────────────────────┘       │   │
│  │              │  │  │                                         │   │
│  │ • Retire 2031│  │  │    Key memories from past sessions:     │   │
│  │ • Emily      │  │  │    • Concerned about REIT exposure      │   │
│  │   college    │  │  │    • Daughter Emily → college 2027      │   │
│  │   2027       │  │  │    • Prefers dividend income             │   │
│  │ • Prefers    │  │  │    • Emotionally conservative in dips   │   │
│  │   dividends  │  │  │                                         │   │
│  │ • REIT       │  │  │    Suggested talking points:             │   │
│  │   concern    │  │  │    1. REIT rebalancing follow-up         │   │
│  │   (open)     │  │  │    2. Education fund vehicle             │   │
│  │ • Nervous    │  │  │    3. Retirement target tracking         │   │
│  │   in dips    │  │  │                                         │   │
│  │              │  │  └─────────────────────────────────────────┘   │
│  │ ┌──────────┐│  │                                                  │
│  │ │View All  ││  │  ┌─────────────────────────────────────────┐   │
│  │ │Memories →││  │  │ Ask the advisor...                  ⏎  │   │
│  │ └──────────┘│  │  └─────────────────────────────────────────┘   │
│  └──────────────┘  │                                                  │
│                    │  REDIS UNDER THE HOOD                     [▼]   │
│  PAST MEETINGS     │  ┌─────────────────────────────────────────┐   │
│  ┌──────────────┐  │  │ Memory: long-term recall (12 facts)     │   │
│  │ Jan 15  📞   │  │  │ Summarization: 6 sessions condensed     │   │
│  │ Dec 02  📹   │  │  │ Cache: MISS │ Latency: 180ms           │   │
│  │ Oct 28  📹   │  │  └─────────────────────────────────────────┘   │
│  │ Sep 14  📞   │  │                                                  │
│  │ [View all →] │  │                                                  │
│  └──────────────┘  │                                                  │
│                    │                                                  │
├────────────────────┴─────────────────────────────────────────────────┤
│  [📞 Start Call]  [📹 Join Google Meet]  [📝 Manual Notes]          │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Screen 3 — Live Google Meet Call (Transcript + Suggestions)

_Sarah joins a Google Meet call with James. The transcript streams in real time on the left. The AI copilot listens and suggests in real time on the right._

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔴 LIVE CALL — James Morrison          00:14:32      [End Call]    │
├──────────┬──────────────────────────┬────────────────────────────────┤
│          │                          │                                │
│          │  LIVE TRANSCRIPT         │  AI INSIGHTS (live)            │
│          │                          │                                │
│ ┌──────┐ │  ┌────────────────────┐  │  SUGGESTIONS             │
│ │      │ │  │ 00:12:15           │  │  ┌────────────────────────┐   │
│        │ │  │ James: "...and     │  │  │ 💡 James just          │   │
│ │      │ │  │ Maya's been        │  │  │ mentioned Maya's early  │   │
│ │      │ │  │ talking about      │  │  │ retirement. This could  │   │
│ │      │ │  │ retiring early,    │  │  │ reduce household income │   │
│ └──────┘ │  │ maybe next year.   │  │  │ by ~40%. Consider:      │   │
│ ┌──────┐ │  │ That might change  │  │  │                         │   │
│ │      │ │  │ things for us      │  │  │ • Revisit withdrawal    │   │
│   │ │  │ financially."      │  │  │   rate assumptions      │   │
│ │      │ │  │                    │  │  │ • Model dual-retirement │   │
│ │      │ │  │ 00:12:42           │  │  │   scenario              │   │
│ └──────┘ │  │ Sarah: "That's a   │  │  │ • Review insurance      │   │
│          │  │ big change. Let me │  │  │   coverage               │   │
│          │  │ factor that in..." │  │  │                         │   │
│          │  │                    │  │  │ [Use this suggestion]   │   │
│          │  │ 00:13:05           │  │  └────────────────────────┘   │
│          │  │ James: "Also,      │  │                                │
│          │  │ what's the         │  │  DETECTED TOPICS               │
│          │  │ difference between │  │  ┌────────────────────────┐   │
│          │  │ a bond fund and    │  │  │ ✅ REIT rebalancing     │   │
│          │  │ buying bonds       │  │  │    (discussed 00:04)    │   │
│          │  │ directly?"         │  │  │ 🔄 Spouse retirement    │   │
│          │  │                    │  │  │    (new — 00:12)        │   │
│          │  │ 00:13:30           │  │  │ ❓ Bond fund vs bonds   │   │
│          │  │ Sarah: [reading    │  │  │    (question — 00:13)   │   │
│          │  │ from AI response]  │  │  │ ○ Education fund        │   │
│          │  │ "Great question.   │  │  │    (not yet discussed)  │   │
│          │  │ Here's how they    │  │  └────────────────────────┘   │
│          │  │ compare..."        │  │                                │
│          │  │                    │  │  QUICK ASK                     │
│          │  │        ▼           │  │  ┌────────────────────────┐   │
│          │  │  [auto-scrolling]  │  │  │ Ask AI privately...  ⏎│   │
│          │  └────────────────────┘  │  └────────────────────────┘   │
│          │                          │                                │
│          │  MEMORY ACTIVITY (live)  │  REDIS UNDER THE HOOD    [▼]  │
│          │  ┌────────────────────┐  │  ┌────────────────────────┐   │
│          │  │ 📝 Working memory  │  │  │ Transcript chunks: 47  │   │
│          │  │ +2 new entries     │  │  │ Working mem writes: 12  │   │
│          │  │                    │  │  │ Suggestions generated:3 │   │
│          │  │ 🧠 Long-term:     │  │  │ Cache: 1 HIT (bonds Q) │   │
│          │  │ "Maya retire 2027" │  │  │ Avg latency: 95ms      │   │
│          │  │  auto-extracted ⚡ │  │  └────────────────────────┘   │
│          │  └────────────────────┘  │                                │
├──────────┴──────────────────────────┴────────────────────────────────┤
│  © Acme Bank — Powered by Redis + Google Meet Media API             │
└──────────────────────────────────────────────────────────────────────┘
```

**Key interaction patterns during live call:**

- **Sarah never types during the call.** The AI reads the transcript passively and surfaces suggestions in the right panel. Sarah glances at them and uses what's relevant.
- **"Use this suggestion"** button copies the AI's recommendation into her talking points — she reads it to James naturally.
- **"Quick Ask"** box lets Sarah privately ask the AI without James seeing (e.g., "What's his current REIT allocation exactly?"). The answer appears only in the copilot panel.
- **Detected Topics** checklist automatically tracks which agenda items have been covered based on transcript analysis.

---

### Screen 4 — Post-Call Summary & Memory Extraction

_After the call ends, the AI auto-generates a meeting summary from the full transcript._

```
┌──────────────────────────────────────────────────────────────────────┐
│  CALL ENDED — James Morrison — Feb 26, 2026 — 22 min  [← Back]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  AI-GENERATED MEETING SUMMARY                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Key Decisions:                                                │  │
│  │  ✅ Rebalance $150K from REITs → $100K Short-Duration Bond    │  │
│  │     Fund + $50K Dividend Aristocrats ETF                      │  │
│  │  ✅ James comfortable with bond fund over individual bonds     │  │
│  │                                                                │  │
│  │  New Information Captured:                                     │  │
│  │  🆕 Maya Morrison considering early retirement (2027)          │  │
│  │  🆕 James wants dual-retirement income scenario modeled        │  │
│  │                                                                │  │
│  │  Open Items / Follow-ups:                                      │  │
│  │  ○ Execute REIT → Bond/ETF rebalance (pending ops)             │  │
│  │  ○ Model dual-retirement scenario and send to James            │  │
│  │  ○ Education fund — discussed briefly, needs dedicated session │  │
│  │                                                                │  │
│  │  Sentiment: Positive. James felt heard, appreciated the        │  │
│  │  proactive suggestions. Slight anxiety about Maya's            │  │
│  │  retirement impact but reassured by scenario modeling offer.   │  │
│  │                                                                │  │
│  │  [✏️ Edit Summary]                     [✅ Approve & Save]    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  MEMORY CHANGES (auto-extracted from transcript)                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Working Memory → Long-term Extractions:                       │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ FACT: "Maya Morrison may retire early 2027"       [keep] │  │  │
│  │  │ source: transcript 00:12:15                              │  │  │
│  │  ├──────────────────────────────────────────────────────────┤  │  │
│  │  │ FACT: "James prefers bond funds over laddering"   [keep] │  │  │
│  │  │ source: transcript 00:15:42                              │  │  │
│  │  ├──────────────────────────────────────────────────────────┤  │  │
│  │  │ DECISION: "Rebalance $150K REIT → bonds/ETF"     [keep] │  │  │
│  │  │ source: transcript 00:18:30                              │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  Memory Maintenance:                                           │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ UPDATED: "REIT concern (Jan 15)" → status: RESOLVED     │  │  │
│  │  │ UPDATED: Session count 6 → 7, summary re-condensed      │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  [✅ Approve All]  [✏️ Edit Extractions]                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  FULL TRANSCRIPT                                            [▼ Expand]│
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 00:00:05  Sarah: "Hi James, good to talk again..."            │  │
│  │ 00:00:12  James: "Hey Sarah, thanks for making time..."       │  │
│  │ 00:01:30  Sarah: "So let's start with the REIT situation..."  │  │
│  │ ...                                                (22 min)   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  REDIS UNDER THE HOOD                                          [▼]  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Transcript chunks processed: 127                               │  │
│  │ Working memory entries created: 18                             │  │
│  │ Long-term facts extracted: 3 new, 1 updated                   │  │
│  │ Summarization: 7-session summary regenerated (320 tokens)     │  │
│  │ Total memory operations: 22  │  Avg latency: 38ms each       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  [📧 Email Summary to James]  [📋 Send to CRM]  [📅 Schedule Next] │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Screen 5 — Past Conversations & Transcript History

_Sarah browses all past meetings with James — both transcripts and chat sessions._

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← James Morrison    CONVERSATION HISTORY                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔍 Search past conversations...          [Filter ▾] [Date range ▾] │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  📹 Feb 26, 2026 — Google Meet (22 min)           [▶ Expand]  │  │
│  │  Topics: REIT rebalancing, spouse retirement, bond funds       │  │
│  │  Decisions: Rebalance $150K, model dual-retirement scenario    │  │
│  │  Memories extracted: 3 new facts, 1 updated                   │  │
│  │  Sentiment: Positive                                           │  │
│  │                                                                │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │  📞 Jan 15, 2026 — Phone + Chat (18 min)          [▶ Expand]  │  │
│  │  Topics: REIT concerns, market outlook                         │  │
│  │  Decisions: Sarah to research REIT alternatives                │  │
│  │  Memories extracted: 2 facts (REIT concern, dividend pref)    │  │
│  │  Sentiment: Anxious                                            │  │
│  │                                                                │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │  📹 Dec 02, 2025 — Google Meet (35 min)           [▶ Expand]  │  │
│  │  Topics: Year-end review, tax loss harvesting, Emily college   │  │
│  │  Decisions: Harvest $40K in losses, start education fund       │  │
│  │  Memories extracted: 4 facts                                   │  │
│  │  Sentiment: Neutral-positive                                   │  │
│  │                                                                │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │  📞 Oct 28, 2025 — Phone (8 min)                  [▶ Expand]  │  │
│  │  Topics: Market correction panic, reassurance                  │  │
│  │  Decisions: No changes, stay the course                        │  │
│  │  Memories extracted: 1 fact (nervous in dips)                 │  │
│  │  Sentiment: Anxious                                            │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  EXPANDED VIEW (example — Feb 26 meeting)                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  SUMMARY                        │  TRANSCRIPT (scrollable)    │  │
│  │  ┌────────────────────────────┐ │  ┌────────────────────────┐ │  │
│  │  │ James agreed to rebalance  │ │  │ 00:00:05 Sarah: Hi...  │ │  │
│  │  │ $150K from REITs into      │ │  │ 00:00:12 James: Hey... │ │  │
│  │  │ bonds and ETFs. Maya may   │ │  │ 00:01:30 Sarah: So...  │ │  │
│  │  │ retire early 2027 — need   │ │  │ ...                    │ │  │
│  │  │ to model impact on income. │ │  │ 00:12:15 James: "Maya  │ │  │
│  │  │                            │ │  │  has been talking about │ │  │
│  │  │ Extracted memories:        │ │  │  retiring early..."     │ │  │
│  │  │ • Maya retire 2027         │ │  │ ...                    │ │  │
│  │  │ • Prefers bond funds       │ │  │ 00:21:45 Sarah: Great  │ │  │
│  │  │ • REIT concern resolved    │ │  │  talking with you...   │ │  │
│  │  └────────────────────────────┘ │  └────────────────────────┘ │  │
│  │                                                                │  │
│  │  [📧 Email]  [📋 CRM]  [🤖 Ask AI about this meeting]        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  © Acme Bank — Powered by Redis                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Screen 6 — Memory Explorer

_A dedicated view into everything the AI "knows" about a client — the memory store visualized._

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← James Morrison    MEMORY EXPLORER                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  MEMORY SUMMARY (auto-generated)                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ James Morrison, 52, is a moderate-risk HNW client targeting    │  │
│  │ $3M by retirement in 2031. He favors dividend income and is    │  │
│  │ emotionally conservative during downturns. Daughter Emily      │  │
│  │ starts college 2027 (~$200K needed). Wife Maya may retire      │  │
│  │ early 2027, requiring income planning revision. Recently       │  │
│  │ rebalanced $150K from REITs into bonds/ETFs.                   │  │
│  │                                              Condensed from 7  │  │
│  │                                              sessions (142 min)│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  LONG-TERM FACTS                          [+ Add Manual Fact]        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  GOALS & MILESTONES                                            │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ 🎯 Retirement target: $3M liquid by 2031                 │  │  │
│  │  │    source: session 1 (Sep 14, 2025)  │  confidence: high │  │  │
│  │  │ 🎓 Emily college 2027, needs ~$200K                      │  │  │
│  │  │    source: session 3 (Dec 02, 2025)  │  confidence: high │  │  │
│  │  │ 🆕 Maya may retire early 2027                             │  │  │
│  │  │    source: transcript (Feb 26, 2026) │  confidence: med  │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  PREFERENCES                                                   │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ 💰 Favors dividend-paying stocks over growth              │  │  │
│  │  │    source: session 2 (Oct 28, 2025)  │  confidence: high │  │  │
│  │  │ 📊 Prefers bond funds over individual bond laddering      │  │  │
│  │  │    source: transcript (Feb 26, 2026) │  confidence: high │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  BEHAVIORAL PATTERNS                                           │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ ⚠️ Gets anxious during market corrections                 │  │  │
│  │  │    source: session 2 (Oct 28, 2025)  │  confidence: high │  │  │
│  │  │    evidence: called twice in one week during Oct dip      │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  RESOLVED / ARCHIVED                                           │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ ✅ REIT exposure concern — RESOLVED (Feb 26, rebalanced) │  │  │
│  │  │ ✅ Tax loss harvesting 2025 — RESOLVED (Dec 02, executed)│  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  MEMORY TIMELINE                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Sep 14 ──── Oct 28 ──── Dec 02 ──── Jan 15 ──── Feb 26      │  │
│  │    │           │           │           │           │           │  │
│  │    ●           ●           ●●          ●           ●●●        │  │
│  │  retire      nervous    college     REIT         Maya retire  │  │
│  │  goal set    in dips    fund +      concern      bond pref    │  │
│  │              dividend   tax loss                  REIT resolved│  │
│  │              pref                                              │  │
│  │                                                                │  │
│  │  ● = memory created   ● = memory updated   ● = memory resolved│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Redis: 12 facts │ 2 resolved │ 7 sessions summarized │ 38ms load  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Sample Flow — Act by Act

### ACT 1: Morning Prep (Memory Recall + Summarization)

**Screen:** Client Profile & Chat (Screen 2)

Sarah opens the app and selects James Morrison from her client list. The Memory Insights panel auto-populates.

---

**Sarah:** _"Give me a quick briefing on James before our 10am call."_

**Advisor AI:**

> Here's your briefing for **James Morrison**:
>
> **Portfolio snapshot** (as of today):
> | Asset Class | Allocation | YTD Return |
> |-------------|-----------|------------|
> | US Equities | 45% ($1.08M) | +8.2% |
> | Fixed Income | 30% ($720K) | +3.1% |
> | Real Estate (REITs) | 15% ($360K) | -2.4% |
> | Cash & Equivalents | 10% ($240K) | +4.8% |
>
> **Key things I remember from past conversations:**
>
> - 🎯 **Retirement target: 2031** — wants $3M liquid at retirement
> - 📉 **Last meeting (Jan 15):** Expressed concern about real estate exposure after reading about commercial property defaults. Asked you to look into reducing REIT allocation.
> - 🎓 **Daughter Emily starts college in 2027** — needs ~$200K earmarked for education
> - 💰 **Income preference:** Favors dividend-paying stocks over growth. Mentioned wanting "money that works while I sleep."
> - ⚠️ **Risk note:** Got nervous during the Oct 2025 correction, called twice in one week. Moderate risk tolerance, but emotionally trends conservative.
>
> **Suggested talking points for today:**
>
> 1. Follow up on the REIT rebalancing he asked about
> 2. Education fund — only 2 years out, should we lock in a vehicle?
> 3. His portfolio is on track for the $3M target if current returns hold

**🔧 Redis Under the Hood:**

```
Memory type:  Long-term (auto-extracted from 6 past sessions)
Summarization: Active — condensed 14 conversation turns into 5 key facts
Cache:         MISS (first query of the day for this client)
Latency:       180ms
```

---

### ACT 2: Live Call with Transcript (Google Meet + Working Memory)

**Screen:** Live Google Meet Call (Screen 3)

Sarah clicks **"Join Google Meet"** from James's profile. The Google Meet Media API begins streaming the live transcript. Every few seconds, a new transcript chunk arrives and is written to Redis working memory.

---

**[00:01:30] — Transcript is streaming. The AI is silently processing.**

The left panel shows the rolling transcript. The right panel is quiet — no suggestions yet, just listening.

**[00:04:15] — James brings up REITs.**

> **James (transcript):** _"So Sarah, did you look into those REIT alternatives we talked about? I'm still feeling uneasy about that exposure."_

The **Detected Topics** panel lights up:

```
✅ REIT rebalancing (detected at 00:04)
```

The AI copilot surfaces a suggestion:

> **💡 AI Suggestion:**
> James is asking about the REIT rebalancing from your Jan 15 meeting. Based on his profile, here are your pre-researched options:
>
> | Product                  | Yield | Risk    |
> | ------------------------ | ----- | ------- |
> | Short-Duration Bond Fund | 4.8%  | Low     |
> | Dividend Aristocrats ETF | 3.6%  | Mod-Low |
>
> Recommended split: $100K bonds + $50K ETF.
>
> **[Use this suggestion]**

Sarah glances at the suggestion and naturally works it into the conversation without breaking flow.

**[00:12:15] — The big moment. James mentions his wife.**

> **James (transcript):** _"...and Maya's been talking about retiring early, maybe next year. That might change things for us financially."_

The AI **instantly** detects a new life event from the transcript:

> **💡 AI Suggestion (high priority):**
> 🆕 **New life event detected:** Maya Morrison may retire in 2027. This could reduce household income by ~40%. Consider:
>
> - Revisit withdrawal rate assumptions
> - Model a dual-retirement scenario
> - Review insurance and healthcare coverage
>
> **[Use this suggestion]**

Simultaneously, in the **Memory Activity** panel at the bottom-left:

```
📝 Working memory: +1 new entry
   "Maya Morrison considering early retirement 2027"
🧠 Long-term extraction triggered — flagged as durable fact
```

**[00:13:05] — James asks a general question.**

> **James (transcript):** _"Also, what's the difference between a bond fund and buying bonds directly?"_

The AI copilot instantly responds (in Sarah's private panel):

> **💡 Answer ready:**
>
> |                 | Bond Fund    | Individual Bonds      |
> | --------------- | ------------ | --------------------- |
> | Diversification | Built-in     | DIY                   |
> | Liquidity       | Sell anytime | May face spread       |
> | Maturity        | Perpetual    | Fixed date            |
> | Best for        | Simplicity   | Predictable cash flow |
>
> For James: Bond fund is better given his preference for simplicity.
>
> **[Use this suggestion]**

**🔧 Redis Under the Hood:**

```
Cache:         ✅ HIT — bond fund question matched 847 prior queries
Latency:       8ms (vs ~200ms uncached)
Source:        LangCache semantic match
```

Sarah reads the comparison to James naturally, as if from her own expertise.

**[00:18:30] — James agrees to the rebalancing.**

> **James (transcript):** _"Let's do it. Move the $150K out of REITs — the bond fund and that dividend ETF sound good."_

```
Detected Topics:
✅ REIT rebalancing (discussed 00:04, DECIDED 00:18)
✅ Spouse retirement (new — 00:12)
✅ Bond fund vs bonds (answered — 00:13)
○ Education fund (not yet discussed)
```

The AI nudges Sarah:

> **💡 Reminder:** You haven't discussed Emily's education fund yet. James is in a good mood — this might be a good time to bring it up.

---

### ACT 3: Product Deep Dive During Call (Hybrid Search + RAG)

**Screen:** Still on Live Call (Screen 3) — Sarah uses the Quick Ask box

While James is talking about something else, Sarah privately types into the Quick Ask box:

---

**Sarah (private):** _"If Maya retires and they lose her income, what withdrawal rate is safe for James to hit $3M by 2031?"_

**Advisor AI (private panel):**

> Running a scenario with these assumptions:
>
> - Current AUM: $2.4M
> - Maya's income removed: ~$180K/year
> - James's income continues: ~$280K/year
> - Target: $3M by 2031 (5 years)
>
> **Result:** At a 4% withdrawal rate, they'd reach $2.85M (misses target by $150K). At 3% withdrawal with the proposed rebalance, they'd hit $3.05M.
>
> **Recommendation:** If Maya retires, reduce discretionary withdrawals by ~$15K/year to stay on track. Or delay James's retirement by 6 months for a comfortable buffer.

James doesn't see any of this. Sarah uses it to inform her next comment:

> **Sarah (to James):** _"You know, with Maya potentially retiring, we should run a few scenarios. I can model this out and send you the numbers this week."_

---

### ACT 4: Post-Call (Auto-Summary + Memory Extraction)

**Screen:** Post-Call Summary (Screen 4)

The call ends. The AI processes the full transcript (127 chunks from working memory) and generates the post-call summary screen.

Sarah reviews:

- **AI-generated summary** — key decisions, new info, follow-ups
- **Memory extractions** — 3 new long-term facts auto-extracted from transcript, each with source timestamp
- **Memory maintenance** — REIT concern marked as resolved

Sarah clicks **"Approve All"** to confirm the memory extractions. She edits one follow-up item, then clicks **"Send to CRM"**.

**🔧 Redis Under the Hood:**

```
Transcript chunks processed: 127
Working memory entries created: 18 during call
Long-term facts extracted: 3 new, 1 updated
Summarization: 7-session summary regenerated (320 tokens)
Memory maintenance: 1 item resolved
Total memory operations: 22  │  Avg latency: 38ms each
```

**Demo talking point:** _"Everything you just saw — the suggestions, the memory extraction, the summary — happened automatically from the Google Meet transcript flowing through Redis. The RM didn't take a single note. Redis working memory captured the conversation in real time, and after the call, it auto-extracted the important facts into long-term memory. 127 transcript chunks, 22 memory operations, average 38 milliseconds each."_

---

### ACT 5: Next Day — Memory Continuity (New Session)

**Screen:** Client Profile & Chat (Screen 2)

The next morning, Sarah opens James's profile. The Memory Insights panel now shows the updated state.

---

**Sarah:** _"Anything I should know about James Morrison today?"_

**Advisor AI:**

> **Since your last session (yesterday's Google Meet call):**
>
> - The REIT → Bond/ETF rebalance is pending execution (submitted yesterday 10:47am)
> - No market alerts affecting his portfolio overnight
>
> **Upcoming considerations:**
>
> - 🆕 **Maya Morrison may retire early 2027** — you captured this from yesterday's call. If her income drops, James's withdrawal rate assumptions may need revisiting. Want me to run a scenario?
> - 🎓 Emily's college fund ($200K target) — now 22 months out, currently unfunded as a separate vehicle
> - 📊 You promised James a dual-retirement scenario model this week — want me to draft it?
>
> **Memory confidence:** High — 7 sessions summarized, 12 long-term facts tracked, last updated yesterday.

**🔧 Redis Under the Hood:**

```
Memory type:   Long-term recall (cross-session)
Facts loaded:  12 durable facts from memory store (includes yesterday's transcript extractions)
Summarization: 7-session summary retrieved in 6ms
Cache:         MISS (personalized query, not cacheable)
Latency:       95ms
```

---

### ACT 6: Browsing History & Memory (Exploration)

**Screen:** Past Conversations (Screen 5) → Memory Explorer (Screen 6)

Sarah clicks into the **Conversation History** tab to review past meetings. She sees all sessions — both Google Meet transcripts and chat-only sessions — listed chronologically with AI-generated topic tags, decision summaries, and sentiment indicators.

She expands yesterday's Google Meet session and sees the full transcript side-by-side with the AI summary.

Then she clicks **"Memory Explorer"** to see all 12 long-term facts, organized by category (goals, preferences, behavioral patterns, resolved items) with a timeline visualization showing when each memory was created or updated.

**Demo talking point:** _"This is the Memory Explorer. Every fact here was auto-extracted from real conversations — live transcripts and chat sessions. The RM never manually entered any of this. And notice the timeline at the bottom: you can see the memory evolving over 7 sessions. Redis Agent Memory Server manages the full lifecycle — creation, extraction, summarization, maintenance, and retrieval — so the AI gets smarter with every interaction."_

---

## What Makes This Demo Land

| Moment               | What the audience sees                          | What Redis is doing                              |
| -------------------- | ----------------------------------------------- | ------------------------------------------------ |
| Morning briefing     | AI "knows" the client deeply                    | Long-term memory recall + summarization          |
| Live call transcript | Words appear in real time, AI silently listens  | Working memory writes from Google Meet Media API |
| Real-time suggestion | AI surfaces "Maya retirement" insight mid-call  | Working memory analysis + long-term extraction   |
| Bond fund question   | Instant 8ms answer during live call             | Semantic cache HIT via LangCache                 |
| Private RM question  | Sarah gets data without client seeing           | Hybrid search + RAG, private channel             |
| Post-call summary    | Full meeting summary with zero manual notes     | Transcript → summarization + memory extraction   |
| Memory approval      | RM reviews & approves extracted facts           | Long-term memory write + maintenance             |
| Next-day recall      | Yesterday's call insights surface automatically | Cross-session memory persistence                 |
| Memory explorer      | Visual timeline of everything AI knows          | Full memory lifecycle visualization              |

## Demo Duration

- **Keynote version (10 min):** Acts 1, 2 (highlight moments), 4 — memory recall, live transcript magic, post-call extraction
- **Workshop version (30 min):** All 6 acts — walk through each Redis capability with the "Under the Hood" panel visible
- **Hands-on lab (60 min):** Attendees build their own version, starting with memory setup, adding Google Meet transcript ingestion, then search + caching + memory lifecycle

## Sample Data Needed

- **Client profiles:** 5-10 fictional HNW clients with varied risk profiles, goals, and life events
- **Product catalog:** 50-100 financial products (funds, ETFs, bonds) with structured metadata (yield, risk, asset class, min investment) and text descriptions for vector embedding
- **Pre-recorded transcripts:** 3-5 past Google Meet transcripts per client (can be synthetic) with speaker labels and timestamps, to demonstrate memory recall from prior calls
- **Conversation history:** 3-5 pre-seeded past sessions per client to demonstrate memory recall and summarization
- **Knowledge base:** 20-30 documents (market commentary, product sheets, regulatory summaries) for RAG retrieval
- **Google Meet integration:** A working Media API connection (or a simulated transcript stream for demo reliability)

## Redis features

- working memory + summarization (Redis AgentMemoryServer)
- long term memory + summary views (RedisAgentMemoryServer)
- semantic caching (LangCache)
- RAG (vector database) + Hybrid search
- Memory maintenance (Lifecycle management)

## Target

(load through dataset provider config)

- Bank wealth advisor
- SDR advisor
  - seed same customer conversations
  - seed redis flockjay docs (RAG + hybrid search)
  - seed customer profiles and history
- Healthcare in person visit
  - doctor uses against patient
- Healthcare Insurance provider
- Personal meeting assistant

# Meeting Memory Demo -- Frontend Chatbot Plan (V2)

## Goal

Add a **chatbot UI** to the Meeting Memory demo frontend, powered by CopilotKit. The chatbot lets the user ask natural-language questions about all stored memories. The backend (LangGraph agent with memory tools) is defined in [dev-backend-chatbot-plan.md](./dev-backend-chatbot-plan.md).

This plan covers **frontend-only changes** to the existing Next.js app defined in [dev-frontend-plan.md](./dev-frontend-plan.md).

---

## UI Placement: Three Options

The existing layout is a 55/45 split (TranscriptPanel left, MemoryExplorerPanel right) on a dark `--midnight` background. The chatbot needs a home. Three options:

### Option A: CopilotSidebar (Right Edge Overlay) -- Recommended

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  DemoPage                                                                         │
│                                                                                   │
│  ┌────────────────────────────┐  ┌──────────────────────────┐  ┌──────────────┐  │
│  │  TranscriptPanel           │  │  MemoryExplorerPanel      │  │  CopilotKit  │  │
│  │  55%                       │  │  45%                      │  │  Sidebar     │  │
│  │                            │  │                           │  │  ~350px      │  │
│  │  (unchanged)               │  │  (unchanged)              │  │  (overlay)   │  │
│  │                            │  │                           │  │              │  │
│  │                            │  │  Working Memory           │  │  [Chat UI]   │  │
│  │  [Toolbar]                 │  │  Long-Term Memory         │  │  Ask about   │  │
│  │  [Transcript Feed]         │  │  Summary Views            │  │  memories... │  │
│  │  [Playback Controls]       │  │  Redis Metrics            │  │              │  │
│  │                            │  │                           │  │  [Messages]  │  │
│  │                            │  │                           │  │  [Input]     │  │
│  └────────────────────────────┘  └──────────────────────────┘  └──────────────┘  │
│                                                                                   │
│  [Toggle Chat Button -- bottom-right FAB when sidebar is closed]                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**How it works:** CopilotKit's `CopilotSidebar` component wraps the page content. It renders a slide-in panel from the right edge (~350px wide). When open, it overlays the right portion of MemoryExplorerPanel. When closed, the existing 55/45 layout is completely untouched.

**Pros:**

- Zero layout changes to the existing two panels
- Standard CopilotKit pattern -- well-tested, built-in open/close toggle
- Dedicated chat space with full message history and input
- Can be toggled by the presenter during the demo ("Now let me ask the AI...")
- The overlay means the existing panels don't get compressed

**Cons:**

- When open, partially covers MemoryExplorerPanel (acceptable -- user can close it to see full explorer)
- Requires CSS overrides to match the Redis dark theme

### Option B: Chat Tab in MemoryExplorerPanel

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────┐  ┌────────────────────────────────────────────┐│
│  │  TranscriptPanel (55%)   │  │  MemoryExplorerPanel (45%)                 ││
│  │                          │  │                                            ││
│  │                          │  │  [Working Memory] [LT Memory] [Summary]   ││
│  │                          │  │  [Redis Metrics] [Chat]  <-- NEW TAB      ││
│  │                          │  │                                            ││
│  │                          │  │  (tab content: chat messages + input)      ││
│  └──────────────────────────┘  └────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Pros:** Integrates seamlessly into existing layout. No overlays. No layout changes.

**Cons:** Competes with other tabs for attention. Chat history is lost when switching tabs (unless we keep state). Smaller chat area. Doesn't feel like a dedicated "conversation" -- more like a search box. CopilotKit's built-in `CopilotSidebar`/`CopilotChat` components can't be easily embedded as a tab -- we'd need `CopilotChat` (headless) with custom rendering.

### Option C: Three-Panel Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐ │
│  │  TranscriptPanel  │  │  MemoryExplorerPanel  │  │  ChatPanel             │ │
│  │  40%              │  │  35%                  │  │  25%                   │ │
│  │                   │  │                       │  │                        │ │
│  └──────────────────┘  └──────────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Pros:** All three views visible simultaneously. No overlays.

**Cons:** Compresses existing panels significantly. Requires layout restructuring. May look crowded. Existing panels were designed for 55% and 45% -- squeezing them hurts readability.

### Decision: **Option A (CopilotSidebar)**

Best for a demo: the chatbot is a "reveal" moment. The presenter shows the transcript playback and memory exploration first, then opens the sidebar with "Now let me ask the AI about these memories..." The overlay is a feature, not a bug -- it focuses attention on the chat conversation.

## ok go with Option A

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Next.js App (App Router)                                                     │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  layout.tsx                                                            │   │
│  │  ┌─ CopilotKit Provider (runtimeUrl) ─────────────────────────────┐   │   │
│  │  │                                                                 │   │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐   │   │   │
│  │  │  │  DemoPage (page.tsx)                                     │   │   │   │
│  │  │  │                                                          │   │   │   │
│  │  │  │  useCopilotReadable (sessionId, userId, namespace)       │   │   │   │
│  │  │  │                                                          │   │   │   │
│  │  │  │  ┌─ CopilotSidebar ──────────────────────────────────┐  │   │   │   │
│  │  │  │  │                                                    │  │   │   │   │
│  │  │  │  │  ┌──────────────────┐  ┌────────────────────────┐ │  │   │   │   │
│  │  │  │  │  │ TranscriptPanel  │  │ MemoryExplorerPanel     │ │  │   │   │   │
│  │  │  │  │  │ (unchanged)      │  │ (unchanged)             │ │  │   │   │   │
│  │  │  │  │  └──────────────────┘  └────────────────────────┘ │  │   │   │   │
│  │  │  │  │                                                    │  │   │   │   │
│  │  │  │  └────────────────────────────────────────────────────┘  │   │   │   │
│  │  │  └──────────────────────────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  CopilotKit talks to: POST /copilotkit (backend, port 3001)                  │
│  Existing API calls:  POST /api/* (backend, port 3001, unchanged)            │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key points:**

- `CopilotKit` provider wraps the entire app in `layout.tsx` -- it provides the runtime connection to the backend's `/copilotkit` endpoint
- `CopilotSidebar` wraps the existing `<main>` content in `page.tsx` -- it renders the sidebar panel alongside the existing two-panel layout
- `useCopilotReadable` is called in `DemoPage` to pass `sessionId`, `userId`, and `namespace` as context to the backend agent (the agent uses these for session routing)
- TranscriptPanel and MemoryExplorerPanel are **completely unchanged** -- zero modifications to existing business components
- The sidebar's labels and instructions come from `dataset.config.json` (config-driven, like everything else)

---

## Project Structure (Changes Only)

```
examples/meeting-memory/frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                            # MODIFIED: wrap with CopilotKit provider
│   │   ├── page.tsx                              # MODIFIED: wrap content with CopilotSidebar,
│   │   │                                         #   add useCopilotReadable, add chatbot config
│   │   ├── page.css                              # MODIFIED: minor adjustments for sidebar
│   │   └── globals.css                           # MODIFIED: add CopilotKit theme overrides
│   │
│   ├── components/
│   │   ├── core/                                 # UNCHANGED
│   │   └── business/
│   │       ├── transcript-panel/                 # UNCHANGED
│   │       └── memory-explorer-panel/            # UNCHANGED
│   │
│   ├── hooks/
│   │   └── use-dataset-config.ts                 # UNCHANGED
│   │
│   ├── constants/
│   │   └── app.constants.ts                      # MODIFIED: add COPILOTKIT_RUNTIME_URL, chatbot constants
│   │
│   ├── styles/
│   │   ├── variables.css                         # UNCHANGED
│   │   └── copilotkit-theme.css                  # NEW: CopilotKit CSS overrides for Redis dark theme
│   │
│   ├── services/
│   │   └── api.service.ts                        # UNCHANGED
│   │
│   └── types/
│       ├── dataset-config.types.ts               # MODIFIED: add chatbot config fields
│       └── ...                                   # UNCHANGED
│
├── package.json                                  # MODIFIED: add CopilotKit deps
└── ...
```

**What's NOT changed:** Both business components (`transcript-panel/`, `memory-explorer-panel/`), all core components, all hooks, all services, all existing types. The chatbot is purely additive.

---

## Prerequisites (Additional)

| Dependency               | Version | Purpose                                     |
| ------------------------ | ------- | ------------------------------------------- |
| `@copilotkit/react-core` | latest  | CopilotKit React provider + hooks           |
| `@copilotkit/react-ui`   | latest  | CopilotSidebar, built-in chat UI components |

---

## Package Dependencies Changes (`package.json`)

```json
{
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@mui/material": "^6.6.0",
    "@mui/icons-material": "^6.6.0",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@copilotkit/react-core": "latest",
    "@copilotkit/react-ui": "latest"
  }
}
```

---

## Constants Changes (`app.constants.ts`)

```typescript
// NEW
const COPILOTKIT_RUNTIME_URL =
  process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL ??
  "http://localhost:3001/copilotkit";
```

---

## Dataset Config Changes (`dataset.config.json`)

Add a `chatbot` section to the dataset config. All chatbot labels and instructions come from here (config-driven, like everything else in the demo).

```json
{
  "chatbot": {
    "title": "Memory Assistant",
    "initialMessage": "Ask me anything about the stored memories for this client. I can search across all meetings or focus on a specific session.",
    "placeholder": "Ask about memories...",
    "instructions": "You are a Memory Assistant that helps explore memories stored in Redis Agent Memory Server for this wealth advisor demo."
  }
}
```

These values are read from `datasetConfig.chatbot` and passed to `CopilotSidebar` as labels and instructions.

**Type change** in `dataset-config.types.ts`:

```typescript
type ChatbotConfig = {
  title: string;
  initialMessage: string;
  placeholder: string;
  instructions: string;
};

type DatasetConfig = {
  // ... existing fields unchanged ...
  chatbot: ChatbotConfig;
};
```

---

## Implementation Details

### 1. CopilotKit Provider (`layout.tsx`)

The `CopilotKit` provider wraps the entire app. It connects to the backend's `/copilotkit` endpoint.

```typescript
"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { Space_Grotesk, Space_Mono } from "next/font/google";

import { COPILOTKIT_RUNTIME_URL } from "../constants/app.constants";

// ... existing font setup ...

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable}`}>
    <body>
      <CopilotKit runtimeUrl={COPILOTKIT_RUNTIME_URL} showDevConsole={false}>
        {children}
      </CopilotKit>
    </body>
  </html>
);

export default RootLayout;
```

**Note on `"use client"`:** The layout already needs to be a client component because of `CopilotKit`. This is consistent with the existing app design (all components are client components, no SSR).

### 2. CopilotSidebar + Context Passing (`page.tsx`)

The DemoPage wraps its content with `CopilotSidebar` and uses `useCopilotReadable` to pass context to the backend agent.

```typescript
"use client";

import type { ComponentProps } from "react";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotReadable } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

import "./page.css";
import "../styles/copilotkit-theme.css";
import { useDatasetConfig } from "../hooks/use-dataset-config";
import { TranscriptPanel } from "../components/business/transcript-panel";
import { MemoryExplorerPanel } from "../components/business/memory-explorer-panel";

const DemoPage = () => {
  const { config, isLoading, error } = useDatasetConfig();
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Pass context to the backend chatbot agent via CopilotKit
  useCopilotReadable({
    description: "Active session ID for the current meeting playback",
    value: sessionId ?? "none",
  });

  useCopilotReadable({
    description: "User ID for memory scoping",
    value: config?.userId ?? "",
  });

  useCopilotReadable({
    description: "Namespace for memory scoping",
    value: config?.namespace ?? "",
  });

  // ... existing loading/error handling ...

  const sidebarProps: ComponentProps<typeof CopilotSidebar> = {
    defaultOpen: false,
    instructions: config?.chatbot?.instructions ?? "",
    labels: {
      title: config?.chatbot?.title ?? "Memory Assistant",
      initial: config?.chatbot?.initialMessage ?? "Ask about memories...",
      placeholder: config?.chatbot?.placeholder ?? "Ask about memories...",
    },
  };

  return (
    <CopilotSidebar {...sidebarProps}>
      <main className="demo-page">
        <TranscriptPanel
          datasetConfig={config!}
          onSessionCreated={setSessionId}
          onReset={handleReset}
        />
        <MemoryExplorerPanel
          userId={config!.userId}
          namespace={config!.namespace}
          sessionId={sessionId}
          datasetConfig={config!}
        />
      </main>
    </CopilotSidebar>
  );
};

export default DemoPage;
```

**Key details:**

- `CopilotSidebar` wraps the `<main>` element. The sidebar renders as an overlay on the right.
- `defaultOpen: false` -- the sidebar starts closed. The presenter opens it when ready to demo the chatbot.
- Three `useCopilotReadable` calls pass `sessionId`, `userId`, and `namespace` to the backend agent. The agent uses `sessionId` for session routing (see "Session vs All-Data Routing" in the backend plan).
- The `labels` object controls the sidebar's title, initial message, and placeholder text -- all from `dataset.config.json`.
- `instructions` is the system-level instruction sent to CopilotKit (the backend agent's system prompt also includes routing rules, so this is supplementary).

### 3. `useCopilotReadable` -- Session Context Passing

This is how the frontend tells the backend agent about the currently active session. The agent uses this to decide whether to search the current session or all data.

```typescript
// When no session is active:
useCopilotReadable({
  description: "Active session ID for the current meeting playback",
  value: "none",
});

// When a session is playing or completed:
useCopilotReadable({
  description: "Active session ID for the current meeting playback",
  value: "playback-2026-02-26-google-meet-1773247345966",
});
```

CopilotKit delivers these readables to the LangGraph graph via `state.copilotkit.context` (NOT as system messages in `state.messages`). The backend's `buildReadableMessages` helper in `graph.ts` extracts them and converts them to `SystemMessage` instances, so the LLM sees:

```
SystemMessage ("Active session ID for the current meeting playback: playback-2026-02-26-google-meet-...")
SystemMessage ("User ID for memory scoping: sarah-chen")
SystemMessage ("Namespace for memory scoping: wealth-advisor")
HumanMessage  ("What happened in this meeting?")
```

The backend system prompt tells the LLM to read the active session ID from these injected messages and use it for session-scoped tool calls. No `getActiveContext` tool or backend-side message parsing is needed -- the LLM reads the values directly from its conversation context.

The value updates reactively -- when `sessionId` changes (play starts, session loaded, reset), the agent's context updates automatically on the next message.

### 4. CopilotKit Theme Overrides (`styles/copilotkit-theme.css`)

CopilotKit ships with a default light theme. We override it to match the Redis dark theme using CSS custom properties. CopilotKit's components read from `--copilot-kit-*` CSS variables.

```css
:root {
  /* CopilotKit theme overrides for Redis dark theme */
  --copilot-kit-background-color: var(--dusk-09);
  --copilot-kit-secondary-color: var(--dusk);
  --copilot-kit-separator-color: var(--border);
  --copilot-kit-primary-color: var(--hyper-07);
  --copilot-kit-contrast-color: var(--base-white);
  --copilot-kit-secondary-contrast-color: var(--fg-body);
  --copilot-kit-response-button-background-color: var(--dusk-90);
  --copilot-kit-response-button-color: var(--fg-default);
  --copilot-kit-muted-color: var(--fg-muted);
}

.copilotKitSidebar {
  font-family: var(--primary-font);

  & .copilotKitHeader {
    background: var(--dusk-09);
    border-bottom: 1px solid var(--border);
    color: var(--fg-default);
    font-weight: var(--font-weight-medium);
  }

  & .copilotKitMessages {
    background: var(--bg-default);
  }

  & .copilotKitMessage {
    font-size: var(--font-size-rg);
    line-height: 1.6;
  }

  & .copilotKitUserMessage {
    background: var(--dusk-90);
    color: var(--fg-default);
    border-radius: var(--border-radius);
  }

  & .copilotKitAssistantMessage {
    background: var(--dusk);
    color: var(--fg-body);
    border-radius: var(--border-radius);
  }

  & .copilotKitInput {
    background: var(--dusk-09);
    border-top: 1px solid var(--border);

    & textarea {
      background: var(--dusk);
      color: var(--fg-default);
      border: 1px solid var(--border);
      border-radius: var(--border-radius);
      font-family: var(--primary-font);
      font-size: var(--font-size-rg);

      &::placeholder {
        color: var(--fg-muted);
      }
    }
  }

  & .copilotKitButton {
    background: var(--btn-primary-bg);
    border: 1px solid var(--btn-primary-border);
    color: var(--btn-primary-text);

    &:hover {
      background: var(--btn-primary-hover-bg);
    }
  }
}
```

**Note:** CopilotKit's exact class names may vary by version. The pattern above uses the documented CSS custom properties (`--copilot-kit-*`) as the primary theming mechanism, with class-based overrides as fallback. Check the installed version's CSS at implementation time and adjust selectors as needed. The key goal: dark background (`--dusk-09`), light text (`--fg-default`), Redis Red accent (`--hyper-07`), Space Grotesk font.

---

## Data Flow: User Opens Chatbot and Asks a Question

```
User                    DemoPage              CopilotSidebar          Backend (/copilotkit)
  │                        │                       │                        │
  │ (demo page loaded,     │                       │                        │
  │  transcript played,    │                       │                        │
  │  memories visible)     │                       │                        │
  │                        │                       │                        │
  │ clicks sidebar toggle  │                       │                        │
  │───────────────────────>│                       │                        │
  │                        │  sidebar opens        │                        │
  │                        │  (defaultOpen: false   │                        │
  │                        │   -> now open)         │                        │
  │                        │                       │                        │
  │                        │  useCopilotReadable    │                        │
  │                        │  (sessionId, userId,   │                        │
  │                        │   namespace already    │                        │
  │                        │   set from playback)   │                        │
  │                        │                       │                        │
  │ types: "What happened  │                       │                        │
  │  in this meeting?"     │                       │                        │
  │───────────────────────────────────────────────>│                        │
  │                        │                       │ POST /copilotkit       │
  │                        │                       │ (includes message +    │
  │                        │                       │  CopilotKit readables) │
  │                        │                       │───────────────────────>│
  │                        │                       │                        │
  │                        │                       │  streamed response     │
  │                        │                       │<───────────────────────│
  │                        │                       │                        │
  │  sees streaming reply  │                       │                        │
  │  "From the Feb 26      │                       │                        │
  │   Google Meet session  │                       │                        │
  │   (8 memories): ..."   │                       │                        │
  │<───────────────────────────────────────────────│                        │
```

---

## Demo Presenter Flow

1. **Run the demo as usual** -- select transcript, play, watch memories appear in MemoryExplorerPanel
2. **Open the chatbot** -- click the sidebar toggle (bottom-right area). The sidebar slides in from the right.
3. **Ask a question** -- "What do we know about James Morrison?" or "What happened in this meeting?"
4. **Watch the streamed response** -- the agent searches memories and streams back a formatted answer with scope stated ("From all stored memories..." or "From the Feb 26 session...")
5. **Ask follow-up questions** -- the chat maintains conversation context
6. **Close sidebar** -- click toggle again to return to full MemoryExplorerPanel view
7. **Reset** -- "Clear All Memories & Restart" also clears the chat (sidebar closes, context resets)

---

## Layout Adjustments (`page.css`)

Minimal changes. The existing 55/45 split is untouched. The sidebar overlays on top.

```css
.demo-page {
  /* existing layout unchanged */
  display: flex;
  gap: var(--panel-gap);
  height: 100vh;
  padding: var(--space-3xs);
}

/* When CopilotKit sidebar is open, the main content area is still full width.
   The sidebar overlays from the right. No width adjustments needed. */
```

CopilotKit's `CopilotSidebar` manages its own positioning (fixed/absolute from the right edge). The `<main>` content does not need to shrink -- the sidebar overlays on top.

---

## Reset Behavior

When the user clicks "Clear All Memories & Restart":

1. TranscriptPanel calls `POST /api/resetLifecycle` and emits `onReset()`
2. DemoPage clears `sessionId` -> `useCopilotReadable` updates to `"none"`
3. MemoryExplorerPanel reacts to `sessionId=null`, clears internal state
4. The CopilotSidebar **stays open** but the conversation history remains (CopilotKit manages its own message state). The next question the user asks will have updated context (`sessionId: "none"`).

If a full chat reset is desired on demo reset, we can call CopilotKit's `useCopilotChat().reset()` hook in the `handleReset` callback. This clears the conversation history in the sidebar.

---

## Implementation Priority (Build Order)

| Phase | What                                                                         | Why                          |
| ----- | ---------------------------------------------------------------------------- | ---------------------------- |
| 1     | Add `@copilotkit/react-core` and `@copilotkit/react-ui` to `package.json`    | Dependencies                 |
| 2     | Add `chatbot` section to `dataset.config.json` + update `DatasetConfig` type | Config-driven labels         |
| 3     | Add `COPILOTKIT_RUNTIME_URL` to `app.constants.ts`                           | Runtime URL constant         |
| 4     | Wrap app with `CopilotKit` provider in `layout.tsx`                          | CopilotKit foundation        |
| 5     | Add `CopilotSidebar` + `useCopilotReadable` in `page.tsx`                    | Chatbot UI + context passing |
| 6     | Create `copilotkit-theme.css` with Redis dark theme overrides                | Visual consistency           |
| 7     | Import `copilotkit-theme.css` in `page.tsx` or `globals.css`                 | Apply theme                  |
| 8     | Test end-to-end with backend (main server + LangGraph server running)        | Integration                  |
| 9     | Polish: adjust sidebar width, font sizes, animations, responsive overlay     | Demo readiness               |

---

## Environment Variables

| Variable                             | Default                            | Description                     |
| ------------------------------------ | ---------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL` | `http://localhost:3001/copilotkit` | Backend CopilotKit endpoint URL |

This is baked into the static bundle at build time (Next.js static export).

---

## Notes

- **Zero changes to existing business components.** TranscriptPanel and MemoryExplorerPanel are untouched. The chatbot is purely additive -- `CopilotKit` provider in layout, `CopilotSidebar` wrapper + `useCopilotReadable` hooks in page.
- **Config-driven labels.** The sidebar title, initial message, and placeholder text come from `dataset.config.json` (`chatbot` section). Switching datasets automatically updates the chatbot's display text.
- **Session context is reactive.** `useCopilotReadable` updates whenever `sessionId` changes. If the user plays a transcript (session created), the agent immediately knows the active session. If the user resets, the agent knows there's no active session. No manual sync needed.
- **CopilotKit manages its own message state.** The sidebar's conversation history is internal to CopilotKit. DemoPage does not need to manage chat messages. The only bridge is `useCopilotReadable` for context passing.
- **CSS theming follows existing conventions.** CopilotKit overrides are in a dedicated `copilotkit-theme.css` file using CSS custom properties from `variables.css`. No inline styles, no Tailwind. Consistent with the project's CSS rules (one file per concern, CSS variables for all values).
- **Static export compatible.** CopilotKit works client-side only. The `CopilotKit` provider connects to the backend URL at runtime via fetch. No server components or API routes needed.
- **The sidebar starts closed (`defaultOpen: false`).** The presenter reveals the chatbot at the right moment during the demo. This keeps the initial view focused on the transcript + memory exploration experience.
- The frontend follows the same code style as the rest of the app: arrow functions, consolidated exports, separate type imports, kebab-case files, PascalCase components, no emojis.

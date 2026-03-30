# Meeting Memory Demo -- Frontend Development Plan (V1)

## Goal

Build a Next.js frontend that powers the **Memory Exploration Demo** for the Redis Released flagship event. V1 focuses on two visual experiences derived from Screen 5 (Transcript History) and Screen 6 (Memory Explorer) of the [full UX plan](./plan.md):

1. **TranscriptPanel** -- a self-contained business component that bundles the demo toolbar (transcript picker, play/stop/reset, speed) with the live transcript feed and playback controls.
2. **MemoryExplorerPanel** -- a fully self-contained, portable business component that takes `userId`, `sessionId`, `namespace`, and `datasetConfig` as props, owns all memory API calls and UI logic internally, and can be integrated into any page without the parent knowing about memory APIs.

**Key design decisions:**

1. **Frontend-driven playback:** The frontend owns the entire playback loop. It fetches the full transcript in one API call, displays chunks at intervals using `setInterval`, and POSTs each chunk to the backend. No SSE, no WebSockets -- pure REST API calls.
2. **Config-driven UI:** Every label, title, speaker name, button text, and description in the UI comes from a `dataset.config.json` file served by the backend via `POST /api/getDataset`. Zero hardcoded display strings. This makes the demo instantly reusable across datasets (wealth advisor, SDR advisor, personal assistant, etc.) without any code changes.
3. **Clear All & Restart:** A prominent button in the toolbar calls `POST /api/resetLifecycle` to wipe all memories in the backend, then resets the frontend state to idle -- ready for a fresh demo run.
4. **Component architecture:** Two layers -- `core/` (generic reusable UI primitives like buttons, dropdowns, cards) and `business/` (domain-specific components: `transcript-panel/` and `memory-explorer-panel/`, each with their own sub-components and hooks). Business components are self-contained and portable.

The frontend consumes the backend's **POST-only REST API** defined in [dev-backend-plan.md](./dev-backend-plan.md). All backend calls are `POST /api/{route}` with JSON body params. All responses are wrapped in `{ data, error }` by `cau-api-server`. The dataset config schema is defined in [data/wealth-advisor/dataset.config.json](../data/wealth-advisor/dataset.config.json).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Next.js App (App Router)                                               │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  DemoPage (/)  -- thin orchestrator                               │  │
│  │  Loads config via useDatasetConfig, bridges sessionId             │  │
│  │  between the two business components.                             │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────┐  ┌──────────────────────────────┐ │  │
│  │  │  TranscriptPanel           │  │  MemoryExplorerPanel          │ │  │
│  │  │  (business component)      │  │  (business component)         │ │  │
│  │  │                            │  │                               │ │  │
│  │  │  ┌──────────────────────┐  │  │  Props: userId, sessionId,   │ │  │
│  │  │  │  Toolbar (sub)       │  │  │    namespace,                │ │  │
│  │  │  │  transcript picker,  │  │  │    datasetConfig             │ │  │
│  │  │  │  play/stop/reset,    │  │  │                               │ │  │
│  │  │  │  speed, status chip  │  │  │                               │ │  │
│  │  │  └──────────────────────┘  │  │  Owns hooks internally:      │ │  │
│  │  │  ┌──────────────────────┐  │  │  - useWorkingMemory          │ │  │
│  │  │  │  TranscriptFeed (sub)│  │  │  - useLongTermMemory         │ │  │
│  │  │  │  auto-scrolling list │  │  │  - useSummaryViews           │ │  │
│  │  │  │  of TranscriptChunks │  │  │                               │ │  │
│  │  │  └──────────────────────┘  │  │  Sub-components:             │ │  │
│  │  │  ┌──────────────────────┐  │  │  - WorkingMemoryTab          │ │  │
│  │  │  │  PlaybackControls    │  │  │  - LongTermMemoryTab         │ │  │
│  │  │  │  progress bar, count │  │  │  - SummaryViewsTab           │ │  │
│  │  │  └──────────────────────┘  │  │  - RedisMetricsTab           │ │  │
│  │  │                            │  │                               │ │  │
│  │  │  Owns hooks internally:    │  │  Zero knowledge of           │ │  │
│  │  │  - useTranscriptPlayback   │  │  TranscriptPanel internals.  │ │  │
│  │  │  - useBackendHealth        │  │  Can be dropped into any     │ │  │
│  │  │                            │  │  page that provides the      │ │  │
│  │  │  Emits: onSessionCreated,  │  │  required props.             │ │  │
│  │  │    onReset                 │  └──────────────────────────────┘ │  │
│  │  └────────────────────────────┘                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Shared (page-level):                                                   │
│  - useDatasetConfig (POST /api/getDataset on mount)                    │
│                                                                         │
│  Core components (generic UI primitives):                               │
│  - StatusDot, EmptyState, MemoryTypeBadge, ConfirmDialog               │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │ HTTP (POST-only API, { data, error } envelope)
         ▼
┌──────────────────────┐
│  cau-api-server      │
│  http://localhost:3001│
└──────────────────────┘
```

### Data Flow Between Business Components

```
DemoPage
  │
  ├─ useDatasetConfig() ──────────────────────────────┐
  │   returns: config, isLoading, error               │
  │                                                    │
  ├─ State owned by DemoPage (minimal bridge):         │
  │   sessionId         (string | null)                │
  │                                                    │
  ├───► TranscriptPanel                                │
  │      props: datasetConfig ◄────────────────────────┘
  │      callbacks: onSessionCreated(id) ─► sets sessionId
  │                 onReset() ─► clears sessionId
  │
  └───► MemoryExplorerPanel
         props: userId ◄── config.userId
                namespace ◄── config.namespace
                sessionId ◄── sessionId state
                datasetConfig ◄── config (for labels only)
```

The page owns only **one piece of bridge state**: `sessionId`. Everything else is internal to each business component. TranscriptPanel manages its own playback status, metrics, and UI. MemoryExplorerPanel reacts to `sessionId` changes and manages all memory polling, fetching, and metrics tracking internally.

---

## Project Structure

```
examples/meeting-memory/frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                          # Root layout (fonts, metadata, global styles)
│   │   ├── page.tsx                            # DemoPage -- thin orchestrator
│   │   ├── page.css                            # DemoPage layout styles
│   │   └── globals.css                         # Global resets, base styles, imports variables.css
│   │
│   ├── components/
│   │   ├── core/                               # Generic reusable UI primitives
│   │   │   ├── status-dot.component.tsx
│   │   │   ├── status-dot.component.css
│   │   │   ├── empty-state.component.tsx
│   │   │   ├── empty-state.component.css
│   │   │   ├── memory-type-badge.component.tsx
│   │   │   ├── memory-type-badge.component.css
│   │   │   ├── confirm-dialog.component.tsx
│   │   │   ├── confirm-dialog.component.css
│   │   │   ├── section-card.component.tsx
│   │   │   ├── section-card.component.css
│   │   │   └── index.ts                        # Barrel export
│   │   │
│   │   └── business/                           # Domain-specific business components
│   │       ├── transcript-panel/               # ══ Transcript + Toolbar business component ══
│   │       │   ├── transcript-panel.component.tsx
│   │       │   ├── transcript-panel.component.css
│   │       │   ├── toolbar.component.tsx
│   │       │   ├── toolbar.component.css
│   │       │   ├── transcript-feed.component.tsx
│   │       │   ├── transcript-feed.component.css
│   │       │   ├── transcript-chunk.component.tsx
│   │       │   ├── transcript-chunk.component.css
│   │       │   ├── playback-controls.component.tsx
│   │       │   ├── playback-controls.component.css
│   │       │   ├── use-transcript-playback.ts
│   │       │   ├── use-backend-health.ts
│   │       │   └── index.ts                    # Barrel: export TranscriptPanel only
│   │       │
│   │       └── memory-explorer-panel/          # ══ Memory Explorer business component ══
│   │           ├── memory-explorer-panel.component.tsx
│   │           ├── memory-explorer-panel.component.css
│   │           ├── working-memory-tab.component.tsx
│   │           ├── working-memory-tab.component.css
│   │           ├── working-memory-summary.component.tsx
│   │           ├── working-memory-summary.component.css
│   │           ├── long-term-memory-tab.component.tsx
│   │           ├── long-term-memory-tab.component.css
│   │           ├── memory-card.component.tsx
│   │           ├── memory-card.component.css
│   │           ├── summary-views-tab.component.tsx
│   │           ├── summary-views-tab.component.css
│   │           ├── computed-summary-card.component.tsx
│   │           ├── computed-summary-card.component.css
│   │           ├── redis-metrics-tab.component.tsx
│   │           ├── redis-metrics-tab.component.css
│   │           ├── use-working-memory.ts
│   │           ├── use-long-term-memory.ts
│   │           ├── use-summary-views.ts
│   │           └── index.ts                    # Barrel: export MemoryExplorerPanel only
│   │
│   ├── hooks/
│   │   └── use-dataset-config.ts              # Page-level: POST /api/getDataset on mount
│   │
│   ├── services/
│   │   └── api.service.ts                     # Centralized fetch wrapper for backend API
│   │
│   ├── types/
│   │   ├── dataset-config.types.ts            # DatasetConfig type (mirrors dataset.config.json)
│   │   ├── transcript.types.ts                # Transcript data types
│   │   ├── memory.types.ts                    # Working memory, LT memory, summary view types
│   │   └── api.types.ts                       # API request/response envelope types
│   │
│   ├── constants/
│   │   └── app.constants.ts                   # API base URL, intervals, tab IDs, status enum
│   │
│   └── styles/
│       └── variables.css                      # CSS custom properties (colors, spacing, typography)
│
├── public/
│   └── redis-logo.svg                         # Redis branding asset
├── package.json
├── next.config.mjs                            # Static export config (output: 'export')
└── tsconfig.json
```

**CSS file rule:** Every `.component.tsx` file gets a matching `.css` file. Each component imports only its own CSS. Parent components do NOT import child CSS -- each child is responsible for its own import. This keeps CSS files small and co-located with their component.

### Component Layer Rules

| Layer        | Path                          | Knows About                                                 | Can Import                                                                                                                                          |
| ------------ | ----------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**     | `components/core/`            | Nothing domain-specific. Pure UI primitives.                | Only CSS variables and its own types. Each component imports its own `.css` file.                                                                   |
| **Business** | `components/business/{name}/` | Its own domain. Owns its hooks, sub-components, styles.     | Core components, `services/`, `types/`, `constants/`. Never imports from other business components. Each sub-component imports its own `.css` file. |
| **Page**     | `app/page.tsx`                | Both business components exist. Bridges state between them. | Business component barrel exports, `hooks/`, `types/`. Imports `page.css`.                                                                          |

Each business component folder exports only its **main component** via `index.ts`. Sub-components, hooks, and styles are internal implementation details -- never imported directly from outside.

**CSS import rule:** Each `.component.tsx` imports its matching `.css` file at the top: `import "./toolbar.component.css"`. Parent components never import child CSS. This keeps each CSS file small and tightly co-located with the component it styles.

---

## Tech Stack

| Tool                  | Version | Purpose                                                         |
| --------------------- | ------- | --------------------------------------------------------------- |
| Next.js               | 15.x    | App Router, React 19, **static export** (`output: 'export'`)    |
| React                 | 19.x    | UI rendering (client-only, no SSR)                              |
| TypeScript            | 5.x     | Type safety                                                     |
| Pure CSS              | --      | Nested CSS, custom properties, one file per component           |
| `@mui/material`       | 6.x     | Material Design components (tabs, chips, buttons, cards, icons) |
| `@mui/icons-material` | 6.x     | Material icons                                                  |

### Why Next.js with Static Export?

This frontend is a **pure client-side app**. No server-side rendering, no API routes, no server components. `next build` produces a static `out/` folder of HTML, CSS, and JS that can be:

- Served from any static web server (nginx, Caddy, S3, Vercel)
- Copied into the `public/` folder of the backend Express/cau-api-server app
- Deployed independently of the backend

We use Next.js (not plain Vite/React) for its App Router file conventions, built-in font optimization, and image optimization -- but configured as a fully static export.

### Why MUI?

- Polished tabs, chips, badges, tooltips out of the box -- essential for the tabbed Memory Explorer
- Consistent Material Design look appropriate for a professional event demo
- Only used for structural components (Tabs, Card, Chip, Button, IconButton, Tooltip, LinearProgress); layout and visual theming done in pure CSS custom properties

---

## Package Dependencies (`package.json`)

```json
{
  "name": "meeting-memory-frontend",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "npx serve out -l 3000"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@mui/material": "^6.6.0",
    "@mui/icons-material": "^6.6.0",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.9.3"
  }
}
```

### Next.js Config (`next.config.mjs`)

```javascript
const nextConfig = {
  output: "export",
  distDir: "out",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
```

- `output: "export"` -- produces static HTML/CSS/JS in `out/` folder
- `images: { unoptimized: true }` -- required for static export (no image optimization server)
- `trailingSlash: true` -- generates `index.html` per route for static hosting compatibility

---

## Constants (`app.constants.ts`)

Only technical/polling constants live here. **All display strings, labels, titles, button text, speed options, and status labels come from the dataset config** (fetched via `GET /api/dataset`).

```typescript
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const WORKING_MEMORY_POLL_INTERVAL_MS = 3000;
const LT_MEMORY_POLL_AFTER_EXTRACTION_MS = 5000;
const EXTRACTION_POLL_INTERVAL_MS = 5000;
const EXTRACTION_MAX_WAIT_MS = 60000;

const DemoTab = {
  WORKING_MEMORY: "working-memory",
  LONG_TERM_MEMORY: "long-term-memory",
  SUMMARY_VIEWS: "summary-views",
  REDIS_METRICS: "redis-metrics",
} as const;

// TranscriptPanel internal status (playback lifecycle)
const PlaybackStatus = {
  IDLE: "idle",
  LOADING: "loading",
  PLAYING: "playing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

// MemoryExplorerPanel internal status (derived from sessionId + data presence)
const ExplorerStatus = {
  IDLE: "idle", // sessionId is null, no data
  OBSERVING: "observing", // sessionId set, polling, waiting for data
  EXTRACTING: "extracting", // working memory complete, LT not yet available
  EXPLORING: "exploring", // LT memories available, all tabs active
  ERROR: "error",
} as const;

// Session ID parsing (for Load Existing Session feature)
const SESSION_ID_PREFIX = "playback";
const SESSION_ID_PATTERN = /^playback-(.+)-(\d{13,})$/;
```

**What moved to `dataset.config.json` (fetched at runtime):**

- `PlaybackSpeed` values and labels -> `config.playbackDefaults.speeds[]`
- Default playback interval -> `config.playbackDefaults.intervalMs`
- Tab titles -> `config.memoryLabels.workingMemory.title`, etc.
- Status chip text -> `config.statusLabels` (both TranscriptPanel and MemoryExplorerPanel use their own keys)
- Toolbar button labels -> `config.toolbar`
- All section descriptions -> `config.memoryLabels.*.description`

---

## UI Design

### Layout: Split Panel (55/45)

```
All titles, labels, and descriptions below are read from `config.*` -- never hardcoded.

┌──────────────────────────────────────────────────────────────────────────┐
│                          DemoPage (thin orchestrator)                     │
│                                                                          │
│  ┌─────────────────────────────┐ ┌──────────────────────────────────────┐│
│  │ ╔═ TranscriptPanel ═══════╗ │ │ ╔═ MemoryExplorerPanel ════════════╗ ││
│  │ ║                         ║ │ │ ║                                  ║ ││
│  │ ║ {config.branding.title} ║ │ │ ║                                  ║ ││
│  │ ║ [Health: OK]            ║ │ │ ║  ┌────────────────────────────┐  ║ ││
│  │ ║ ┌───────────────────┐   ║ │ │ ║  │ [{config.memoryLabels      │  ║ ││
│  │ ║ │ Toolbar (sub)     │   ║ │ │ ║  │   .workingMemory.title}]   │  ║ ││
│  │ ║ │ [Select Meeting ▾]│   ║ │ │ ║  │ [{config.memoryLabels      │  ║ ││
│  │ ║ │ [1x ▾] [▶] [🗑]  │   ║ │ │ ║  │   .longTermMemory.title}]  │  ║ ││
│  │ ║ │ Status: Playing   │   ║ │ │ ║  │ [{config.memoryLabels      │  ║ ││
│  │ ║ └───────────────────┘   ║ │ │ ║  │   .summaryViews.title}]    │  ║ ││
│  │ ║                         ║ │ │ ║  │ [{config.memoryLabels      │  ║ ││
│  │ ║ {config.transcriptPanel ║ │ │ ║  │   .metrics.title}]         │  ║ ││
│  │ ║  .title}                ║ │ │ ║  └────────────────────────────┘  ║ ││
│  │ ║                         ║ │ │ ║                                  ║ ││
│  │ ║ ┌───────────────────┐   ║ │ │ ║  ┌────────────────────────────┐  ║ ││
│  │ ║ │ 00:00:05          │   ║ │ │ ║  │                            │  ║ ││
│  │ ║ │ RM: Sarah         │   ║ │ │ ║  │  (active tab content)     │  ║ ││
│  │ ║ │ Hi James...       │   ║ │ │ ║  │                            │  ║ ││
│  │ ║ ├───────────────────┤   ║ │ │ ║  │  {config.memoryLabels     │  ║ ││
│  │ ║ │ 00:00:10          │   ║ │ │ ║  │   .[activeTab]            │  ║ ││
│  │ ║ │ Client: James     │   ║ │ │ ║  │   .description}           │  ║ ││
│  │ ║ │ Hey Sarah...      │   ║ │ │ ║  │                            │  ║ ││
│  │ ║ │ ▼ auto-scrolling  │   ║ │ │ ║  └────────────────────────────┘  ║ ││
│  │ ║ └───────────────────┘   ║ │ │ ║                                  ║ ││
│  │ ║ Chunks: 12/56 | 22%    ║ │ │ ║                                  ║ ││
│  │ ║                         ║ │ │ ║                                  ║ ││
│  │ ╚═════════════════════════╝ │ │ ╚══════════════════════════════════╝ ││
│  └─────────────────────────────┘ └──────────────────────────────────────┘│
│                                                                          │
│  {config.branding.footerText}                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. DemoPage (`app/page.tsx`) -- Thin Orchestrator

The root page component. Its only job is to load the dataset config, render the two business components, and bridge state between them. **All display strings come from `datasetConfig`**, never hardcoded.

**State managed at this level (minimal bridge):**

- `datasetConfig` -- the active dataset configuration (from `POST /api/getDataset`, fetched once on mount via `useDatasetConfig`)
- `sessionId` -- current working memory session ID (set by TranscriptPanel callback)

Note: `userId` and `namespace` are read from `datasetConfig.userId` and `datasetConfig.namespace` -- not separate state variables. Playback status and metrics are fully internal to TranscriptPanel. Memory polling and metrics are fully internal to MemoryExplorerPanel.

**Lifecycle:**

1. On mount: fetch dataset config from `POST /api/getDataset` (via `useDatasetConfig`). Show loading spinner until config arrives. All labels render from this config.
2. On config loaded: render TranscriptPanel and MemoryExplorerPanel.
3. TranscriptPanel emits `onSessionCreated(sessionId)` -> DemoPage sets `sessionId` -> MemoryExplorerPanel receives it as a prop, begins internal memory polling.
4. TranscriptPanel emits `onReset()` -> DemoPage clears `sessionId` -> MemoryExplorerPanel receives `null`, clears all internal state.

**Render structure:**

```tsx
<main className="demo-page">
  <TranscriptPanel
    datasetConfig={config}
    onSessionCreated={setSessionId}
    onReset={handleReset}
  />
  <MemoryExplorerPanel
    userId={config.userId}
    namespace={config.namespace}
    sessionId={sessionId}
    datasetConfig={config}
  />
</main>
```

---

### 2. Core Components (`components/core/`)

Generic reusable UI primitives with zero domain knowledge. Styled via CSS variables.

#### 2a. StatusDot (`status-dot.component.tsx`)

Health indicator dot (green/red/yellow).

**Props:**

- `status: "ok" | "error" | "checking"`

**Visual:** Small colored circle with optional pulse animation for "checking" state.

#### 2b. EmptyState (`empty-state.component.tsx`)

Placeholder shown when a section has no data.

**Props:**

- `icon?: React.ReactNode` -- optional MUI icon
- `title: string`
- `description?: string`

**Visual:** Centered icon + text, muted colors, subtle styling.

#### 2c. MemoryTypeBadge (`memory-type-badge.component.tsx`)

Colored badge for memory types.

| Type       | Color           | Label      |
| ---------- | --------------- | ---------- |
| `semantic` | Blue (#2196F3)  | "Semantic" |
| `episodic` | Green (#4CAF50) | "Episodic" |
| `message`  | Gray (#9E9E9E)  | "Message"  |

**Props:**

- `memoryType: "semantic" | "episodic" | "message"`

Uses MUI Chip with custom colors derived from CSS variables.

#### 2d. ConfirmDialog (`confirm-dialog.component.tsx`)

Confirmation dialog for destructive actions (e.g., "Clear All Memories & Restart").

**Props:**

- `open: boolean`
- `title: string`
- `message: string`
- `confirmLabel: string`
- `cancelLabel?: string`
- `onConfirm: () => void`
- `onCancel: () => void`
- `isLoading?: boolean`

Uses MUI Dialog.

#### 2e. SectionCard (`section-card.component.tsx`)

Card wrapper with title, optional description, and children.

**Props:**

- `title: string`
- `description?: string`
- `actions?: React.ReactNode` -- optional top-right action buttons (e.g., refresh)
- `children: React.ReactNode`

Uses pure CSS with `--bg-card` background and `--border-color` border.

---

### 3. TranscriptPanel -- Business Component (`components/business/transcript-panel/`)

Self-contained business component that bundles the **demo toolbar** (transcript picker, play/stop/reset, speed, status, health) with the **transcript feed** and **playback controls**. Left panel, 55% width on desktop.

This component owns the entire transcript lifecycle: fetching transcript lists, selecting transcripts, creating sessions, running playback, and triggering resets. It communicates with DemoPage purely through callbacks.

#### TranscriptPanel Props (public interface)

```typescript
type TranscriptPanelProps = {
  datasetConfig: DatasetConfig;
  onSessionCreated: (sessionId: string) => void;
  onReset: () => void;
};
```

Only two callbacks. No playback status or metrics leak outside. The parent only needs to know: (1) a session was created (so it can pass `sessionId` to MemoryExplorerPanel), and (2) a reset happened (so it can clear `sessionId`).

#### Internal State (managed within TranscriptPanel)

- `transcripts` -- list of available transcripts (from `POST /api/listTranscripts`)
- `sessions` -- list of existing working memory session IDs (from `POST /api/listWorkingMemorySessions`)
- `selectedTranscriptId` -- which transcript is selected in the dropdown
- `transcriptData` -- full transcript JSON (fetched on selection)
- `displayedChunks` -- array of chunks visible in the feed (grows during playback)
- `playbackStatus` -- idle / loading / playing / completed / error (internal to this component)
- `playbackMetrics` -- chunks processed, append latencies (internal, shown in PlaybackControls)
- `isResetting` -- whether a reset is in progress
- `healthStatus` -- backend health check result (from `useBackendHealth`)

#### Internal Lifecycle

1. On mount: fetch transcript list from `POST /api/listTranscripts` AND session list from `POST /api/listWorkingMemorySessions`
2. On transcript selection: fetch full transcript via `POST /api/getTranscript { transcriptId }`
3. On Play: call `POST /api/createWorkingMemory { transcriptId }` to create session -> emit `onSessionCreated(sessionId)` -> start playback via `useTranscriptPlayback`
4. During playback: update internal `playbackStatus` and `playbackMetrics` per tick
5. On playback complete: update internal status to "completed". TranscriptPanel has no knowledge of extraction -- that is MemoryExplorerPanel's concern.
6. On "Load Existing Session": parse `transcriptId` from session ID (format: `playback-{transcriptId}-{timestamp}`), fetch the transcript, display all chunks instantly via `playback.loadAll()`, set status to "completed", emit `onSessionCreated(sessionId)` -- MemoryExplorerPanel auto-populates with working memory, LT memories, and summaries for the loaded session.
7. On "Clear All": show ConfirmDialog, call `POST /api/resetLifecycle`, clear internal state (including sessions list), emit `onReset()`

#### Sub-component: Toolbar (`toolbar.component.tsx`)

Top horizontal bar within TranscriptPanel. **All labels from `datasetConfig.toolbar` and `datasetConfig.statusLabels`.**

| Element                   | Config source                                                   | Type                          | Behavior                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transcript dropdown       | `config.toolbar.transcriptDropdownLabel`                        | MUI Select                    | Lists available transcripts                                                                                                                               |
| Session picker dropdown   | `config.toolbar.sessionDropdownLabel`                           | MUI Select                    | Lists existing working memory sessions (from `POST /api/listWorkingMemorySessions`). Only renders when sessions exist. Separated from transcript dropdown by "or" label. Selecting a session loads the full transcript + sets completed state + populates MemoryExplorerPanel. |
| Speed dropdown            | `config.toolbar.speedLabel`, `config.playbackDefaults.speeds[]` | MUI Select                    | Speed options from config                                                                                                                                 |
| Play button               | `config.toolbar.playLabel`                                      | MUI IconButton (PlayArrow)    | Starts playback, disabled while playing                                                                                                                   |
| Stop button               | `config.toolbar.stopLabel`                                      | MUI IconButton (Stop)         | Stops playback mid-stream, keeps data                                                                                                                     |
| Clear All button          | `config.toolbar.resetLabel`                                     | MUI Button (DeleteSweep, red) | **Prominently styled.** Triggers `POST /api/resetLifecycle` via parent. Shows ConfirmDialog first.                                                        |
| Status chip               | `config.statusLabels[playbackStatus]`                           | MUI Chip                      | Config-driven text per status                                                                                                                             |
| Health indicator          | --                                                              | StatusDot (core)              | Green/red based on `GET /health`                                                                                                                          |

**Clear All button details:**

- Visible at all times (not just after playback)
- Uses a destructive visual style (red outline or filled red)
- Shows ConfirmDialog: "This will delete all working memory, long-term memories, and summary views for this dataset. Continue?"
- On confirm: `POST /api/resetLifecycle` -> clear all internal state -> emit `onReset()`
- While resetting, button shows a spinner and status chip shows "Resetting..."

#### Sub-component: TranscriptFeed (`transcript-feed.component.tsx`)

Scrollable container that renders `TranscriptChunk` sub-components. Auto-scrolls to bottom as new chunks arrive.

**Props (internal):**

- `chunks: TranscriptChunkData[]` -- grows during playback
- `roles: Record<string, RoleConfig>` -- from config, for speaker labels
- `participants: Record<string, ParticipantConfig>` -- from config, for speaker names
- `isPlaying: boolean`

**Behavior:**

- New chunks animate in with a subtle fade-up transition
- Auto-scroll to bottom on new chunk (unless user has scrolled up manually)
- Different visual treatment for RM vs client speakers

#### Sub-component: TranscriptChunk (`transcript-chunk.component.tsx`)

A single transcript message bubble.

**Props (internal):**

- `timestamp: string` -- "00:12:15"
- `speaker: string` -- "James Morrison"
- `role: string` -- "client" | "rm"
- `roleLabel: string` -- from `config.roles[role].shortLabel`
- `text: string`
- `isNew: boolean` -- triggers entrance animation

**Visual:**

- Client messages: left-aligned, neutral background
- RM messages: right-aligned, accent background (using `config.branding.accentColor`)
- Timestamp badge above each message
- Speaker name + role label (e.g., "Sarah Chen (RM)")
- Fade-in animation for newly arrived chunks

#### Sub-component: PlaybackControls (`playback-controls.component.tsx`)

Progress indicator at the bottom of the transcript panel.

**Props (internal):**

- `currentChunk: number`
- `totalChunks: number`
- `status: PlaybackStatus`

**Visual:**

- MUI LinearProgress bar showing completion percentage
- Text: "12 / 56 chunks" or "Playback complete"

#### Internal Hook: `useTranscriptPlayback`

See [Hooks: useTranscriptPlayback](#usetranscriptplaybacktranscriptdata-sessionid-intervalms) section below.

#### Internal Hook: `useBackendHealth`

See [Hooks: useBackendHealth](#usebackendhealth) section below.

---

### 4. MemoryExplorerPanel -- Business Component (`components/business/memory-explorer-panel/`)

**Fully self-contained, portable business component.** Takes `userId`, `sessionId`, `namespace`, and display config as props. Owns ALL memory API calls, hooks, and UI logic internally. Can be integrated into any page (demo page, chatbot page, admin page) by just providing the required props -- zero knowledge of TranscriptPanel.

Right panel, 45% width on desktop, tabbed interface.

#### MemoryExplorerPanel Props (public interface)

```typescript
type MemoryExplorerPanelProps = {
  userId: string;
  namespace: string;
  sessionId: string | null;
  datasetConfig: DatasetConfig;
};
```

**Why these props are sufficient for portability:**

- `userId` + `namespace` -- identify whose memories to query. Not tied to any transcript concept.
- `sessionId` -- scopes working memory and session-specific LT memory queries. Can be `null` (shows empty states). The panel reacts to `sessionId` changes -- that is its only external signal.
- `datasetConfig` -- used for display labels and branding only. The panel never modifies it.

No `playbackStatus`, no `playbackMetrics`. The panel has zero knowledge of transcript playback. It derives all its internal states from `sessionId` and the data it fetches from its own API calls.

#### Internal State (managed within MemoryExplorerPanel)

- `activeTab` -- which tab is selected (WorkingMemory, LongTermMemory, SummaryViews, RedisMetrics)
- `explorerStatus` -- internal status derived from data: `idle` (no session) / `observing` (session exists, polling) / `exploring` (LT memories available) / `error`
- Working memory data (from `useWorkingMemory` hook)
- Long-term memory data (from `useLongTermMemory` hook)
- Summary views data (from `useSummaryViews` hook)
All data fetching is triggered internally based on `sessionId` changes only.

#### Internal Behavior (sessionId-driven, no playback knowledge)

1. On `sessionId` change to non-null: start polling working memory every 3s, start polling LT memories every 5s
2. Working memory polling: as data arrives, WorkingMemoryTab updates. When `context` field appears, highlight it.
3. LT memory polling: initially returns 0 results (extraction hasn't happened yet). When extraction completes on the backend, results start appearing. The panel detects this automatically -- no external signal needed. Once results appear, reduce poll frequency or stop.
4. On `sessionId` change to `null` (reset): stop all polling, clear all internal state, show empty states
#### Tabs (labels from config)

| Tab              | Config Label Source                        | Icon           | When Active                   |
| ---------------- | ------------------------------------------ | -------------- | ----------------------------- |
| Working Memory   | `config.memoryLabels.workingMemory.title`  | Memory icon    | During and after playback     |
| Long-Term Memory | `config.memoryLabels.longTermMemory.title` | Storage icon   | After extraction completes    |
| Summary Views    | `config.memoryLabels.summaryViews.title`   | Summarize icon | After creating a summary view |
| Redis Metrics    | `config.memoryLabels.metrics.title`        | Speed icon     | Always                        |

Each tab shows an EmptyState (core) with `config.memoryLabels.[tab].description` when no data is available.

#### Sub-component: WorkingMemoryTab (`working-memory-tab.component.tsx`)

Displays the current state of working memory for the active session.

**Data source:** `useWorkingMemory(sessionId)` internal hook, polls `POST /api/getWorkingMemory { sessionId }` every 3 seconds during playback.

**Sections:**

**a) Session Info (top card)** -- uses `namespace`, `userId` from panel props

```
Session: playback-2026-02-26-google-meet-17112...
User: {userId}
Namespace: {namespace}
Created: 2026-02-26 10:00:00
Last Updated: 2026-02-26 10:14:00
```

**b) Context Window Usage (visual gauge)**

```
Context Window Usage
[====================              ] 32%
4,250 tokens | 68% until summarization
```

- MUI LinearProgress with color coding: green < 50%, yellow 50-80%, red > 80%
- When `context` field is non-null, show a visual flag: "Context summarized"

**c) Working Memory Summary (`working-memory-summary.component.tsx`)**

When the `context` field is populated (agent memory server auto-generates this when the context window fills up), display it in a highlighted card. Section title from `config.memoryLabels.workingMemory.contextSummaryLabel`:

```
{config.memoryLabels.workingMemory.contextSummaryLabel}
┌─────────────────────────────────────────────────┐
│ Sarah and James discussed REIT rebalancing,     │
│ moving $150K into bonds and dividend ETFs.      │
│ James revealed Maya may retire early in 2027... │
└─────────────────────────────────────────────────┘
```

This is a key demo moment -- showing the agent memory server automatically condensing the conversation.

**d) Messages Preview**

Show the last 5 messages with a "Show all (56 messages)" expandable section.

**e) Attached Memories**

If `memories` array in working memory is non-empty, show them as a list of chips.

#### Sub-component: LongTermMemoryTab (`long-term-memory-tab.component.tsx`)

Displays long-term memories extracted from the transcript, grouped by memory type.

**Data source:** `useLongTermMemory(sessionId)` internal hook, fetches from `POST /api/searchLongTermMemoryBySession { sessionId }`.

**Layout:**

Three collapsible sections, each with a count badge. **Section titles and descriptions from `config.memoryLabels.longTermMemory`:**

**a) Semantic Memories -- label: `config.memoryLabels.longTermMemory.semantic.label`**

```
{config.memoryLabels.longTermMemory.semantic.label} (6)
{config.memoryLabels.longTermMemory.semantic.description}
┌─────────────────────────────────────────────┐
│ Maya Morrison considering early retirement   │
│ in 2027                                      │
│ Topics: retirement, spouse, planning         │
│ Entities: Maya Morrison                      │
│ Created: 2026-02-26 10:15                    │
├─────────────────────────────────────────────┤
│ James prefers bond funds over individual     │
│ bond laddering for simplicity                │
│ Topics: investment, preferences, bonds       │
│ Created: 2026-02-26 10:15                    │
└─────────────────────────────────────────────┘
```

**b) Episodic Memories -- label: `config.memoryLabels.longTermMemory.episodic.label`**

```
{config.memoryLabels.longTermMemory.episodic.label} (2)
{config.memoryLabels.longTermMemory.episodic.description}
┌─────────────────────────────────────────────┐
│ REIT rebalance: $150K moved to bonds/ETFs   │
│ Event Date: 2026-02-26                       │
│ Topics: rebalancing, REIT, bonds             │
│ Created: 2026-02-26 10:15                    │
└─────────────────────────────────────────────┘
```

**c) Message Memories -- label: `config.memoryLabels.longTermMemory.message.label`**

```
{config.memoryLabels.longTermMemory.message.label} (0)
No message memories extracted.
```

Each memory is rendered as a `MemoryCard` sub-component.

#### Sub-component: MemoryCard (`memory-card.component.tsx`)

Single long-term memory card used within LongTermMemoryTab.

**Props (internal):**

- `memory: MemoryRecordData`
- `memoryLabels: DatasetConfig["memoryLabels"]["longTermMemory"]`

**Features:**

- Color-coded left border by memory type (semantic=blue, episodic=green, message=gray)
- MemoryTypeBadge (core component)
- Topic chips (MUI Chip, outlined)
- Entity chips (MUI Chip, outlined, different color)
- Timestamp
- Expandable full text for long memories

**Refresh button** at the top of LongTermMemoryTab -- re-fetches long-term memories (useful after extraction completes).

**Search box** (optional V1 enhancement) -- uses `POST /api/searchLongTermMemory { text: "..." }` to filter memories.

#### Sub-component: SummaryViewsTab (`summary-views-tab.component.tsx`)

Displays all summary views in a uniform flat list. All pre-seeded views from the dataset config are available immediately. Each view can have **multiple computed partitions** (one per group value, e.g. one per session for `groupBy: session_id`).

**Data source:** `useSummaryViews()` internal hook.

**Workflow:**

1. The backend pre-creates all summary views defined in `config.memoryLabels.summaryViews.views` at startup. The frontend discovers them via `POST /api/listSummaryViews`.
2. When the user opens the Summary Views tab, all views are rendered uniformly -- each with a header (name, source, groupBy).
3. A view-level **"Compute Summary"** button appears only when the current group (determined by the active session/user) does **not** already have a computed partition. For example, if "Session Recap" (groupBy: `session_id`) has a partition for Oct 28 but the active session is Feb 26, the button appears so the user can compute for the new session.
4. Clicking "Compute Summary" calls `POST /api/computeSummary { viewId, group }` and shows a loading spinner. This triggers the LLM to generate the narrative.
5. Once computed, the summary appears as a `ComputedSummaryCard`. Each card has its own **per-card "Recompute"** button so partitions can be independently re-triggered (e.g., after more memories are added to that session).
6. If the current group already has a partition, no view-level button is shown -- only per-card Recompute buttons on existing partitions.
7. All computed partitions are shown regardless of which session is active -- the tab is an overview of all summaries.
8. The `createSummaryView` API remains available for on-the-fly custom views if needed.

#### Sub-component: ComputedSummaryCard (`computed-summary-card.component.tsx`)

Display for a single computed summary. Each card includes a **per-card "Recompute" button** (top-right of the card header) that re-triggers computation for that specific partition's group. This allows independent recomputation -- e.g., recomputing the Oct 28 session recap without affecting the Feb 26 recap.

```
SUMMARY: {view.name}
Source: Long-Term Memory | Group: user_id = {userId}
Memories analyzed: 8 | Computed: 2026-02-26 10:20

┌─────────────────────────────────────────────────┐
│ James Morrison is a moderate-risk high-net-      │
│ worth client targeting $3M by retirement in      │
│ 2031. He favors dividend income and is           │
│ emotionally conservative during market           │
│ downturns. His daughter Emily starts college     │
│ in 2027 (~$200K needed). Wife Maya may retire    │
│ early 2027, requiring income planning revision.  │
│ Recently rebalanced $150K from REITs into        │
│ bonds and ETFs.                                  │
│                                                  │
│ Condensed from 8 long-term memories.             │
└─────────────────────────────────────────────────┘
```

This is a major demo moment -- showing the agent memory server condensing all extracted memories into a coherent narrative.

**Also supports internally:**

- List all views via `POST /api/listSummaryViews`
- Fetch computed summaries via `POST /api/getComputedSummaries { viewId }`
- Delete a view via `POST /api/deleteSummaryView { viewId }`

#### Sub-component: RedisMetricsTab (`redis-metrics-tab.component.tsx`)

"Redis Under the Hood" -- shows operational stats tracked entirely within MemoryExplorerPanel.

**Data source:** Live memory data from the panel's hooks (working memory state, LT memory count, computed summary count).

**Layout:**

```
REDIS UNDER THE HOOD

Memory Lifecycle
┌───────────────────────────────────────────┐
│ Working Memory  → 56 messages, 4250 tokens│
│ Extraction      → 8 long-term facts       │
│ Summarization   → 1 computed summary      │
└───────────────────────────────────────────┘
```

Each stat is displayed as a key-value row showing the current state of the memory lifecycle.

#### Internal Hooks

- `useWorkingMemory` -- see [Hooks section](#useWorkingMemorysessionid-enabled)
- `useLongTermMemory` -- see [Hooks section](#uselongtermemorysessionid)
- `useSummaryViews` -- see [Hooks section](#usesummaryviews)

---

## Custom Hooks

Hooks are organized by ownership. Page-level hooks live in `src/hooks/`. Business component hooks live inside their respective component folder.

### Page-Level: `useDatasetConfig()` (`hooks/use-dataset-config.ts`)

Fetches the dataset configuration on mount. This is the **first hook that runs** -- the entire UI depends on it.

```typescript
type UseDatasetConfigResult = {
  config: DatasetConfig | null;
  isLoading: boolean;
  error: string | null;
};
```

**Behavior:**

1. On mount: `POST /api/getDataset {}` (empty body)
2. Unwraps `{ data, error }` response envelope
3. Stores the full config in state
4. While loading, the page shows a centered spinner
5. On error, shows a full-page error with retry button
6. Once loaded, config is passed as a prop to both business components

**DatasetConfig type** (`dataset-config.types.ts`):

```typescript
type RoleConfig = {
  label: string;
  shortLabel: string;
};

type ParticipantConfig = {
  name: string;
  title: string;
  organization: string;
};

type MemoryTypeLabel = {
  label: string;
  description: string;
};

type DatasetConfig = {
  id: string;
  name: string;
  description: string;
  namespace: string;
  userId: string;
  branding: {
    title: string;
    subtitle: string;
    footerText: string;
    accentColor: string;
  };
  roles: Record<string, RoleConfig>;
  participants: Record<string, ParticipantConfig>;
  memoryLabels: {
    workingMemory: {
      title: string;
      description: string;
      contextSummaryLabel: string;
    };
    longTermMemory: {
      title: string;
      description: string;
      semantic: MemoryTypeLabel;
      episodic: MemoryTypeLabel;
      message: MemoryTypeLabel;
    };
    summaryViews: {
      title: string;
      description: string;
      views: SummaryViewConfigEntry[];
    };
    metrics: {
      title: string;
      description: string;
    };
  };
  transcriptPanel: {
    title: string;
    playingLabel: string;
    completedLabel: string;
  };
  toolbar: {
    transcriptDropdownLabel: string;
    sessionDropdownLabel: string;
    playLabel: string;
    stopLabel: string;
    resetLabel: string;
    speedLabel: string;
  };
  statusLabels: Record<string, string>;
  playbackDefaults: {
    intervalMs: number;
    speeds: Array<{ label: string; intervalMs: number }>;
  };
};
```

Note: `SummaryViewConfigEntry` is `{ name: string; source: string; groupBy: string[]; filters?: Record<string, unknown>; timeWindowDays?: number; continuous?: boolean; prompt?: string }`. These view definitions are pre-seeded by the backend at startup -- the frontend discovers them via `listSummaryViews`.

---

### TranscriptPanel Hooks (internal to `components/business/transcript-panel/`)

#### `useTranscriptPlayback(transcriptData, sessionId, intervalMs)`

The core playback hook. The frontend owns the entire playback loop. Lives inside the TranscriptPanel folder -- only TranscriptPanel uses it.

```typescript
type UseTranscriptPlaybackResult = {
  displayedChunks: TranscriptChunkData[];
  currentIndex: number;
  totalChunks: number;
  isPlaying: boolean;
  isComplete: boolean;
  lastAppendResult: AppendResult | null;
  metrics: PlaybackMetrics;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  loadAll: () => void;
};

type PlaybackMetrics = {
  chunksProcessed: number;
  totalAppendLatencyMs: number;
  avgAppendLatencyMs: number;
  appendLatencies: number[];
};
```

**Behavior:**

1. `start()` begins a `setInterval` at `intervalMs`
2. Each tick:
   a. Get `chunks[currentIndex]` from the pre-loaded transcript
   b. Add it to `displayedChunks` state (UI renders it immediately)
   c. Fire-and-forget `POST /api/appendWorkingMemory { sessionId, chunk, isLastChunk }` with the chunk data
   d. When the POST resolves, update `lastAppendResult` (tokens, context, latency)
   e. Track latency in `metrics`
   f. If `currentIndex === totalChunks - 1`, send with `isLastChunk: true` and stop the interval
3. `stop()` clears the interval but keeps displayed chunks and session intact
4. `reset()` clears everything -- displayed chunks, metrics, session ID
5. `loadAll()` instantly displays all chunks (no interval), sets `currentIndex` to `chunks.length`, sets status to `COMPLETED`. Used by the "Load Existing Session" feature to show the full transcript without replaying it.

**Why fire-and-forget the POST:** The UI display is instant (from local state). The API call happens in the background. If the API is slow on one tick, the next chunk still displays on time. The `lastAppendResult` state updates asynchronously, so the Working Memory tab shows the latest server-side stats with a slight lag -- which is fine for the demo and actually looks more realistic.

**Why not `await` the POST:** We do not want playback to stall if an API call takes longer than the interval. The visual experience must be smooth regardless of network latency.

#### `useBackendHealth()`

Checks backend + agent memory server health on mount and periodically. Lives inside the TranscriptPanel folder (health indicator is part of the toolbar).

```typescript
type UseBackendHealthResult = {
  serverOk: boolean;
  agentMemoryOk: boolean;
  isChecking: boolean;
};
```

---

### MemoryExplorerPanel Hooks (internal to `components/business/memory-explorer-panel/`)

#### `useWorkingMemory(sessionId, enabled)`

Polls the working memory state at a configurable interval. Lives inside the MemoryExplorerPanel folder.

```typescript
type UseWorkingMemoryResult = {
  data: WorkingMemoryData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};
```

**Behavior:**

- Polls `POST /api/getWorkingMemory { sessionId }` every `WORKING_MEMORY_POLL_INTERVAL_MS` while `enabled` is true
- Stops polling when playback completes (fetches one final time)
- Provides `refetch` for manual refresh

#### `useLongTermMemory(sessionId)`

Fetches long-term memories for a given session. Lives inside the MemoryExplorerPanel folder.

```typescript
type UseLongTermMemoryResult = {
  memories: MemoryRecordData[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  searchByText: (query: string) => void;
};
```

**Behavior:**

- Fetches from `POST /api/searchLongTermMemoryBySession { sessionId }` on mount and on `refetch`
- `searchByText` hits `POST /api/searchLongTermMemory { text: "..." }`
- Groups memories by `memoryType` for display
- Can poll at `EXTRACTION_POLL_INTERVAL_MS` during the "extracting" phase until memories appear

#### `useSummaryViews()`

Manages summary views and computed summary operations. Lives inside the MemoryExplorerPanel folder. All views are discovered via `listSummaryViews` -- pre-seeded views are created by the backend at startup from the dataset config.

```typescript
type UseSummaryViewsResult = {
  views: SummaryViewData[];
  summaries: Map<string, ComputedSummaryData[]>;
  isLoading: boolean;
  isComputingSummary: boolean;
  fetchSummariesForView: (viewId: string) => Promise<void>;
  createNewView: (input: CreateSummaryViewInput) => Promise<void>;
  computeSummaryForView: (
    viewId: string,
    group: Record<string, string>,
  ) => Promise<void>;
  deleteView: (viewId: string) => Promise<void>;
  error: string | null;
};
```

**Behavior:**

- `computeSummaryForView(viewId, group)` -- calls `POST /api/computeSummary { viewId, group }`. Used for any view -- all views are treated uniformly.
- `fetchSummariesForView(viewId)` -- calls `POST /api/getComputedSummaries { viewId }` to read cached computed summaries.
- `createNewView(input)` -- calls `POST /api/createSummaryView` for on-the-fly custom views.
- On mount, fetches the list of views via `POST /api/listSummaryViews`.

---

## API Service (`api.service.ts`)

Centralized fetch wrapper. **All API calls are POST** (except `GET /health`). The backend wraps all responses in `{ data, error }` -- the `apiPost` helper unwraps this automatically.

```typescript
type ApiResponse<T> = { data: T; error: null } | { data: null; error: string };

const apiPost = async <T>(path: string, body: unknown = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: ApiResponse<T> = await response.json();
  if (json.error) throw new Error(json.error);
  return json.data;
};

const apiGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const json: ApiResponse<T> = await response.json();
  if (json.error) throw new Error(json.error);
  return json.data;
};

// Dataset Config
const fetchDatasetConfig = () => apiPost<DatasetConfig>("/api/getDataset");
const listDatasets = () => apiPost<DatasetListResponse>("/api/listDatasets");

// Transcripts
const fetchTranscripts = () =>
  apiPost<TranscriptListResponse>("/api/listTranscripts");
const fetchTranscript = (transcriptId: string) =>
  apiPost<TranscriptData>("/api/getTranscript", { transcriptId });

// Working Memory
const createWorkingMemory = (transcriptId: string) =>
  apiPost<CreateSessionResponse>("/api/createWorkingMemory", { transcriptId });
const appendChunk = (
  sessionId: string,
  chunk: TranscriptChunk,
  isLastChunk: boolean,
) =>
  apiPost<AppendResult>("/api/appendWorkingMemory", {
    sessionId,
    chunk,
    isLastChunk,
  });
const fetchWorkingMemory = (sessionId: string) =>
  apiPost<WorkingMemoryData>("/api/getWorkingMemory", { sessionId });
const deleteWorkingMemory = (sessionId: string) =>
  apiPost<void>("/api/deleteWorkingMemory", { sessionId });
const listWorkingMemorySessions = (limit?: number, offset?: number) =>
  apiPost<ListSessionsResponse>("/api/listWorkingMemorySessions", { limit, offset });

// Long-Term Memory
const searchLongTermMemory = (params: LTSearchParams) =>
  apiPost<LTSearchResponse>("/api/searchLongTermMemory", params);
const fetchLTBySession = (sessionId: string) =>
  apiPost<LTSearchResponse>("/api/searchLongTermMemoryBySession", {
    sessionId,
  });

// Summary Views
const createSummaryView = (input: CreateViewInput) =>
  apiPost<SummaryViewData>("/api/createSummaryView", input);
const listSummaryViews = () =>
  apiPost<SummaryViewListResponse>("/api/listSummaryViews");
const computeSummary = (viewId: string, group: Record<string, string>) =>
  apiPost<ComputedSummaryData>("/api/computeSummary", { viewId, group });
const fetchComputedSummaries = (viewId: string) =>
  apiPost<ComputedSummariesResponse>("/api/getComputedSummaries", { viewId });
const deleteSummaryView = (viewId: string) =>
  apiPost<void>("/api/deleteSummaryView", { viewId });

// Lifecycle
const resetDemo = () => apiPost<ResetResponse>("/api/resetLifecycle");

// Health (GET -- built into cau-api-server)
const fetchHealth = () => apiGet<HealthResponse>("/health");
```

Key differences from a traditional REST API service:

- **All calls are POST** with JSON body params. No URL params, no query strings.
- **`userId` and `namespace` are never sent** -- the backend derives them from the active dataset config.
- **Response envelope** `{ data, error }` is unwrapped by `apiPost` -- hooks receive clean typed data.
- **`createWorkingMemory` and `appendChunk` don't take `userId`** -- backend handles it.

---

## CSS Design System (`variables.css`)

Based on the [Redis Visual Identity Guide](../../.cursor/skills/redis-visual-guide/SKILL.md). Uses official Redis brand colors, typography, and spacing tokens.

```css
:root {
  /* ── Typography (Redis brand fonts) ── */
  --primary-font: "Space Grotesk", sans-serif;
  --secondary-font: "Space Mono", monospace;

  /* Font sizes (body scale from Redis guide) */
  --font-size-2xs: 0.625rem; /* 10px */
  --font-size-xs: 0.75rem; /* 12px */
  --font-size-rg: 0.875rem; /* 14px -- body regular */
  --font-size-sm: 1rem; /* 16px -- body small heading */
  --font-size-md: 1.125rem; /* 18px -- body medium */
  --font-size-lg: 1.25rem; /* 20px -- body large */
  --font-size-xl: 1.5rem; /* 24px -- heading */
  --font-size-2xl: 2rem; /* 32px -- display heading */

  /* Font weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  /* ── Brand Core Colors ── */
  --primary-color: #ff4438; /* Redis Red */
  --midnight: #091a23; /* Dark backgrounds, primary text bg */
  --yellow: #dcff1e; /* Accent on dark, highlights */
  --base-white: #ffffff;
  --base-black: #000000;

  /* ── Red / Hyper Scale (buttons, links, interactive) ── */
  --hyper-04: #fd736a; /* Light red, hover accents */
  --hyper-05: #ff4438; /* Same as primary */
  --hyper-07: #e4291e; /* Primary button bg, links */
  --hyper-08: #d1281e; /* Button hover bg */
  --hyper-09: #8a221c; /* Deep red, active states */
  --hyper-10: #351d22; /* Darkest red, dark theme buttons */

  /* ── Dusk Scale (dark theme surfaces, borders, muted text) ── */
  --dusk: #163341; /* Dark UI surfaces, cards */
  --dusk-09: #0d212c; /* Deepest dark surface */
  --dusk-90: #2d4754; /* Dark surface variant */
  --dusk-50: #8a99a0; /* Placeholder text, dividers */
  --dusk-30: #b9c2c6; /* Borders, muted text */
  --dusk-10: #d9d9d9; /* Body text on dark */

  /* ── Semantic Theme Tokens (dark theme) ── */
  --bg-default: var(--midnight); /* Page background */
  --bg-surface: var(--dusk-09); /* Card / panel background */
  --bg-surface-hover: var(--dusk); /* Card hover */
  --bg-surface-accent: var(--dusk-90); /* Highlighted card */
  --fg-default: var(--base-white); /* Primary text */
  --fg-body: var(--dusk-10); /* Body text */
  --fg-muted: var(--dusk-30); /* Secondary / muted text */
  --fg-brand: var(--yellow); /* Brand accent text */
  --border: var(--dusk); /* Default border */
  --stroke-divider: var(--dusk-50); /* Divider lines */

  /* ── Memory Type Colors ── */
  --color-semantic: #80dbff; /* Sky Blue -- semantic memories */
  --color-episodic: #dcff1e; /* Yellow/Volt -- episodic memories */
  --color-message: var(--dusk-50); /* Dusk 50 -- message memories */

  /* ── Yellow / Volt Scale (accents on dark) ── */
  --yellow-06: #d0f41d;
  --yellow-08: #a9ca03;
  --yellow-50: #f1ffa5;

  /* ── Sky Blue Scale ── */
  --sky-blue: #80dbff;
  --sky-blue-50: #bfedff;
  --sky-blue-09: #0477a5;

  /* ── Spacing (Redis spacing tokens) ── */
  --space-xs: 1rem; /* 16px */
  --space-sm: 1.5rem; /* 24px */
  --space-md: 2.5rem; /* 40px */
  --space-rg: 3rem; /* 48px */
  --space-lg: 4.5rem; /* 72px */
  --space-xl: 6rem; /* 96px */

  /* Additional fine-grained spacing for component internals */
  --space-2xs: 0.25rem; /* 4px */
  --space-3xs: 0.5rem; /* 8px */

  /* ── Buttons (Redis dark theme specs) ── */
  --btn-primary-bg: var(--hyper-10);
  --btn-primary-border: var(--hyper-05);
  --btn-primary-text: var(--base-white);
  --btn-primary-hover-bg: var(--hyper-09);
  --btn-primary-hover-border: var(--hyper-07);
  --btn-secondary-bg: var(--dusk);
  --btn-secondary-border: var(--dusk-90);
  --btn-secondary-text: var(--base-white);
  --btn-secondary-hover-bg: var(--dusk-90);
  --btn-font-size: 0.875rem;
  --btn-font-weight: 500;
  --btn-border-radius-pill: 200px;
  --btn-border-radius-rounded: 5px;
  --btn-padding-sm: 0.5rem 0.75rem;
  --btn-padding-md: 0.625rem 1.5rem;

  /* ── Borders & Radii ── */
  --border-radius: 8px;
  --border-radius-sm: 4px;
  --border-radius-lg: 12px;
  --border-radius-pill: 200px;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

  /* ── Transitions ── */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms ease;

  /* ── Layout ── */
  --toolbar-height: 64px;
  --footer-height: 40px;
  --panel-gap: var(--space-xs);
  --transcript-panel-width: 55%;
  --memory-panel-width: 45%;
}
```

### Redis Font Loading

Load Space Grotesk and Space Mono via Google Fonts in `layout.tsx`:

```tsx
import { Space_Grotesk, Space_Mono } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--primary-font",
});
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--secondary-font",
});
```

### Redis Logo

Use `Redis_Logo_White_RGB.svg` (white variant for dark backgrounds) from the redis-visual-guide assets. Copy to `public/redis-logo.svg`.

### Visual Identity

- **Dark theme (`--midnight` background)** -- official Redis dark theme, appropriate for stage demos
- **Redis Red (`--primary-color`)** as primary accent -- overridable per dataset via `config.branding.accentColor`
- **Sky Blue / Yellow-Volt / Dusk** for memory type coding -- uses Redis palette instead of generic Material colors
- **Space Mono** for timestamps, memory IDs, technical data -- Redis secondary font
- **Space Grotesk** for all body text and headings -- Redis primary font
- **Card-based layout** on `--dusk-09` surfaces with `--dusk` borders
- **Subtle animations** -- fade-in for new transcript chunks, count-up for metrics

---

## Animations & Transitions

### Transcript Chunk Entrance

```css
@keyframes chunk-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.transcript-chunk--new {
  animation: chunk-enter var(--transition-normal) ease-out;
}
```

### Memory Card Entrance (when extraction completes)

```css
@keyframes card-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.memory-card--new {
  animation: card-enter var(--transition-slow) ease-out;
}
```

### Metric Value Count-Up

When a metric value changes, briefly highlight it:

```css
.metric-value--changed {
  color: var(--accent-secondary);
  transition: color var(--transition-slow);
}
```

---

## State Flow Diagram

Shows how DemoPage, TranscriptPanel, and MemoryExplorerPanel interact. The only bridge state is `sessionId`.

```
Page loads (DemoPage)
        │
        │  useDatasetConfig() → POST /api/getDataset {}
        │  (fetch dataset.config.json -- all labels, namespace,
        │   userId)
        ▼
  [CONFIG_LOADING]  (full-page spinner)
        │
        │  Config loaded -- render TranscriptPanel + MemoryExplorerPanel
        │
        ├─────────────────────────────────────┐
        ▼                                     ▼
  TranscriptPanel                     MemoryExplorerPanel
  (owns playback, status, metrics)    (owns memory polling, exploration)
        │                                     │
        │  POST /api/listTranscripts          │  sessionId = null
        │  POST /api/listWorkingMemorySessions│  (shows empty states)
        │  (fetch transcript + session lists) │
        ▼                                     │
User selects transcript                       │
   ─OR─ User loads existing session ──────────┼──── (shortcut: see below)
        │                                     │
        │                                     │
        │  POST /api/getTranscript            │
        │  { transcriptId }                   │
        ▼                                     │
     clicks Play                              │
        │                                     │
        │  POST /api/createWorkingMemory      │
        │  { transcriptId }                   │
        │  → receives sessionId               │
        │                                     │
        ├── onSessionCreated(sessionId) ──────► sessionId prop becomes non-null
        │                                     │
        ▼                                     ▼
    [PLAYING] (internal)               MemoryExplorerPanel detects
        │                              sessionId change, starts:
        │  setInterval (client-side)   - polling working memory (3s)
        │  ┌──────────────────────┐    - polling LT memories (5s)
        │  │ Each tick:            │     (LT returns 0 initially)
        │  │  1. Display chunk[i]  │
        │  │  2. Fire-and-forget   │
        │  │     POST /api/append  │
        │  │  3. Track metrics     │
        │  │  4. i++               │
        │  └──────────────────────┘
        │
        │  Last chunk: .append { isLastChunk: true }
        │  (triggers background extraction in backend)
        ▼
    [COMPLETED] (internal)
        │                              Meanwhile, MemoryExplorerPanel's LT
        │  TranscriptPanel shows       polling detects memories appearing:
        │  "Playback complete" in      - explorerStatus → "exploring"
        │  its status chip.            - stops frequent LT polling
        │  No signal sent to parent.   - data available for all tabs
        │
        │                              User explores all tabs:
        │                              - WorkingMemoryTab (polled data)
        │                              - LongTermMemoryTab (polled data)
        │                              - SummaryViewsTab:
        │                                  POST /api/computeSummary
        │                                  POST /api/getComputedSummaries
        │                              - RedisMetricsTab (memory lifecycle stats)
        │
        │  clicks "Clear All Memories & Restart"
        │  (ConfirmDialog → POST /api/resetLifecycle)
        │
        ├── onReset() ─────────────────► DemoPage clears sessionId
        │                                 │
        │                                 └─► MemoryExplorerPanel receives
        │                                     sessionId=null, stops all
        ▼                                     polling, clears internal state
     [IDLE]  (clean slate, ready for another demo run)
```

**Load Existing Session (shortcut path):**

```
User selects session from "Load Existing Session" dropdown
        │
        │  TranscriptPanel.handleLoadSession:
        │  1. Parse transcriptId from sessionId (regex: /^playback-(.+)-(\d{13,})$/)
        │  2. playback.reset() (clean slate)
        │  3. setSessionId(selectedSessionId)
        │  4. onSessionCreated(selectedSessionId) ──────► MemoryExplorerPanel starts
        │  5. POST /api/getTranscript { transcriptId }     polling (session already has
        │  6. On response: setTranscriptData(data)          data, so all tabs populate
        │  7. playback.loadAll() -- displays all chunks     immediately)
        │     instantly, sets status = COMPLETED
        ▼
    [COMPLETED] -- whole page looks like post-playback
                   (transcript feed shows all chunks,
                    MemoryExplorerPanel shows all memory data)
```

Note: the "Clear All" button is in TranscriptPanel's toolbar and is accessible from **any** state (idle, playing, completed). If clicked during playback, TranscriptPanel stops the interval first, then proceeds with the reset API call, then emits `onReset()`. After reset, the sessions list is cleared (since all sessions are deleted by the backend).

---

## Responsive Considerations

Desktop only. This is a stage/booth demo running on a large screen (1920x1080 or higher). No tablet or mobile layout needed. Fixed side-by-side panels (55/45 split).

---

## Implementation Priority (Build Order)

| Phase | What                                                                                                                                                                                  | Layer      | Why                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| 1     | `layout.tsx`, `globals.css`, `variables.css`, `app.constants.ts`                                                                                                                      | Foundation | Design system, CSS custom properties, playback constants             |
| 2     | `api.service.ts` + all types (`dataset-config.types.ts`, `transcript.types.ts`, `memory.types.ts`, `api.types.ts`)                                                                    | Shared     | API connectivity + type definitions used by both business components |
| 3     | `components/core/*` -- StatusDot, EmptyState, MemoryTypeBadge, ConfirmDialog, SectionCard + `core.css`                                                                                | Core       | Generic UI primitives, no domain logic                               |
| 4     | `hooks/use-dataset-config.ts` + loading/error states in `page.tsx`                                                                                                                    | Page       | Config must load before anything renders                             |
| 5     | **TranscriptPanel shell** -- `transcript-panel.component.tsx` + `toolbar.component.tsx` (transcript picker, play/stop/reset, speed, status chip, health dot) + `transcript-panel.css` | Business   | Left panel structure with all controls                               |
| 6     | **TranscriptPanel internals** -- `transcript-chunk.component.tsx` + `transcript-feed.component.tsx` + `playback-controls.component.tsx`                                               | Business   | Transcript display sub-components                                    |
| 7     | **TranscriptPanel hooks** -- `use-transcript-playback.ts` (interval + POST /append) + `use-backend-health.ts`                                                                         | Business   | Core playback loop and health check                                  |
| 8     | **MemoryExplorerPanel shell** -- `memory-explorer-panel.component.tsx` (tab container, tab labels from config) + `memory-explorer-panel.css`                                          | Business   | Right panel structure with tabs                                      |
| 9     | **WorkingMemoryTab** -- `working-memory-tab.component.tsx` + `working-memory-summary.component.tsx` + `use-working-memory.ts`                                                         | Business   | Working memory display + polling hook                                |
| 10    | **LongTermMemoryTab** -- `long-term-memory-tab.component.tsx` + `memory-card.component.tsx` + `use-long-term-memory.ts`                                                               | Business   | Extracted memories display                                           |
| 11    | **SummaryViewsTab** -- `summary-views-tab.component.tsx` + `computed-summary-card.component.tsx` + `use-summary-views.ts`                                                             | Business   | Summary views + computed summaries                                   |
| 12    | **RedisMetricsTab** -- `redis-metrics-tab.component.tsx`                                                                                                                              | Business   | Under the hood stats (memory lifecycle)                              |
| 13    | **Integration** -- wire up DemoPage with TranscriptPanel callbacks (`onSessionCreated`, `onReset`) and MemoryExplorerPanel props (`sessionId`)                                        | Page       | Bridge sessionId between business components                         |
| 14    | **Polish** -- animations, empty states, error states, loading states, responsive layout, demo readiness                                                                               | All        | Demo-grade visual quality                                            |

---

## Demo Presenter Script (What to Click)

1. **Open the app** -- dark themed Memory Explorer loads (title from `config.branding.title`), shows config-driven idle status
2. **Select transcript** -- dropdown shows available transcripts for the active dataset. Alternatively, if existing sessions are available from a previous run, the "Load Existing Session" dropdown appears -- selecting one instantly loads the full transcript + all memory data (no playback needed).
3. **Optionally set speed** -- options from `config.playbackDefaults.speeds`
4. **Click Play** -- transcript chunks start appearing on the left, one at a time, with speaker labels from `config.roles`
5. **Narrate** -- "Each transcript chunk is being written to Redis working memory in real-time. Watch the token count grow."
6. **Click Working Memory tab** -- show session info, growing token count, context window gauge
7. **Wait for context summary** -- "The agent memory server just auto-summarized the conversation to fit the context window"
8. **Playback completes** -- TranscriptPanel shows "Playback complete". MemoryExplorerPanel detects LT memories starting to appear via its own polling (explorer status transitions from "observing" to "extracting" to "exploring" automatically).
9. **Memories appear** -- MemoryExplorerPanel's LT polling detects results, tabs become active
10. **Click Long-Term Memory tab** -- memories appear grouped by type (section labels from `config.memoryLabels.longTermMemory`)
11. **Narrate** -- "These facts were auto-extracted: Maya's retirement, James's bond fund preference, the REIT rebalance decision. Each tagged with topics and entities."
12. **Click Summary Views tab** -- multiple pre-seeded views are visible. If the current session doesn't have a computed summary yet, a "Compute Summary" button appears. Click it to trigger LLM summarization. After computing, a per-card "Recompute" button stays visible on each partition. Multiple sessions' recaps are shown side by side.
13. **Narrate** -- "This summary condenses all extracted memories into one coherent narrative. Computed by Redis in under 2 seconds."
14. **Click Redis tab** -- "8 memories extracted, 1 summary computed, 12 working memory polls. Average latency: 42 milliseconds. All powered by Redis."
15. **Click "Clear All Memories & Restart"** -- confirm dialog, everything resets, clean slate for next demo or next dataset

---

## Key Demo Moments (What Must Look Great)

| Moment                         | Component (Business > Sub)                 | Visual Treatment                      |
| ------------------------------ | ------------------------------------------ | ------------------------------------- |
| Transcript chunks streaming in | TranscriptPanel > TranscriptFeed           | Smooth fade-up animation, auto-scroll |
| Context summary appearing      | MemoryExplorerPanel > WorkingMemorySummary | Highlighted card with subtle glow     |
| "Extracting..." status         | TranscriptPanel > Toolbar (status chip)    | Pulsing animation                     |
| Long-term memories populating  | MemoryExplorerPanel > LongTermMemoryTab    | Cards animate in one by one           |
| Summary generated              | MemoryExplorerPanel > ComputedSummaryCard  | Large card, prominent text            |
| Metrics dashboard              | MemoryExplorerPanel > RedisMetricsTab      | Clean grid, numbers count up          |

---

## Notes

### Component Architecture

- **Two-layer component model:** `core/` (generic UI primitives) and `business/` (domain-specific). Business components export only their main component -- sub-components, hooks, and styles are internal. This enforces encapsulation and prevents cross-component coupling.
- **MemoryExplorerPanel is fully portable.** It takes `userId`, `sessionId`, `namespace`, and `datasetConfig` as props. It owns all memory API calls, polling logic, and metrics tracking internally. When `sessionId` is non-null, it starts polling. When `sessionId` is `null`, it shows empty states. Zero knowledge of transcripts or playback. To integrate it in a chatbot page, just pass a `sessionId` (or `null` for cross-session exploration).
- **TranscriptPanel owns the entire transcript lifecycle** including the toolbar, transcript picker, playback controls, playback status, playback metrics, session creation, reset, and health check. It communicates with DemoPage through only two callbacks: `onSessionCreated` and `onReset`. Playback status and metrics never leave this component.
- **DemoPage is a thin orchestrator.** It loads the dataset config (only page-level hook) and bridges a single piece of state -- `sessionId` -- between the two business components. It has no domain logic of its own.

### Display & Config

- **Zero hardcoded display strings.** Every label, title, description, button text, speaker name, and status message is read from `datasetConfig` (fetched once from `POST /api/getDataset`). To support a new dataset, create a new `data/{dataset}/dataset.config.json` and set the backend's `ACTIVE_DATASET` env var. No frontend code changes needed.
- The `config.branding.accentColor` is applied as a CSS custom property override on mount (`document.documentElement.style.setProperty('--accent-primary', config.branding.accentColor)`), allowing per-dataset color theming.
- **Summary views are pre-seeded from the dataset config.** The backend creates all views defined in `config.memoryLabels.summaryViews.views` at startup. The frontend discovers them via `listSummaryViews` and renders them uniformly -- each with a compute/recompute button. No special "default view" concept. Custom views can also be created on-the-fly via the API for showing flexibility.

### API & Data

- **All backend calls are POST-only** with camelCase paths. No URL params, no query strings. All parameters in JSON body. Responses unwrapped from `{ data, error }` envelope by `api.service.ts`.
- **`userId` and `namespace` are never sent by the frontend** -- they are derived from the active dataset config on every backend request. The frontend reads them from `datasetConfig` for display purposes only.
- The "Clear All Memories & Restart" button (in TranscriptPanel's toolbar) calls `POST /api/resetLifecycle` which wipes all working memory sessions, long-term memories, and summary views within the active namespace. The backend re-creates all pre-seeded summary views. TranscriptPanel emits `onReset()`, DemoPage clears `sessionId`, MemoryExplorerPanel reacts to `sessionId=null` by stopping all polling and clearing its internal state.

### CSS Style

- **One CSS file per component.** Every `.component.tsx` gets a matching `.css` file. Each component imports only its own CSS. Parent components never import child CSS. See `css-code-style` skill for full rules.
- **Pure CSS with nesting.** CSS structure mirrors HTML structure. Each component has a unique parent class (`.transcript-chunk`, `.memory-card`) as its scope boundary. Nested selectors (`.timestamp`, `.speaker`) are scoped under the parent and never conflict across components.
- **CSS variables for everything configurable.** All colors, spacing, fonts, radii, shadows, and transitions reference CSS custom properties defined in `variables.css`. Zero hardcoded pixel values or hex colors in component CSS.
- **No Tailwind, no CSS-in-JS, no inline styles.** All styles live in CSS classes. The only exception is setting CSS custom property overrides via `style` for runtime config values (e.g., `--accent-primary` from `config.branding.accentColor`).

### Build & Deployment

- **Pure static export.** `next build` produces a static `out/` folder (HTML, CSS, JS). No Node.js server required at runtime.
- **Deployment options:** Copy `out/` to any static web server, or drop it into the backend's `public/` folder so `cau-api-server` serves it alongside the API. Or deploy to Vercel/S3/nginx independently.
- **All components are client components (`"use client"`)** since they rely on browser APIs (timers, user interaction). No server components, no API routes in the frontend.
- **`NEXT_PUBLIC_API_BASE_URL`** environment variable points to the backend (default `http://localhost:3001`). Set at build time since static export bakes env vars into the bundle.

### Code Style & Technical

- The frontend follows the project code style: arrow functions, consolidated exports, separate type imports, kebab-case files, PascalCase components, no emojis.
- MUI is used sparingly -- only for Tabs, Chip, Button, IconButton, LinearProgress, Select, Card, Dialog (for Clear All confirmation). All layout, typography, colors, and animations are pure CSS.
- No state management library needed. React state + hooks are sufficient. DemoPage has minimal state (config + 1 bridge variable: `sessionId`). Business components manage their own state internally.
- Metrics are tracked independently by each business component. TranscriptPanel tracks its own playback metrics (chunks sent, append latencies) and displays them in PlaybackControls. MemoryExplorerPanel tracks its own API metrics (working memory polls, LT searches, summary computations) and displays them in RedisMetricsTab. No metrics cross the component boundary.
- The fire-and-forget pattern in `useTranscriptPlayback` ensures smooth visual playback regardless of API latency. The Working Memory tab may lag 1-2 ticks behind the transcript display -- this is intentional and looks natural.
- Playback speed options come from `config.playbackDefaults.speeds` -- each entry has a `label` (e.g., "2x") and `intervalMs` (e.g., 1000). This means speed options can vary per dataset if needed.

### Portability Example: Chatbot Page

To reuse MemoryExplorerPanel on a future chatbot page that searches across sessions:

```tsx
<MemoryExplorerPanel
  userId="sarah-chen"
  namespace="wealth-advisor"
  sessionId={null}
  datasetConfig={config}
/>
```

No transcript, no playback, no toolbar, no playback status props. The panel shows all long-term memories across sessions, supports summary computation, and works independently. Pass a `sessionId` to scope it to one session, or `null` for cross-session exploration.

---

## Related Plans

- [Frontend Chatbot Plan](./dev-frontend-chatbot-plan.md) -- adds a CopilotKit-powered chatbot sidebar (floating overlay, purely additive, zero changes to existing components)
- [Backend Chatbot Plan](./dev-backend-chatbot-plan.md) -- LangGraph agent with memory tools powering the chatbot
- [Live Suggestions Plan](./dev-live-suggestions-brainstorm.md) -- push-based AI copilot that surfaces real-time suggestions during transcript playback (new AI Copilot tab + persistent banner)

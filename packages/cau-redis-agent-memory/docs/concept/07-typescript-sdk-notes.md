# TypeScript SDK — Notes

## Package

```
npm install agent-memory-client
```

Version: 0.3.1+ | License: MIT | Dependencies: `ulid`

## Decision: SDK vs Raw REST API

The official TypeScript SDK (`agent-memory-client`) is a thin, well-typed wrapper around the
REST API. It provides:

- Type-safe filter classes (`UserId`, `Topics`, `CreatedAt`, etc.)
- Auto-pagination (`searchAllLongTermMemories`)
- Bulk operations with rate limiting
- Validation helpers
- Error hierarchy (`MemoryClientError`, `MemoryNotFoundError`, `MemoryServerError`)

**Our wrapper (`cau-redis-agent-memory`) should use the SDK** rather than raw REST calls because:
1. The SDK already handles serialization, error mapping, and pagination
2. Filter classes provide type safety that would be tedious to replicate
3. It's maintained by Redis Inc. and follows semver

We wrap the SDK (not replace it) to add our own conventions, logging, config management,
and opinionated higher-level methods.

## Client Configuration

```typescript
import { MemoryAPIClient } from "agent-memory-client";

const client = new MemoryAPIClient({
  baseUrl: "http://localhost:8000",
  timeout: 30000,
  apiKey: "your-api-key",          // Optional
  bearerToken: "your-token",       // Optional
  defaultNamespace: "my-app",      // Optional
});
```

## Key SDK Methods

### Working Memory

| Method                       | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `getOrCreateWorkingMemory()` | Get or create a session                       |
| `getWorkingMemory()`         | Get working memory for a session              |
| `putWorkingMemory()`         | Set/replace working memory                    |
| `deleteWorkingMemory()`      | Delete a session                              |
| `listSessions()`             | List all sessions with pagination             |

### Long-Term Memory

| Method                          | Description                                   |
| ------------------------------- | --------------------------------------------- |
| `createLongTermMemory()`        | Create memories                               |
| `searchLongTermMemory()`        | Search with filters                           |
| `searchAllLongTermMemories()`   | Auto-paginating async iterator                |
| `getLongTermMemory()`           | Get by ID                                     |
| `editLongTermMemory()`          | Partial update                                |
| `deleteLongTermMemories()`      | Delete by IDs                                 |
| `forgetLongTermMemories()`      | Apply forget policy                           |
| `bulkCreateLongTermMemories()`  | Batch create with rate limiting               |

### Memory Prompt

| Method           | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `memoryPrompt()` | Context hydration — returns LLM-ready messages           |

### Summary Views

| Method                         | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `createSummaryView()`          | Create a new view                                |
| `listSummaryViews()`           | List all views                                   |
| `deleteSummaryView()`          | Delete a view                                    |
| `runSummaryViewPartition()`    | Compute summary for one partition (sync)         |
| `runSummaryView()`             | Trigger full recompute (async, returns Task)     |
| `listSummaryViewPartitions()`  | List materialized partition summaries             |
| `getTask()`                    | Get background task status                       |

### Validation

| Method                   | Description                       |
| ------------------------ | --------------------------------- |
| `validateMemoryRecord()` | Validate a memory record          |
| `validateSearchFilters()`| Validate search filter params     |

## Filter Classes

```typescript
import { SessionId, Namespace, UserId, Topics, Entities, CreatedAt, LastAccessed, MemoryType } from "agent-memory-client";

// Equality
new UserId({ eq: "alice" });

// Multiple values
new SessionId({ in_: ["session-1", "session-2"] });

// Negation
new SessionId({ not_eq: "session-1", not_in: ["session-2"] });

// Array matching
new Topics({ any: ["topic1", "topic2"] });   // Match any
new Topics({ all: ["topic1", "topic2"] });   // Match all
new Topics({ none: ["topic3"] });            // Exclude

// Date ranges
new CreatedAt({ gte: new Date("2024-01-01"), lte: new Date("2024-12-31") });
```

## Error Hierarchy

```
MemoryClientError (base)
├── MemoryValidationError  (400 — invalid input)
├── MemoryNotFoundError    (404 — memory not found)
└── MemoryServerError      (5xx — server error, has statusCode)
```

## Type Exports

```typescript
import type {
  MemoryClientConfig,
  SearchOptions,
  WorkingMemory,
  WorkingMemoryResponse,
  MemoryMessage,
  MemoryRecord,
  MemoryRecordResults,
  ForgetPolicy,
  ForgetResponse,
  SummaryView,
  CreateSummaryViewRequest,
  SummaryViewPartitionResult,
  Task,
  TaskStatus,
} from "agent-memory-client";
```

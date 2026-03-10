# Memory Lifecycle Management

## Lifecycle Stages

Memories flow through these stages (bottom-up):

```
6. Compaction    — Background processes optimize storage, merge duplicates
       ↑
5. Forgetting    — Age/inactivity-based deletion by server background processes
       ↑
4. Aging         — Memories accumulate age and inactivity metrics
       ↑
3. Access        — Memories are tracked for access patterns and recency
       ↑
2. Promotion     — Working memories auto-promoted to long-term storage
       ↑
1. Creation      — Memories created in working memory or directly as long-term
```

## Memory Creation Patterns

### Pattern A: Automatic Background Extraction

The server's LLM analyzes conversation messages and auto-extracts important facts. Zero extra
API calls required from the application. Happens when messages are stored in working memory.

### Pattern B: LLM-Optimized Batch Storage (Recommended)

The LLM pre-identifies important information and batches it with working memory updates:

```json
PUT /v1/working-memory/session_123
{
  "messages": [...conversation...],
  "memories": [
    {
      "text": "User prefers Python over R for data analysis",
      "memory_type": "semantic",
      "topics": ["preferences", "programming"],
      "entities": ["Python", "R"]
    }
  ]
}
```

Single API call stores both conversation and memories. This is the **recommended pattern** for
most applications.

### Pattern C: Direct Long-Term Memory API

For immediate storage without working memory:

```json
POST /v1/long-term-memory/
{
  "memories": [
    {
      "text": "User completed Python certification",
      "memory_type": "episodic",
      "event_date": "2024-01-15T10:00:00Z",
      "topics": ["education"],
      "user_id": "alice"
    }
  ]
}
```

## Memory Forgetting

### How It Works

Forgetting is an **automatic server-side background process** using Docket (Redis-based task
scheduler). It evaluates and deletes memories based on configured policies.

### Policies

| Policy                 | Config Variable                  | Description                                       |
| ---------------------- | -------------------------------- | ------------------------------------------------- |
| Age-based              | `FORGETTING_MAX_AGE_DAYS`        | Delete memories older than N days                 |
| Inactivity-based       | `FORGETTING_MAX_INACTIVE_DAYS`   | Delete memories not accessed within N days        |
| Combined               | Both above                       | Must be BOTH old AND inactive (with hard age cap) |
| Budget-based           | `FORGETTING_BUDGET_KEEP_TOP_N`   | Keep only top N most recently accessed memories   |

### Client-Side Forget API

The client can also trigger forgetting manually:

```json
POST /v1/long-term-memory/forget
{
  "policy": {
    "max_age_days": 90,
    "max_inactive_days": 30,
    "budget": 100,
    "memory_type_allowlist": ["episodic"]
  }
}
Query: ?dry_run=true&namespace=my-app
```

With `dry_run=true`, it previews what would be deleted without actually deleting.

## Memory Compaction

Background processes automatically:
- Identify hash-based duplicates
- Find semantically similar memories via vector similarity
- Merge related memories using LLM
- Remove obsolete duplicates
- Optimize search indexes

Frequency controlled by `COMPACTION_EVERY_MINUTES` (default: 10 minutes).

## Memory Editing

Long-term memories can be edited via `PATCH /v1/long-term-memory/{memory_id}`.

When text changes, the system automatically:
1. Regenerates vector embeddings
2. Re-indexes the memory for search
3. Recalculates content hash
4. Updates `updated_at` and `last_accessed` timestamps

### Editable Fields

- `text` — the memory content (triggers embedding regeneration)
- `topics` — topic tags
- `entities` — named entities
- `memory_type` — semantic / episodic / message
- `event_date` — for episodic memories
- `namespace`, `user_id`, `session_id` — organization fields

### Read-Only Fields (auto-managed)

- `id`, `created_at`, `persisted_at`, `updated_at`, `last_accessed`, `memory_hash`

## Pinning

Set `pinned: true` on a memory to exempt it from automatic forgetting. Pinned memories are
also excluded when specifying `pinned_ids` in forget requests.

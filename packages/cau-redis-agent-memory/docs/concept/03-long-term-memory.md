# Long-Term Memory — Deep Dive

## Purpose

Long-term memory is the **persistent, cross-session knowledge base**. It stores facts,
preferences, and experiences that the agent learns at runtime and needs to recall across any
future session. It's backed by Redis with vector indexing for semantic search.

## Characteristics

| Feature         | Details                                              |
| --------------- | ---------------------------------------------------- |
| Scope           | Cross-session, persistent                            |
| Lifespan        | Permanent until deleted (by API or forgetting policy) |
| Storage         | Redis with vector indexing                           |
| Search          | Semantic vector search + metadata filtering          |
| Deduplication   | Hash-based + semantic (LLM-powered merging)          |
| Compaction      | Background merge of related memories                 |

## Memory Types

### 1. Semantic Memory — Facts & Preferences

```json
{
  "text": "User prefers dark mode interfaces",
  "memory_type": "semantic",
  "topics": ["preferences", "ui"],
  "entities": ["dark mode"]
}
```

### 2. Episodic Memory — Events with Temporal Context

```json
{
  "text": "User visited Paris in March 2024",
  "memory_type": "episodic",
  "event_date": "2024-03-15T10:00:00Z",
  "topics": ["travel"],
  "entities": ["Paris"]
}
```

### 3. Message Memory — Conversation Records (Auto-Generated)

```json
{
  "text": "user: What's the weather like?",
  "memory_type": "message",
  "session_id": "chat_123"
}
```

## Memory Record Schema

| Field                       | Type             | Description                                                    |
| --------------------------- | ---------------- | -------------------------------------------------------------- |
| `id`                        | string (ULID)    | Unique identifier                                              |
| `text`                      | string           | The memory content                                             |
| `memory_type`               | enum             | `semantic`, `episodic`, `message`                              |
| `topics`                    | string[]         | Topic tags for filtering                                       |
| `entities`                  | string[]         | Named entities mentioned                                       |
| `user_id`                   | string?          | Owner user                                                     |
| `session_id`                | string?          | Originating session                                            |
| `namespace`                 | string?          | Logical grouping                                               |
| `event_date`                | string?          | For episodic memories (ISO 8601)                               |
| `created_at`                | string           | When created                                                   |
| `updated_at`                | string           | When last modified                                             |
| `last_accessed`             | string           | When last retrieved                                            |
| `persisted_at`              | string?          | When promoted from working memory                              |
| `pinned`                    | boolean          | If true, exempt from auto-forgetting                           |
| `access_count`              | integer          | How many times retrieved                                       |
| `memory_hash`               | string?          | Content hash for deduplication                                 |
| `extracted_from`            | string[]?        | Message IDs this was extracted from                            |
| `extraction_strategy`       | string?          | Strategy used during promotion                                 |
| `dist`                      | number?          | Vector distance (in search results only, lower = more similar) |

## Search Capabilities

### Semantic Vector Search

Search by meaning, not just keywords. The text is embedded and compared via vector similarity.

### Filter System

All filters support flexible matching:

#### Tag Filters (session_id, namespace, user_id, topics, entities, memory_type)

```json
{ "eq": "value" }
{ "ne": "value" }
{ "any": ["a", "b"] }
{ "all": ["a", "b"] }
```

#### Numeric Filters (created_at, last_accessed, event_date) — Unix timestamps

```json
{ "gt": 1704067200 }
{ "lt": 1704153600 }
{ "gte": 1704067200 }
{ "lte": 1704153600 }
{ "between": [1704067200, 1704153600] }
```

### Search Request Example

```json
{
  "text": "user preferences for notifications",
  "limit": 10,
  "offset": 0,
  "namespace": { "eq": "production" },
  "user_id": { "eq": "alice" },
  "topics": { "any": ["preferences", "settings"] },
  "memory_type": { "eq": "semantic" },
  "created_at": { "gte": 1704067200 },
  "recency_boost": true,
  "distance_threshold": 0.3
}
```

### Recency Boost

Time-aware re-ranking that surfaces recently accessed/created memories. Configurable weights:
- `recency_semantic_weight` — weight for semantic similarity
- `recency_recency_weight` — weight for recency score
- `recency_freshness_weight` — weight for freshness
- `recency_novelty_weight` — weight for novelty (age)
- `recency_half_life_last_access_days` — half-life for last_accessed decay
- `recency_half_life_created_days` — half-life for created_at decay

## Deduplication

### Hash-Based

Identical text content is automatically deduplicated. The most recent version with complete
metadata is preserved.

### Semantic

Uses vector similarity to identify semantically similar memories, then uses LLM-powered merging
to combine related memories into a single enriched record.

## Memory Creation Paths

### 1. Automatic Promotion from Working Memory

Memories in `working_memory.memories[]` with `persisted_at=null` are auto-promoted.

### 2. Background Extraction from Conversations

The server's LLM analyzes messages and creates long-term memories automatically.

### 3. Direct API Creation (Eager)

Call `POST /v1/long-term-memory/` to create memories immediately.

## REST API Endpoints

| Method   | Endpoint                                | Description                               |
| -------- | --------------------------------------- | ----------------------------------------- |
| `POST`   | `/v1/long-term-memory/`                 | Create long-term memories                 |
| `POST`   | `/v1/long-term-memory/search`           | Semantic search with filters              |
| `GET`    | `/v1/long-term-memory/{memory_id}`      | Get a specific memory by ID               |
| `PATCH`  | `/v1/long-term-memory/{memory_id}`      | Edit/update a memory                      |
| `DELETE` | `/v1/long-term-memory`                  | Delete memories by IDs                    |
| `POST`   | `/v1/long-term-memory/forget`           | Run forgetting pass with policy           |

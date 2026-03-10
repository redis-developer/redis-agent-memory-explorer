# Working Memory — Deep Dive

## Purpose

Working memory is the **session-scoped conversation store**. It holds the active chat history,
structured memories pending promotion, and arbitrary session data. Think of it as the agent's
"short-term memory" for the current conversation.

## Data Structure

```json
{
  "session_id": "chat_123",
  "messages": [
    { "role": "user", "content": "I'm planning a trip to Italy", "id": "ulid", "created_at": "..." },
    { "role": "assistant", "content": "That sounds exciting!", "id": "ulid", "created_at": "..." }
  ],
  "context": "Summary of older messages if auto-summarization has occurred...",
  "memories": [
    {
      "text": "User is planning a trip to Italy",
      "id": "trip_planning_italy",
      "memory_type": "semantic",
      "topics": ["travel"],
      "entities": ["Italy"]
    }
  ],
  "data": {
    "destination": "Italy",
    "budget": 2000
  },
  "user_id": "alice",
  "namespace": "my-app",
  "ttl_seconds": null,
  "tokens": 1234,
  "long_term_memory_strategy": { "strategy": "discrete", "config": {} }
}
```

### Field Breakdown

| Field                         | Purpose                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `messages`                    | Chat history (role/content pairs with optional id and created_at)       |
| `context`                     | Summary of older messages (populated by auto-summarization)             |
| `memories`                    | Structured records that get **promoted to long-term storage**           |
| `data`                        | Arbitrary JSON — session-only, NOT searchable, NOT persisted beyond TTL |
| `user_id`                     | Owner of the session                                                    |
| `namespace`                   | Logical grouping                                                        |
| `ttl_seconds`                 | Optional expiration (default: persistent)                               |
| `long_term_memory_strategy`   | Extraction strategy for background memory creation                      |

### Key Distinction: `data` vs `memories`

- **`data`** = session-only scratch pad. Vanishes when session expires. Not searchable.
- **`memories`** = structured facts promoted to long-term storage. Become searchable across all sessions.

## Automatic Summarization

When messages exceed a threshold (default 70% of the model's context window), the server:

1. Summarizes older messages into a compact summary
2. Stores the summary in the `context` field
3. Removes the summarized messages to free space
4. Keeps recent messages intact

This happens **transparently** on every `PUT /v1/working-memory/{session_id}` call when a
`model_name` or `context_window_max` query parameter is provided.

### Monitoring Summarization

The response includes:
- `context_percentage_total_used` — how much of the context window is used (0-100%)
- `context_percentage_until_summarization` — how close to triggering (0-100%, triggers at 100%)

These fields are `null` unless `model_name` or `context_window_max` is provided.

## Memory Promotion Flow

```
Working Memory                    Long-Term Memory
┌──────────────────┐
│ memories: [       │
│   { text: "...",  │─────► Server identifies persisted_at=null
│     persisted_at: │       ├─ Generates vector embeddings
│     null }        │       ├─ Indexes in long-term storage
│ ]                 │       └─ Updates persisted_at timestamp
└──────────────────┘
```

Any `MemoryRecord` in the `memories[]` array with `persisted_at=null` will be automatically
promoted to long-term storage by the server.

## Background Extraction Strategies

When `long_term_memory_strategy` is set, the server uses an LLM to auto-extract memories from
conversation messages. Four strategies available:

| Strategy      | What It Does                                    | Best For                    |
| ------------- | ----------------------------------------------- | --------------------------- |
| `discrete`    | Extracts individual facts and preferences       | General chat (default)      |
| `summary`     | Creates conversation summaries                  | Meeting notes, long chats   |
| `preferences` | Focuses on user preferences and characteristics | Personalization             |
| `custom`      | Domain-specific extraction via custom prompt     | Technical/legal/medical     |

### Custom Strategy Example

```json
{
  "long_term_memory_strategy": {
    "strategy": "custom",
    "config": {
      "custom_prompt": "Extract technical decisions from: {message}\nFocus on: technology choices, architecture decisions.\nCurrent datetime: {current_datetime}"
    }
  }
}
```

## TTL and Persistence

- **Default**: Persistent (no expiration)
- **With TTL**: Set `ttl_seconds` to auto-expire after N seconds
- **Reconstruction**: If `INDEX_ALL_MESSAGES_IN_LONG_TERM_MEMORY=true`, expired sessions can be reconstructed from long-term memory

## REST API Endpoints

| Method   | Endpoint                             | Description                                |
| -------- | ------------------------------------ | ------------------------------------------ |
| `GET`    | `/v1/working-memory/`                | List sessions (with pagination)            |
| `GET`    | `/v1/working-memory/{session_id}`    | Get working memory for a session           |
| `PUT`    | `/v1/working-memory/{session_id}`    | Set/replace working memory for a session   |
| `DELETE` | `/v1/working-memory/{session_id}`    | Delete working memory for a session        |

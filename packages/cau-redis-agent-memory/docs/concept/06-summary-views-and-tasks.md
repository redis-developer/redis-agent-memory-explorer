# Summary Views & Background Tasks

## Summary Views

Summary Views create **aggregated summaries** over partitions of memories. They allow you to
generate and maintain dynamic summaries grouped by fields like `user_id`, `topics`, `namespace`,
etc.

### Use Cases

- **Per-user summaries**: "What do we know about Alice?"
- **Per-topic summaries**: "Summarize all travel-related memories"
- **Per-user-per-topic**: "What are Alice's food preferences?"
- **Time-windowed**: "What happened in the last 30 days?"

### How It Works

1. **Create a view**: Define what to summarize and how to partition
2. **Run partitions**: Compute summaries for specific groups (sync or async)
3. **Read results**: Retrieve materialized partition summaries
4. **Continuous mode**: Optional background auto-refresh

### Summary View Configuration

```json
{
  "name": "User Topic Summaries",
  "source": "long_term",
  "group_by": ["user_id", "topics"],
  "filters": { "memory_type": { "eq": "semantic" } },
  "time_window_days": 30,
  "continuous": true,
  "prompt": "Summarize these memories concisely:",
  "model_name": "gpt-4o-mini"
}
```

| Field               | Type       | Description                                                          |
| ------------------- | ---------- | -------------------------------------------------------------------- |
| `name`              | string?    | Human-readable name                                                  |
| `source`            | enum       | `long_term` or `working_memory` (currently only long_term supported) |
| `group_by`          | string[]   | Fields to partition by (e.g., `["user_id"]`, `["user_id", "topics"]`) |
| `filters`           | object     | Static filters applied to every run                                  |
| `time_window_days`  | integer?   | Only include memories from last N days                               |
| `continuous`        | boolean    | If true, background workers auto-refresh                             |
| `prompt`            | string?    | Custom summarization instructions                                    |
| `model_name`        | string?    | Model override for summarization                                     |

### Partition Result

```json
{
  "view_id": "view-abc",
  "group": { "user_id": "alice", "topics": "travel" },
  "summary": "Alice is planning a trip to Italy next month with a budget of $2000...",
  "memory_count": 12,
  "computed_at": "2024-01-16T10:30:00Z"
}
```

### REST API Endpoints

| Method | Endpoint                                        | Description                                     |
| ------ | ----------------------------------------------- | ----------------------------------------------- |
| `GET`  | `/v1/summary-views`                             | List all summary views                          |
| `POST` | `/v1/summary-views`                             | Create a new summary view                       |
| `GET`  | `/v1/summary-views/{view_id}`                   | Get a specific view configuration               |
| `DELETE` | `/v1/summary-views/{view_id}`                 | Delete a summary view                           |
| `POST` | `/v1/summary-views/{view_id}/partitions/run`    | Sync: compute summary for one partition         |
| `GET`  | `/v1/summary-views/{view_id}/partitions`        | List materialized partition summaries            |
| `POST` | `/v1/summary-views/{view_id}/run`               | Async: trigger full recompute (returns a Task)  |

---

## Background Tasks

Long-running operations (like full summary view recomputes) return a `Task` object that can be
polled for status.

### Task Model

```json
{
  "id": "task-xyz",
  "type": "summary_view_full_run",
  "status": "running",
  "view_id": "view-abc",
  "created_at": "2024-01-16T10:30:00Z",
  "started_at": "2024-01-16T10:30:01Z",
  "completed_at": null,
  "error_message": null
}
```

### Task Statuses

- `pending` — queued but not started
- `running` — currently executing
- `completed` — finished successfully
- `failed` — finished with error (check `error_message`)

### REST API

| Method | Endpoint                  | Description                |
| ------ | ------------------------- | -------------------------- |
| `GET`  | `/v1/tasks/{task_id}`     | Get task status            |

### Polling Pattern

```
1. POST /v1/summary-views/{view_id}/run  →  { "id": "task-123", "status": "pending" }
2. GET  /v1/tasks/task-123               →  { "status": "running" }
3. GET  /v1/tasks/task-123               →  { "status": "running" }  (poll with delay)
4. GET  /v1/tasks/task-123               →  { "status": "completed" }
```

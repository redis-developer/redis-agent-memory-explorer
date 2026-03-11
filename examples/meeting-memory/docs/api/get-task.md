# POST /api/getTask

Polls async task status (used for long-running operations like full view recomputes).

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `taskId` | string | yes | Task ID returned by async operations |

```json
{ "taskId": "task-abc123" }
```

## Output

```json
{
  "data": {
    "id": "task-abc123",
    "type": "run_summary_view",
    "status": "completed",
    "viewId": "01KKEW9QGYHP3A9ABQG9NEA8B9",
    "createdAt": "2026-03-11T16:50:00.000Z",
    "startedAt": "2026-03-11T16:50:01.000Z"
  },
  "error": null
}
```

Possible `status` values: `pending`, `running`, `completed`, `failed`.

## curl

```bash
curl -s -X POST http://localhost:3001/api/getTask \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"task-abc123"}'
```

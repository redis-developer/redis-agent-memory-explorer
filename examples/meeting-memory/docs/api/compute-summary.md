# POST /api/computeSummary

Computes (or recomputes) the LLM-generated summary for a specific group within a view. This is **not automatic** -- the frontend must explicitly trigger it after long-term memories have been extracted. The Agent Memory Server gathers matching memories, sends them to the LLM, and returns the generated narrative.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `viewId` | string | yes | Summary view ID |
| `group` | object | yes | Group key matching the view's `groupBy` |

```json
{
  "viewId": "01KKEW9QGYHP3A9ABQG9NEA8B9",
  "group": { "user_id": "sarah-chen" }
}
```

## Output

```json
{
  "data": {
    "viewId": "01KKEW9QGYHP3A9ABQG9NEA8B9",
    "group": { "user_id": "sarah-chen" },
    "summary": "James Morrison is a moderate-risk HNW client targeting $3M by retirement in 2031...",
    "memoryCount": 8,
    "computedAt": "2026-03-11T16:50:00.000Z"
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/computeSummary \
  -H 'Content-Type: application/json' \
  -d '{"viewId":"01KKEW9QGYHP3A9ABQG9NEA8B9","group":{"user_id":"sarah-chen"}}'
```

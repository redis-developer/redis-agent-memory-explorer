# POST /api/getComputedSummaries

Reads all previously computed summaries for a view. Call this after `computeSummary` to display the generated text.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `viewId` | string | yes | Summary view ID |

```json
{ "viewId": "01KKEW9QGYHP3A9ABQG9NEA8B9" }
```

## Output (before any computation)

```json
{
  "data": { "summaries": [] },
  "error": null
}
```

## Output (after computation)

```json
{
  "data": {
    "summaries": [
      {
        "group": { "user_id": "sarah-chen" },
        "summary": "James Morrison is a moderate-risk HNW client targeting $3M by retirement in 2031...",
        "memoryCount": 8,
        "computedAt": "2026-03-11T16:50:00.000Z"
      }
    ]
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/getComputedSummaries \
  -H 'Content-Type: application/json' \
  -d '{"viewId":"01KKEW9QGYHP3A9ABQG9NEA8B9"}'
```

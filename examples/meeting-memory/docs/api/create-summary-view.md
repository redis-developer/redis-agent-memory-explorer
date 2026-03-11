# POST /api/createSummaryView

Creates a new summary view definition on demand. A summary view is a **recipe** that describes how to summarize long-term memories. Creating it does not produce any text -- use `computeSummary` after.

A default view is pre-created at startup. This endpoint is for creating additional on-the-fly views.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | no | Human-readable name |
| `source` | string | yes | `"long_term"` or `"working_memory"` |
| `groupBy` | string[] | no | Grouping fields (see below) |
| `timeWindowDays` | number | no | Time window for the summary |

Supported `groupBy` values: `user_id`, `session_id`, `namespace`. Other values (e.g. `topics`) are **not supported** and will return a validation error.

```json
{
  "name": "Session Summary",
  "source": "long_term",
  "groupBy": ["session_id"]
}
```

## Output

```json
{
  "data": {
    "viewId": "01KKEWFTCF41993WV0JK6T3FG9",
    "name": "Session Summary",
    "source": "long_term",
    "groupBy": ["session_id"],
    "createdAt": "2026-03-11T16:43:12.151Z"
  },
  "error": null
}
```

## Error (unsupported groupBy)

```json
{
  "data": null,
  "error": "Unsupported groupBy fields: topics. Supported: user_id, session_id, namespace"
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/createSummaryView \
  -H 'Content-Type: application/json' \
  -d '{"name":"Session Summary","source":"long_term","groupBy":["session_id"]}'
```

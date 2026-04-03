# POST /api/listWorkingMemorySessions

Lists all active working memory sessions.

## Input

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `limit` | number | no | 20 | Max results |
| `offset` | number | no | 0 | Pagination offset |

```json
{ "limit": 10 }
```

## Output

```json
{
  "data": {
    "sessions": [
      "playback-2026-02-26-google-meet-1773247345966"
    ],
    "total": 1
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/listWorkingMemorySessions \
  -H 'Content-Type: application/json' \
  -d '{"limit":10}'
```

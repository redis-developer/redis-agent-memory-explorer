# POST /api/searchLongTermMemoryBySession

Searches long-term memories scoped to a specific playback session. This is the primary way the frontend reads memories after a transcript completes.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | yes | The playback session ID |

```json
{ "sessionId": "playback-2026-02-26-google-meet-1773247345966" }
```

## Output

Same shape as `searchLongTermMemory`, scoped to the session.

```json
{
  "data": {
    "memories": [],
    "total": 0,
    "nextOffset": null
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/searchLongTermMemoryBySession \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"playback-2026-02-26-google-meet-1773247345966"}'
```

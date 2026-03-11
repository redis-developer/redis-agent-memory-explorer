# POST /api/deleteWorkingMemory

Deletes a working memory session.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | yes | Session ID |

```json
{ "sessionId": "playback-2026-02-26-google-meet-1773247345966" }
```

## Output

```json
{
  "data": { "status": "ok" },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/deleteWorkingMemory \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"playback-2026-02-26-google-meet-1773247345966"}'
```

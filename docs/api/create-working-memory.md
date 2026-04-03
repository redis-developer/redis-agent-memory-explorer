# POST /api/createWorkingMemory

Creates a new working memory session. Called once when transcript playback starts.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `transcriptId` | string | yes | Transcript to associate with the session |

```json
{ "transcriptId": "2026-02-26-google-meet" }
```

## Output

```json
{
  "data": {
    "sessionId": "playback-2026-02-26-google-meet-1773247345966",
    "created": false,
    "memory": {
      "sessionId": "playback-2026-02-26-google-meet-1773247345966",
      "messages": [],
      "memories": [],
      "data": null,
      "context": null,
      "userId": null,
      "namespace": "wealth-advisor",
      "tokens": 0,
      "ttlSeconds": null,
      "lastAccessed": "2026-03-11T16:42:26.021531Z",
      "createdAt": "2026-03-11T16:42:26.021853Z",
      "updatedAt": "2026-03-11T16:42:26.022126Z",
      "contextPercentageTotalUsed": 0,
      "contextPercentageUntilSummarization": 0
    }
  },
  "error": null
}
```

`created: false` means the session already existed (idempotent). `created: true` means a new session was created.

## curl

```bash
curl -s -X POST http://localhost:3001/api/createWorkingMemory \
  -H 'Content-Type: application/json' \
  -d '{"transcriptId":"2026-02-26-google-meet"}'
```

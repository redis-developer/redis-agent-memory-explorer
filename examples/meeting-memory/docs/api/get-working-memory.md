# POST /api/getWorkingMemory

Returns the full working memory state for a session.

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
  "data": {
    "sessionId": "playback-2026-02-26-google-meet-1773247345966",
    "messages": [
      {
        "role": "user",
        "content": "[00:00:05] Sarah Chen: Hi James, good to see you. Can you hear me okay?",
        "id": "01KKEWEJMMN3EYV5Q65Q9N4VRZ",
        "createdAt": "2026-03-11T16:42:31.444805Z"
      }
    ],
    "memories": [],
    "data": null,
    "context": null,
    "userId": "sarah-chen",
    "namespace": "wealth-advisor",
    "tokens": 0,
    "ttlSeconds": null,
    "lastAccessed": "2026-03-11T16:42:36.597000Z",
    "createdAt": "2026-03-11T16:42:26.021000Z",
    "updatedAt": "2026-03-11T16:42:36.597000Z",
    "contextPercentageTotalUsed": null,
    "contextPercentageUntilSummarization": null
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/getWorkingMemory \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"playback-2026-02-26-google-meet-1773247345966"}'
```

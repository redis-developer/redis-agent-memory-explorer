# POST /api/appendWorkingMemory

Appends a transcript chunk to working memory. Called on each playback tick. On the last chunk, set `isLastChunk: true` to trigger background long-term memory extraction.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | yes | Session from `createWorkingMemory` |
| `chunk` | object | yes | Transcript chunk |
| `chunk.timestamp` | string | yes | e.g. `"00:12:15"` |
| `chunk.speaker` | string | yes | e.g. `"James Morrison"` |
| `chunk.role` | string | yes | `"rm"` or `"client"` |
| `chunk.text` | string | yes | Spoken text |
| `isLastChunk` | boolean | yes | Triggers LT memory extraction when `true` |

```json
{
  "sessionId": "playback-2026-02-26-google-meet-1773247345966",
  "chunk": {
    "timestamp": "00:00:05",
    "speaker": "Sarah Chen",
    "role": "rm",
    "text": "Hi James, good to see you. Can you hear me okay?"
  },
  "isLastChunk": false
}
```

## Output

```json
{
  "data": {
    "messageCount": 1,
    "tokens": 0,
    "context": null,
    "contextPercentageTotalUsed": 0.0203125,
    "contextPercentageUntilSummarization": 0.029017857142857144,
    "latencyMs": 52
  },
  "error": null
}
```

Key fields:
- `messageCount` -- total messages in working memory after append
- `tokens` -- token count of the session
- `context` -- auto-generated context summary (appears when context window fills)
- `contextPercentageTotalUsed` / `contextPercentageUntilSummarization` -- context window usage
- `latencyMs` -- round-trip time for the operation

## curl

```bash
curl -s -X POST http://localhost:3001/api/appendWorkingMemory \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId": "playback-2026-02-26-google-meet-1773247345966",
    "chunk": {
      "timestamp": "00:00:05",
      "speaker": "Sarah Chen",
      "role": "rm",
      "text": "Hi James, good to see you. Can you hear me okay?"
    },
    "isLastChunk": false
  }'
```

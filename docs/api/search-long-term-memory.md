# POST /api/searchLongTermMemory

Searches all long-term memories for the active dataset's `namespace` + `userId`. All filter fields are optional. Long-term memories are extracted automatically by the Agent Memory Server after the last transcript chunk is sent with `isLastChunk: true` (~15s background process).

## Input

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `text` | string | no | `""` | Semantic search text |
| `memoryType` | string | no | all | `"semantic"`, `"episodic"`, or `"message"` |
| `topics` | string[] | no | all | Filter by topics (any match) |
| `entities` | string[] | no | all | Filter by entities (any match) |
| `limit` | number | no | 20 | Max results (server max: 100) |
| `offset` | number | no | 0 | Pagination offset |

```json
{}
```

## Output

```json
{
  "data": {
    "memories": [
      {
        "id": "01KKEWFV7X2ACBXNQ2JCT8XKR7",
        "text": "Sarah Chen and James Morrison had a conversation on March 11, 2026.",
        "memoryType": "episodic",
        "topics": ["communication", "meeting", "Sarah Chen", "James Morrison"],
        "entities": ["Sarah Chen", "James Morrison"],
        "userId": "sarah-chen",
        "sessionId": "playback-2026-02-26-google-meet-1773247345966",
        "namespace": "wealth-advisor",
        "eventDate": null,
        "createdAt": "2026-03-11T16:43:13.020000Z",
        "updatedAt": "2026-03-11T16:43:13.020000Z",
        "lastAccessed": "2026-03-11T16:43:13.020000Z",
        "persistedAt": null,
        "pinned": false,
        "accessCount": 0,
        "memoryHash": "db7a55d03606eefc0ffd46b9c34c60c249038f47cfc1fc2b3b7926a6f1b82f64",
        "dist": 0
      },
      {
        "id": "01KKEWFV80FE18SAP9QETTH5EK",
        "text": "User has good communication skills as evidenced by the setup of a meeting.",
        "memoryType": "semantic",
        "topics": ["communication", "skills", "meeting management"],
        "entities": ["User"],
        "userId": "sarah-chen",
        "sessionId": "playback-2026-02-26-google-meet-1773247345966",
        "namespace": "wealth-advisor",
        "eventDate": null,
        "createdAt": "2026-03-11T16:43:13.020000Z",
        "updatedAt": "2026-03-11T16:43:13.020000Z",
        "lastAccessed": "2026-03-11T16:43:13.020000Z",
        "persistedAt": null,
        "pinned": false,
        "accessCount": 0,
        "memoryHash": "279da02688f01981f65e503cfb495c1d12e9b86400a5a89c0552d8fd461cad9e",
        "dist": 0
      }
    ],
    "total": 2,
    "nextOffset": null
  },
  "error": null
}
```

## curl

```bash
# All memories
curl -s -X POST http://localhost:3001/api/searchLongTermMemory \
  -H 'Content-Type: application/json' \
  -d '{}'

# Filtered by type
curl -s -X POST http://localhost:3001/api/searchLongTermMemory \
  -H 'Content-Type: application/json' \
  -d '{"memoryType":"semantic","limit":10}'

# Semantic search
curl -s -X POST http://localhost:3001/api/searchLongTermMemory \
  -H 'Content-Type: application/json' \
  -d '{"text":"retirement planning"}'
```

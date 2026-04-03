# POST /api/listTranscripts

Lists all transcript files for the active dataset.

## Input

`{}` (empty body)

## Output

```json
{
  "data": {
    "transcripts": [
      {
        "id": "2025-09-14-phone",
        "date": "2025-09-14",
        "type": "phone",
        "durationMinutes": 28,
        "chunkCount": 44,
        "participants": { "rm": "Sarah Chen", "client": "James Morrison" }
      },
      {
        "id": "2025-10-28-phone",
        "date": "2025-10-28",
        "type": "phone",
        "durationMinutes": 8,
        "chunkCount": 28,
        "participants": { "rm": "Sarah Chen", "client": "James Morrison" }
      },
      {
        "id": "2025-12-02-google-meet",
        "date": "2025-12-02",
        "type": "google-meet",
        "durationMinutes": 35,
        "chunkCount": 53,
        "participants": { "rm": "Sarah Chen", "client": "James Morrison" }
      },
      {
        "id": "2026-01-15-phone",
        "date": "2026-01-15",
        "type": "phone",
        "durationMinutes": 18,
        "chunkCount": 38,
        "participants": { "rm": "Sarah Chen", "client": "James Morrison" }
      },
      {
        "id": "2026-02-26-google-meet",
        "date": "2026-02-26",
        "type": "google-meet",
        "durationMinutes": 22,
        "chunkCount": 69,
        "participants": { "rm": "Sarah Chen", "client": "James Morrison" }
      }
    ]
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/listTranscripts \
  -H 'Content-Type: application/json' \
  -d '{}'
```

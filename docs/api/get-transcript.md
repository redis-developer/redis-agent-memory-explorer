# POST /api/getTranscript

Returns the full transcript JSON (meeting metadata + all chunks). The frontend loads this once, then iterates through `chunks[]` client-side at intervals.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `transcriptId` | string | yes | Transcript file ID (without `.json` extension) |

```json
{ "transcriptId": "2026-02-26-google-meet" }
```

## Output (truncated -- full response has all 69 chunks)

```json
{
  "data": {
    "meeting": {
      "id": "meeting-005",
      "date": "2026-02-26",
      "type": "google-meet",
      "durationMinutes": 22,
      "participants": { "rm": "Sarah Chen", "client": "James Morrison" },
      "summary": {
        "topics": ["REIT rebalancing execution", "spouse early retirement", "bond fund vs individual bonds", "education fund"],
        "sentiment": "positive",
        "keyDecisions": [
          "Rebalance $150K from REITs: $100K to Short-Duration Bond Fund, $50K to Dividend Aristocrats ETF",
          "James prefers bond fund over individual bonds for simplicity",
          "Sarah to model dual-retirement scenario with Maya retiring 2027"
        ],
        "followUps": [
          "Execute REIT to Bond/ETF rebalance",
          "Model dual-retirement income scenario and send to James",
          "Education fund -- needs dedicated session with Maya"
        ]
      }
    },
    "chunks": [
      { "timestamp": "00:00:05", "speaker": "Sarah Chen", "role": "rm", "text": "Hi James, good to see you. Can you hear me okay?" },
      { "timestamp": "00:00:10", "speaker": "James Morrison", "role": "client", "text": "Hey Sarah, yeah, everything's clear. Thanks for setting this up." },
      "... 67 more chunks ...",
      { "timestamp": "00:18:34", "speaker": "Sarah Chen", "role": "rm", "text": "You too, James. Talk soon." }
    ]
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/getTranscript \
  -H 'Content-Type: application/json' \
  -d '{"transcriptId":"2026-02-26-google-meet"}'
```

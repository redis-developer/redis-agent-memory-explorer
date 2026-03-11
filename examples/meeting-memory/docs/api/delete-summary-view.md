# POST /api/deleteSummaryView

Deletes a summary view and its computed summaries.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `viewId` | string | yes | Summary view ID |

```json
{ "viewId": "01KKEWFTCF41993WV0JK6T3FG9" }
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
curl -s -X POST http://localhost:3001/api/deleteSummaryView \
  -H 'Content-Type: application/json' \
  -d '{"viewId":"01KKEWFTCF41993WV0JK6T3FG9"}'
```

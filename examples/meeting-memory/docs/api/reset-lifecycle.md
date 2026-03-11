# POST /api/resetLifecycle

Full demo reset. Deletes all working memory sessions, long-term memories, and summary views for the active dataset's namespace. Then re-creates the default summary view so the next demo run is ready immediately.

## Input

`{}` (empty body)

## Output

```json
{
  "data": {
    "sessionsDeleted": 0,
    "memoriesDeleted": 2,
    "viewsDeleted": 2,
    "defaultSummaryViewId": "01KKEWHXVY1VD3K3NQPWSC02PV"
  },
  "error": null
}
```

The `defaultSummaryViewId` is the newly created view -- the frontend should update its cached ID.

## curl

```bash
curl -s -X POST http://localhost:3001/api/resetLifecycle \
  -H 'Content-Type: application/json' \
  -d '{}'
```

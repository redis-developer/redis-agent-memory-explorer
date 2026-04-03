# POST /api/resetLifecycle

Full demo reset. Deletes all working memory sessions, long-term memories, and summary views for the active dataset's namespace. Then re-creates all pre-seeded summary views from the dataset config so the next demo run is ready immediately.

## Input

`{}` (empty body)

## Output

```json
{
  "data": {
    "sessionsDeleted": 0,
    "memoriesDeleted": 2,
    "viewsDeleted": 2,
    "viewsCreated": 2
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/resetLifecycle \
  -H 'Content-Type: application/json' \
  -d '{}'
```

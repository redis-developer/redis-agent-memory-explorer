# POST /api/listSummaryViews

Lists all summary views. The `isDefault` flag marks the pre-created view.

## Input

`{}` (empty body)

## Output

```json
{
  "data": {
    "views": [
      {
        "viewId": "01KKEW9QGYHP3A9ABQG9NEA8B9",
        "name": "Client Memory Summary",
        "source": "long_term",
        "groupBy": ["user_id"],
        "isDefault": true
      }
    ]
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/listSummaryViews \
  -H 'Content-Type: application/json' \
  -d '{}'
```

# POST /api/getSummaryView

Gets a single summary view definition by ID.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `viewId` | string | yes | Summary view ID |

```json
{ "viewId": "01KKEW9QGYHP3A9ABQG9NEA8B9" }
```

## Output

```json
{
  "data": {
    "viewId": "01KKEW9QGYHP3A9ABQG9NEA8B9",
    "name": "Client Memory Summary",
    "source": "long_term",
    "groupBy": ["user_id"],
    "timeWindowDays": null,
    "continuous": false,
    "prompt": null,
    "modelName": null
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/getSummaryView \
  -H 'Content-Type: application/json' \
  -d '{"viewId":"01KKEW9QGYHP3A9ABQG9NEA8B9"}'
```

# POST /api/listDatasets

Lists all available datasets (scans data directory for folders with `dataset.config.json`).

## Input

`{}` (empty body)

## Output

```json
{
  "data": {
    "datasets": [
      { "id": "wealth-advisor", "name": "Intelligent Wealth Advisor" }
    ],
    "active": "wealth-advisor"
  },
  "error": null
}
```

## curl

```bash
curl -s -X POST http://localhost:3001/api/listDatasets \
  -H 'Content-Type: application/json' \
  -d '{}'
```

# POST /api/forgetLifecycle

Runs a forget policy against long-term memories. Useful for demonstrating memory cleanup.

## Input

| Field | Type | Required | Description |
|---|---|---|---|
| `policy` | object | no | Forget policy rules |
| `policy.maxAgeDays` | number | no | Delete memories older than N days |
| `policy.maxInactiveDays` | number | no | Delete memories inactive for N days |
| `policy.budget` | number | no | Max memories to keep |
| `dryRun` | boolean | no | If `true`, returns what would be deleted without deleting |

```json
{
  "policy": { "maxAgeDays": 30, "maxInactiveDays": 14 },
  "dryRun": true
}
```

## Output

```json
{
  "data": {
    "deleted": 0,
    "scanned": 0,
    "deletedIds": []
  },
  "error": null
}
```

## curl

```bash
# Dry run
curl -s -X POST http://localhost:3001/api/forgetLifecycle \
  -H 'Content-Type: application/json' \
  -d '{"policy":{"maxAgeDays":30},"dryRun":true}'

# Actual forget
curl -s -X POST http://localhost:3001/api/forgetLifecycle \
  -H 'Content-Type: application/json' \
  -d '{"policy":{"maxAgeDays":30}}'
```

# Pending Tasks & Bugs

Discovered during test plan creation and code review. Organized by priority.

---

## Bugs

---

### BUG-3: Long-term memory results capped at 100 due to AMS hard limit (P1) (fixed)

**Current behavior:** The backend search handlers (`searchLongTermMemory`, `searchLongTermMemoryBySession`) return at most 100 memories per request. With 5 transcripts played, the total LT memory count quickly exceeds 100 (e.g. 130+). The "All memories" tab and Redis Metrics tab show "100 total" even though more exist.

**Root cause:** The Agent Memory Server (AMS) enforces a **hard server-side validation** of `limit <= 100` on `POST /v1/long-term-memory/search`. Any request with `limit > 100` is rejected with a 422 validation error:

```json
{
  "detail": [
    {
      "type": "less_than_equal",
      "loc": ["body", "limit"],
      "msg": "Input should be less than or equal to 100",
      "ctx": { "le": 100 }
    }
  ]
}
```

This is not configurable -- it's baked into the AMS request schema. Our backend constants (`DEFAULT_SEARCH_LIMIT`, `SESSION_SEARCH_LIMIT`, `SEARCH_ALL_LIMIT`) are already at the maximum of 100.

**Fix required -- backend pagination:** The backend search handlers need to paginate using `offset`. Loop with `limit=100, offset=0`, then `offset=100`, etc. until all results are fetched. The AMS SDK provides `searchAllLongTermMemories()` which auto-paginates, but our `cau-redis-agent-memory` wrapper doesn't expose it yet.

**Files to change:**

- `backend/src/handlers/long-term-memory.handlers.ts` -- paginate `searchLongTermMemoryHandler` and `searchLongTermMemoryBySessionHandler`
- `packages/cau-redis-agent-memory/src/operations/long-term-memory.ts` -- add a paginating search variant or expose the SDK's `searchAllLongTermMemories`
- `backend/src/handlers/lifecycle.handlers.ts` -- already paginates for deletion (loop with `SEARCH_ALL_LIMIT`), confirm it handles >100 correctly

**Frontend impact:** The frontend hooks (`useLongTermMemory`) currently expect a single response. If the backend returns all results in one response (after server-side pagination), no frontend changes needed. The Redis Metrics tab and "All memories" count will then show the true total.

---

### BUG-2: Append errors are silently swallowed (P2)

- say AMS fails appending, so instead console log , user must be informed?

**File:** `frontend/src/components/business/transcript-panel/use-transcript-playback.ts`

**Current behavior:** When `appendChunk` fails during playback, the error is caught with `console.error` only. The hook's `error` state is never set. The UI shows no indication that appends are failing.

**Expected behavior:** At minimum, surface append errors in the playback controls status chip (e.g., "Append failed" or a warning indicator). Playback can continue (fire-and-forget is fine for UX), but the user should know if backend writes are failing.

**Impact:** If the backend or AMS goes down mid-playback, the transcript keeps streaming visually but nothing is being written to working memory. The presenter sees a normal-looking playback but the memory explorer will have incomplete data.

---

## Improvements

### IMP-6: Append error count in Redis Metrics tab (P3)

**Current behavior:** Redis Metrics tab shows working memory stats, LT count, and summary count. No error or failure tracking.

**Possible improvement:** Track append success/failure counts in the playback hook and surface them in the Redis Metrics tab. This gives the presenter visibility into backend health during the demo.

---

# Done

### UX

- transcripts with existing sessions are now disabled in the dropdown
- sorting computed summary views , sessions in dropdown in descending order

### AMS Bug

- Workaround added https://github.com/redis/agent-memory-server/issues/229

- Long-term memory results capped at 100 due to AMS hard limit (P1) , use searchAllLongTermMemories

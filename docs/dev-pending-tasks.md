# Pending Tasks & Bugs

Discovered during test plan creation and code review. Organized by priority.

---

## Bugs

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

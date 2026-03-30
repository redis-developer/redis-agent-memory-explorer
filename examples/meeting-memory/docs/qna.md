1> **Namespace Scoping for Summary Views -- How It Works**

The AMS (Agent Memory Server) summary view APIs are **server-global** -- they have no built-in namespace concept. If two datasets share the same AMS, they'd see each other's views. The backend solves this with **two-level scoping**:

**Level 1 -- View Creation (write-time tagging)**
When a view is created (at startup or via API), the backend auto-injects `filters: { namespace: "wealth-advisor", user_id: "sarah-chen" }` from the active dataset config. This does two things:

- Tells the AMS to only use memories from this namespace/user when computing summaries
- Acts as a tag we can filter on later

**Level 2 -- View Listing (read-time filtering)**
When listing views (`listSummaryViews`), the backend fetches ALL views from AMS, then filters client-side: `view.filters.namespace === activeNamespace`. Each dataset only sees its own views.

**Partitions (computed summaries) -- inherited scope, no extra filter**
Partitions are the actual computed summary text. They belong to a view and are grouped by the view's `groupBy` fields (e.g., `session_id` or `user_id`). Since we already filter which VIEWS you can see (Level 2), all partitions within those views are inherently within your namespace. No additional namespace filter is applied to `listSummaryViewPartitions`. (This is where the earlier bug was -- we were incorrectly passing `{ namespace, userId }` as partition filters, which the AMS interpreted as group-field filters and excluded everything.)

**Lifecycle reset -- namespace-safe deletion**
When "Clear All Memories & Restart" is clicked, only views matching `view.filters.namespace === activeNamespace` are deleted. Other datasets' views are untouched. Fresh view definitions are then recreated with the namespace filters.

**In short:**

- **Create**: tag views with `filters: { namespace, user_id }`
- **List views**: filter by `view.filters.namespace`
- **List partitions**: no filter needed (inherited from view)
- **Reset**: only delete/recreate views matching your namespace

---

# Redis Agent Memory Explorer -- Video Script

## SCENE 1: Introduction (30 seconds)

**[Screen: App loaded, idle state -- left panel shows transcript picker, right panel shows empty memory explorer tabs]**

> This is the Redis Agent Memory Explorer -- a demo app that shows how Redis Agent Memory Server handles the full memory lifecycle for AI agents.
>
> We are going to simulate a real meeting between a wealth advisor and their client. As the conversation plays back, we will watch Redis capture it in working memory, auto-extract durable facts into long-term memory, and generate narrative summaries -- all in real time.
>
> The app has two panels. On the left, we have the transcript playback panel. On the right, the memory explorer with tabs for live AI suggestions, working memory, long-term memory, summary views, and a Redis metrics dashboard.

---

## SCENE 2: Select a Meeting Transcript (30 seconds)

**[Action: Click the transcript dropdown in the toolbar]**

> Let's pick a meeting. The dropdown lists all available transcripts from the wealth-advisor dataset.

**[Action: Select a transcript, e.g. "2026-02-26 Google Meet - Quarterly Review"]**

> This is a quarterly review call between Sarah Chen, a relationship manager, and her client James Morrison -- a high-net-worth executive planning for retirement.

**[Action: Optionally change speed to 2x or 4x using the speed dropdown]**

> I will set the playback speed to 4x so we do not have to wait through the full meeting. In a real demo, you might use 1x or 2x to let the audience absorb the conversation.

---

## SCENE 3: Start Playback -- Working Memory in Action (2 minutes)

**[Action: Click the Play button]**

> When I hit Play, the app creates a new working memory session on Redis Agent Memory Server and starts feeding transcript chunks one at a time -- just like a live meeting transcription service would.

**[Screen: Transcript chunks start appearing on the left, one by one, with speaker labels and timestamps]**

> Watch the left panel -- each chunk animates in with the speaker name, role, and timestamp. Sarah is the relationship manager on the right side, James the client on the left.

**[Action: Click the "Working Memory" tab on the right panel]**

> Now let's look at what is happening on the Redis side. The Working Memory tab shows the live state of this session.

**[Screen: Working Memory tab showing session info, token count, context window gauge]**

> We can see the session ID, the token count growing with each chunk, and a context window usage gauge. Right now we are at about 15% of the context window.
>
> _Every chunk I send is being written to Redis Agent Memory Server as a working memory message. This is the agent's short-term recall -- what it can reference about the current conversation_

**[Screen: Continue watching the gauge fill up]**

_As more chunks come in, the token count climbs. When the context window gets too full, the agent memory server automatically summarizes older messages to make room -- we will see that happen shortly._

**[Wait for the context summary to appear -- the "Context Summary" card]**

> There it is. The context summary just appeared. Agent Memory Server detected the context window was getting full and auto-generated a summary of the earlier conversation. This is a key capability -- the agent never loses context, it just condenses it intelligently.

---

## SCENE 4: Live AI Suggestions -- Push-Based Insights During the Call (2 minutes)

**[Screen: While playback is still running, look at the right panel. The Suggestions tab (labeled "AI Insights" or similar) should be the default active tab. A banner above the tabs may already show an insight.]**

_While the transcript streams in, the app is doing something else in the background. Every few chunks, it sends the recent conversation to an LLM along with context from Redis long-term memory. The AI analyzes what is being discussed and pushes suggestions automatically -- the user never has to ask._

**[Action: Click the "AI Insights" / Suggestions tab if it is not already active]**

> This is the Suggestions tab. It has two sections.
>
> _At the top, we have **Detected Topics** -- a live checklist that tracks which agenda items have been covered in the conversation. Some topics were pre-seeded from the meeting metadata. Others are detected on the fly by the AI as new subjects come up._

**[Screen: Show the Detected Topics section. Some topics show a checkmark (discussed), some show a circle (pending / not yet discussed), some show a star icon (newly AI-detected).]**

> We can see that "REIT rebalancing" has been discussed -- the AI confirmed it from the transcript. "Education fund" is still pending -- it has not come up yet. And "Spouse retirement" was just detected as a brand new topic that the AI picked up from the conversation.

**[Screen: Below the topics, show the Live Insights section with suggestion cards appearing.]**

> Below the topics, we have **Live Insights** -- these are the actual AI-generated suggestion cards. Each one has a type badge, a timestamp from the transcript, a title, a summary, and actionable details.

**[Action: Point to or hover over a suggestion card, e.g. a "Life Event Detected" card about Maya's retirement]**

> For example, this card says "Life Event Detected" -- the AI noticed that James mentioned his wife Maya might retire early in 2027. It flagged this as significant and suggested action items: revisit withdrawal rate assumptions, model a dual-retirement scenario, review insurance coverage.
>
> The AI generated this by combining what it just heard in the transcript with what it already knows from past sessions stored in Redis long-term memory. That is push-based intelligence -- no one asked for it, the system surfaced it automatically.

**[Action: Point to the persistent banner above the tabs]**

_Notice the banner above the tabs -- it always shows the latest suggestion, even when you are on a different tab like Working Memory. This way the presenter never misses an insight. Clicking "View Details" jumps back to the Suggestions tab._

**[Screen: If another suggestion arrives during this narration, highlight the animation]**

> And there is another one -- a new suggestion card just animated in. The AI is continuously listening as long as the transcript is advancing.

---

## SCENE 5: Playback Completes -- Long-Term Memory Extraction (2 minutes)

**[Screen: Playback reaches the last chunk. Status chip shows "Completed".]**

> The meeting has ended. All chunks have been sent. Now here is where it gets interesting.
>
> _On that last chunk when there is idle time, Agent Memory Server analyzes the full conversation and pull out durable facts that should persist beyond this session._

**[Action: Click the "Long-Term Memory" tab]**

> Let's switch to the Long-Term Memory tab.

**[Screen: Long-term memories start appearing, grouped by type -- Semantic, Episodic]**

\*The extracted memories are appearing now. They are grouped by type.

> Under Semantic memories, we see facts like "James Morrison's wife Maya is considering early retirement in 2027" and "James prefers bond funds over individual bond laddering." These are durable personal facts that an AI advisor should remember across sessions.
>
> Under Episodic memories, we see events -- like the REIT rebalance decision that was made during this call.\*
>
> Each memory is tagged with topics and entities -- retirement, spouse, planning, bonds. These tags enable semantic search later. Notice the colored badges: blue for semantic, green for episodic.

**[Action: Scroll through the memory cards to show a few]**

> These facts were not manually entered. They were auto-extracted by the agent memory server from the raw conversation. In a production system, this means the AI gets smarter after every interaction without any human data entry.

---

## SCENE 6: Summary Views (1.5 minutes)

**[Action: Click the "Summary Views" tab]**

_Now let's look at Summary Views. These are pre-configured views that condense memories into narrative summaries._

**[Screen: Summary Views tab showing view cards -- e.g. "Client Profile Summary", "Session Recap"]**

> We have pre-seeded views from the dataset config. For example, there is a "Client Profile Summary" that groups by user, and a "Session Recap" that groups by session.

**[Action: Click "Generate Summary" on a view that does not have a computed summary yet]**

> Let's generate the Session Recap for this meeting. I click "Generate Summary" and the agent memory server sends all the extracted long-term memories for this session to an LLM to produce a coherent narrative.

**[Screen: Loading spinner, then the computed summary card appears]**

> Here it is. In a few seconds, it condensed all the extracted memories into a single paragraph:
>
> "James Morrison discussed REIT rebalancing with Sarah, deciding to move 150K into bonds and a dividend ETF. James revealed that his wife Maya may retire early in 2027, which could impact their income planning. James expressed a preference for bond funds over individual bonds for simplicity."
>
> This is the power of summary views -- automatic, structured narrative generation from raw conversation data. A relationship manager could send this to a client, attach it to a CRM record, or use it to prep for the next call.

---

## SCENE 7: Redis Under the Hood (45 seconds)

**[Action: Click the "Redis Under the Hood" tab]**

> Finally, let's look at what Redis did behind the scenes.

**[Screen: Redis Metrics tab showing lifecycle stats]**

> This tab shows the memory lifecycle metrics. We can see how many working memory messages were created, how many long-term facts were extracted, and how many summaries were computed.
>
> All of this -- the working memory writes, the extraction, the summarization -- was handled by Redis Agent Memory Server. The backend just forwarded transcript chunks and the memory server did the rest.

---

## SCENE 8: The Chatbot -- Memory-Aware Conversations (1.5 minutes)

**[Action: Click to open the CopilotKit sidebar on the right edge]**

> There is one more piece. The app includes a memory-aware chatbot powered by LangGraph.

**[Screen: CopilotKit sidebar opens, showing the chat interface]**

> This chatbot has access to the same memory that was just created. It can search working memory, query long-term facts, and reference summaries -- all through tool calls to the agent memory server.

**[Action: Type a question like "What did James decide about his REIT allocation?"]**

> Let me ask: "What did James decide about his REIT allocation?"

**[Screen: Chatbot responds with context from the extracted memories]**

> The chatbot pulls the answer directly from long-term memory -- James agreed to move 150K out of REITs into a short-duration bond fund and a dividend ETF. It did not hallucinate, it did not guess. It retrieved a fact that was auto-extracted from the conversation we just watched.

**[Action: Ask another question like "What new life events should I be aware of for James?"]**

> Let me ask one more: "What new life events should I be aware of for James?"

**[Screen: Chatbot responds mentioning Maya's potential early retirement]**

> It surfaces Maya's potential early retirement -- a fact that was mentioned once, mid-conversation, and automatically captured as a long-term memory. This is what memory-aware AI looks like.

---

## SCENE 9: Reset and Wrap Up (30 seconds)

**[Action: Click the "Clear All" button in the toolbar]**

> To run the demo again from scratch, I click Clear All.

**[Screen: Confirmation dialog appears]**

**[Action: Click "Confirm"]**

> This calls the reset lifecycle endpoint, which deletes all working memory sessions, long-term memories, and summary views -- giving us a clean slate.

**[Screen: App returns to idle state]**

> And that is the Redis Agent Memory Explorer. A complete demonstration of the agent memory lifecycle -- from live transcript ingestion and push-based AI suggestions, through working memory and context summarization, to long-term fact extraction, narrative summaries, and memory-aware chat.
>
> All powered by Redis Agent Memory Server.

---

## Architecture Recap (Optional Closing Slide / Voiceover)

If you want to add a brief architecture callout at the end:

> Under the hood, the app runs four services:
>
> - **Redis** for data storage -- vectors, JSON, and search
> - **Redis Agent Memory Server** for the full memory lifecycle -- working memory, extraction, summarization
> - **An Express backend** that bridges the frontend to the memory server and runs the suggestion agent (push-based LLM analysis every few chunks)
> - **A LangGraph agent** that powers the chatbot with memory-aware tools
>
> The frontend is a Next.js static app with Material UI. Everything is containerized with Docker Compose -- one command to spin it all up.

---

## Tips for Recording

1. **Pace yourself.** Pause 1-2 seconds between actions so viewers can follow the cursor.
2. **Zoom the browser** to 110-125% if text feels small on the recording.
3. **Use 2x or 4x playback speed** to keep the demo moving. 1x is too slow for a video; the audience will lose attention waiting for chunks.
4. **Highlight the "aha" moments:**
   - Live suggestion cards appearing mid-playback (especially "Life Event Detected")
   - Detected Topics checklist updating in real time
   - Context summary appearing automatically
   - Long-term memories populating after extraction
   - Generated narrative summary
   - Chatbot retrieving extracted facts
5. **If the chatbot is slow,** cut/edit the wait time in post-production, or narrate over it: "The LangGraph agent is searching memory now..."

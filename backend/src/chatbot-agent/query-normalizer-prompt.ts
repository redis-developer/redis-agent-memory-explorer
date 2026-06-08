const QUERY_NORMALIZER_PROMPT = `You do two things for a user's latest chat question: (1) rewrite it into a fully self-contained, standalone question, and (2) decide whether that question is worth caching.

The rewritten question is used as a semantic-cache key, so it must be deterministic and canonical: the SAME underlying request must always produce the SAME wording, regardless of how the user phrased it.

Return a structured object with three fields: "standalone", "cacheable", and "reason".

Rules for "standalone":
- Preserve the user's original intent. Never add, remove, or invent constraints that are not implied by the conversation.
- Resolve every pronoun, ellipsis, and deictic reference using the provided conversation history and meeting context:
  - Pronouns ("he", "she", "they", "it") -> the concrete named entity.
  - Deixis ("this meeting", "the call", "that goal", "here") -> the concrete meeting or thing.
  - Ellipsis ("what about bonds?", "and the goals?") -> the full implied question.
- MEETING IDENTITY (critical): whenever the question is about the meeting/call/session, you MUST replace any deictic reference ("this meeting", "the call", "current meeting") with the concrete meeting identity from the provided meeting context, formatted as "the <date> <type> meeting with <client>". NEVER output the words "this meeting", "the current meeting", or "the call" on their own when meeting context is available.
- CANONICAL OVERVIEW FORM: requests for a general overview, recap, summary, or "what happened" / "what was discussed" about the meeting all express the SAME intent. Normalize ALL of them to exactly: "What was discussed in the <date> <type> meeting with <client>?"
- If the question is already fully standalone and not a meeting overview, return it semantically unchanged.
- Keep it a single concise question.

Rules for "cacheable" (whether the answer is worth storing in the semantic cache):
- Set cacheable = false for:
  - Time-sensitive or volatile questions whose answer changes over time ("now", "today", "latest", "current price", "as of today").
  - Chit-chat, meta, or control messages ("thanks", "repeat that", "say it again", "louder", "ok").
  - Questions that remain ambiguous or under-specified even after rewriting.
- Set cacheable = true for stable, factual questions about the client, meetings, goals, portfolio, or other knowledge whose answer does not change between identical asks.

Rules for "reason":
- One short sentence explaining the cacheable decision.

Examples (illustration only -- use the ACTUAL meeting context provided at runtime, not these values. Meeting context = "2023-01-15 video meeting", client = "Maria Lopez"):
- "What happened in this meeting?" -> { "standalone": "What was discussed in the 2023-01-15 video meeting with Maria Lopez?", "cacheable": true, "reason": "Stable factual recap of a past meeting." }
- "Summarize the Jan 15 call" -> { "standalone": "What was discussed in the 2023-01-15 video meeting with Maria Lopez?", "cacheable": true, "reason": "Stable factual recap of a past meeting." }
- "Thanks, that helps!" -> { "standalone": "Thanks, that helps!", "cacheable": false, "reason": "Chit-chat with no cacheable answer." }
- "What's the market doing right now?" -> { "standalone": "What is the market doing right now?", "cacheable": false, "reason": "Time-sensitive question whose answer changes over time." }`;

export { QUERY_NORMALIZER_PROMPT };

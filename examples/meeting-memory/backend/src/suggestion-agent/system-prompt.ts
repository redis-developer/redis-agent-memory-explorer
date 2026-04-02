import type { DatasetConfig, DetectedTopic, LiveSuggestion } from "../types";

import { DetectedTopicStatus } from "../constants";

const FALLBACK_PROMPT = "You are an AI copilot. Analyze the transcript and return null.";

const buildSuggestionSystemPrompt = (
  config: DatasetConfig,
  detectedTopics: DetectedTopic[],
  previousSuggestions: LiveSuggestion[],
): string => {
  const liveSuggestions = config.liveSuggestions;
  const hasNoConfig = !liveSuggestions;

  let prompt = FALLBACK_PROMPT;
  if (!hasNoConfig) {
    const enabledTypes = liveSuggestions.suggestionTypes.filter((t) => t.enabled);
    const pendingTopics = detectedTopics
      .filter((t) => t.status === DetectedTopicStatus.PENDING)
      .map((t) => t.name);
    const discussedTopics = detectedTopics
      .filter((t) => t.status !== DetectedTopicStatus.PENDING)
      .map((t) => `${t.name} (${t.status})`);

    const rmParticipant = config.participants.rm;
    const clientParticipant = config.participants.client;
    const rmLabel = config.roles.rm?.shortLabel ?? "RM";
    const clientLabel = config.roles.client?.shortLabel ?? "Client";

    const typeInstructions = enabledTypes
      .map((t) => `- ${t.id}: ${t.description}`)
      .join("\n");

    const typeIds = enabledTypes.map((t) => `"${t.id}"`).join(", ");

    const discussedList = discussedTopics.length > 0 ? discussedTopics.join(", ") : "none";
    const pendingList = pendingTopics.length > 0 ? pendingTopics.join(", ") : "none";

    const hasPreviousSuggestions = previousSuggestions.length > 0;
    const previousSummaryBlock = hasPreviousSuggestions
      ? previousSuggestions
          .map((s) => `- [${s.type}] "${s.title}": ${s.summary}`)
          .join("\n")
      : "none";

    prompt = `You are a real-time AI copilot analyzing a live meeting transcript for a ${config.roles.rm?.label ?? "professional"}.

## Context
- Dataset: ${config.name}
- ${rmLabel}: ${rmParticipant?.name ?? "Unknown"} (${rmParticipant?.title ?? ""})
- ${clientLabel}: ${clientParticipant?.name ?? "Unknown"} (${clientParticipant?.title ?? ""})

## Your Task
Analyze the most recent transcript segment. If you detect anything noteworthy, return a structured suggestion. If nothing is noteworthy, return null.

## Suggestion Types You Should Look For
${typeInstructions}

## Current Topic State
- Already discussed: ${discussedList}
- Not yet discussed: ${pendingList}

## Previously Generated Suggestions
${previousSummaryBlock}

## Response Format
Return a JSON object with exactly these fields:
{
  "suggestion": { "type": <one of: ${typeIds}>, "title": <string>, "summary": <string, 1-2 sentences>, "details": <array of action items>, "relatedTopics": <array of topic names> } OR null,
  "topicUpdates": <array of { "name": <string>, "status": <"discussed" | "new" | "question">, "detectedAtTimestamp": <string or null> }>
}

## Memory Context
You will receive a separate memory context block containing:
- Working memory: a running summary of what has been discussed so far in THIS session
- Long-term memories: relevant information retrieved from PAST sessions (previous meetings, decisions, concerns, portfolio details, etc.)

How to use the memory context:
- For "topicRecall" suggestions: cross-reference current discussion with long-term memories. If the client revisits a topic from a past session, cite specific details (dates, amounts, concerns expressed) from the memory context in your suggestion details.
- For "lifeEvent" / "sentimentShift" suggestions: check long-term memories for prior context that amplifies the significance (e.g., a retirement mention is more impactful if past sessions show specific retirement targets).
- For action items and details: draw on past session specifics (product names, rates, prior decisions) from long-term memories to make recommendations concrete rather than generic.
- If the memory context is empty or minimal, base your analysis solely on the current transcript segment and topic state.

Important:
- Only return a suggestion if something genuinely noteworthy happened in this segment
- Prefer quality over quantity -- not every segment needs a suggestion
- STRICT DEDUP: If a previous suggestion already covers the same theme, sentiment, or topic (even with different wording or slight escalation), return null. Two "Sentiment Shift" suggestions about the same emotion (e.g. anxiety about market) are duplicates even if the intensity changed. Only generate a new suggestion of the same type if the subject matter is fundamentally different.
- For agenda reminders, only suggest if a pending topic hasn't been discussed and the conversation seems to be moving on
- Keep summaries concise (1-2 sentences) and details actionable
- Always return valid JSON only, no markdown, no explanation`;
  }

  return prompt;
};

export { buildSuggestionSystemPrompt };

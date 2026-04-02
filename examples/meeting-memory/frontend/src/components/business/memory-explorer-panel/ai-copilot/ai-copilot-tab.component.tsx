"use client";

import type {
  LiveSuggestion,
  DetectedTopic,
  LiveSuggestionsConfig,
} from "@/types/suggestion.types";

import { useRef, useEffect } from "react";
import CircularProgress from "@mui/material/CircularProgress";

import { DetectedTopics } from "./detected-topics.component";
import { SuggestionCard } from "./suggestion-card.component";

import "./ai-copilot-tab.component.css";

type AiCopilotTabProps = {
  suggestions: LiveSuggestion[];
  detectedTopics: DetectedTopic[];
  isGenerating: boolean;
  isPlaying: boolean;
  isComplete: boolean;
  labels: LiveSuggestionsConfig;
  scrollToTopSignal: number;
};

const AiCopilotTab = ({
  suggestions,
  detectedTopics,
  isGenerating,
  isPlaying,
  isComplete,
  labels,
  scrollToTopSignal,
}: AiCopilotTabProps) => {
  const insightsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollToTopSignal > 0 && insightsRef.current) {
      insightsRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [scrollToTopSignal]);

  const hasSuggestions = suggestions.length > 0;
  const reversedSuggestions = [...suggestions].reverse();

  let statusText = labels.noSuggestionsMessage;
  if (isPlaying) {
    statusText = labels.waitingMessage;
  }
  if (isComplete && hasSuggestions) {
    statusText = `Playback complete -- ${suggestions.length} insight${suggestions.length !== 1 ? "s" : ""} generated`;
  }

  return (
    <div className="ai-copilot-tab">
      <DetectedTopics topics={detectedTopics} title={labels.topicsTitle} />

      <div className="ai-copilot-tab__insights" ref={insightsRef}>
        <h3 className="ai-copilot-tab__insights-title">{labels.insightsTitle}</h3>

        {hasSuggestions ? (
          <div className="ai-copilot-tab__cards">
            {reversedSuggestions.map((suggestion, idx) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                suggestionTypes={labels.suggestionTypes}
                isNew={idx === 0 && isPlaying}
              />
            ))}
          </div>
        ) : (
          <p className="ai-copilot-tab__empty">{labels.noSuggestionsMessage}</p>
        )}
      </div>

      <div className="ai-copilot-tab__status">
        {isGenerating && (
          <CircularProgress
            size={14}
            sx={{ color: "var(--sky-blue)", marginRight: "var(--space-2xs)" }}
          />
        )}
        <span className="ai-copilot-tab__status-text">{statusText}</span>
      </div>
    </div>
  );
};

export { AiCopilotTab };

export type { AiCopilotTabProps };

"use client";

import type { Suggestion } from "@/types/suggestion.types";

import "./suggestion-banner.component.css";

type SuggestionBannerProps = {
  suggestion: Suggestion | null;
  bannerLabel: string;
  noSuggestionsMessage: string;
  onViewDetails: () => void;
};

const SuggestionBanner = ({
  suggestion,
  bannerLabel,
  noSuggestionsMessage,
  onViewDetails,
}: SuggestionBannerProps) => {
  const hasSuggestion = suggestion !== null;

  const className = hasSuggestion
    ? "suggestion-banner suggestion-banner--active"
    : "suggestion-banner suggestion-banner--empty";

  return (
    <div className={className}>
      {hasSuggestion ? (
        <>
          <div className="suggestion-banner__content">
            <span className="suggestion-banner__label">{bannerLabel}</span>
            <span className="suggestion-banner__summary">{suggestion.summary}</span>
          </div>
          <div className="suggestion-banner__actions">
            <button
              className="suggestion-banner__view-btn"
              onClick={onViewDetails}
              type="button"
            >
              View details
            </button>
            <span className="suggestion-banner__timestamp">{suggestion.timestamp}</span>
          </div>
        </>
      ) : (
        <span className="suggestion-banner__placeholder">{noSuggestionsMessage}</span>
      )}
    </div>
  );
};

export { SuggestionBanner };

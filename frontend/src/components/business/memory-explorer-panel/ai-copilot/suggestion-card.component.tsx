"use client";

import type { Suggestion, SuggestionTypeConfig } from "@/types/suggestion.types";

import Chip from "@mui/material/Chip";

import "./suggestion-card.component.css";

type SuggestionCardProps = {
  suggestion: Suggestion;
  suggestionTypes: SuggestionTypeConfig[];
  isNew: boolean;
};

const SuggestionCard = ({ suggestion, suggestionTypes, isNew }: SuggestionCardProps) => {
  const typeConfig = suggestionTypes.find((t) => t.id === suggestion.type);
  const typeLabel = typeConfig?.label ?? suggestion.type;
  const hasDetails = suggestion.details.length > 0;
  const hasRelatedTopics = suggestion.relatedTopics.length > 0;
  const className = isNew
    ? "suggestion-card suggestion-card--new"
    : "suggestion-card";

  return (
    <div className={className}>
      <div className="suggestion-card__header">
        <Chip
          label={typeLabel}
          size="small"
          className="suggestion-card__type-badge"
          sx={{
            backgroundColor: "var(--base-white)",
            color: "var(--midnight)",
            border: "1px solid var(--dusk-30)",
            borderRadius: "2.5px",
            fontSize: "var(--font-size-2xs)",
            height: 22,
          }}
        />
        <span className="suggestion-card__timestamp">{suggestion.timestamp}</span>
      </div>

      <h4 className="suggestion-card__title">{suggestion.title}</h4>
      <p className="suggestion-card__summary">{suggestion.summary}</p>

      {hasDetails && (
        <ul className="suggestion-card__details">
          {suggestion.details.map((detail, idx) => (
            <li key={idx} className="suggestion-card__detail-item">
              {detail}
            </li>
          ))}
        </ul>
      )}

      {hasRelatedTopics && (
        <div className="suggestion-card__topics">
          {suggestion.relatedTopics.map((topic) => (
            <Chip
              key={topic}
              label={topic}
              size="small"
              variant="outlined"
              sx={{
                backgroundColor: "var(--dusk)",
                borderColor: "var(--dusk-90)",
                borderRadius: "2.5px",
                color: "var(--fg-body)",
                fontSize: "var(--font-size-2xs)",
                height: 20,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export { SuggestionCard };

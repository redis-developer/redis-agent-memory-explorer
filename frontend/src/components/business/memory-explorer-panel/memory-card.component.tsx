"use client";

import type { MemoryRecordData } from "@/types/memory.types";

import { useState } from "react";
import Chip from "@mui/material/Chip";

import { MemoryTypeBadge } from "@/components/core";
import {
  MAX_MEMORY_TEXT_LENGTH,
  MEMORY_TYPE,
  MEMORY_TYPE_LABEL,
} from "@/constants/app.constants";

import "./memory-card.component.css";

type MemoryCardProps = {
  memory: MemoryRecordData;
};

const dedupe = (items: string[]): string[] => [...new Set(items)];

const MEMORY_TYPE_ICON: Partial<Record<MemoryRecordData["memoryType"], string>> = {
  [MEMORY_TYPE.SEMANTIC]: "/icons/icon-semantic-routing-64-white.svg",
  [MEMORY_TYPE.EPISODIC]: "/icons/icon-access-to-memory-64-white.svg",
};

const MemoryCard = ({ memory }: MemoryCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = memory.text.length > MAX_MEMORY_TEXT_LENGTH;
  const displayText = expanded ? memory.text : memory.text.slice(0, MAX_MEMORY_TEXT_LENGTH);
  const createdAt = new Date(memory.createdAt);
  const createdDatePart = createdAt.toLocaleDateString();
  const createdTimePart = createdAt.toLocaleTimeString();
  const uniqueTopics = dedupe(memory.topics);
  const uniqueEntities = dedupe(memory.entities);
  const iconSrc = MEMORY_TYPE_ICON[memory.memoryType];
  const isMessage = memory.memoryType === MEMORY_TYPE.MESSAGE;

  return (
    <div className={`memory-card memory-card--${memory.memoryType}`}>
      <div className="memory-card__header">
        <div className="memory-card__title-group">
          {iconSrc && (
            <img
              src={iconSrc}
              alt=""
              aria-hidden="true"
              className="memory-card__title-icon"
            />
          )}
          {isMessage ? (
            <MemoryTypeBadge memoryType={memory.memoryType} />
          ) : (
            <h3 className="memory-card__title">
              {MEMORY_TYPE_LABEL[memory.memoryType]}
            </h3>
          )}
        </div>
        <div className="memory-card__date-group">
          <span className="timestamp-pill">{createdDatePart}</span>
          <span className="timestamp-pill">{createdTimePart}</span>
        </div>
      </div>

      <p className="memory-card__text">
        {displayText}
        {isLong && !expanded && "... "}
        {isLong && (
          <button
            className="memory-card__expand"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </p>

      {memory.eventDate && (
        <div className="memory-card__event-date">
          Event date: <span className="timestamp-pill">{memory.eventDate}</span>
        </div>
      )}

      {uniqueTopics.length > 0 && (
        <div className="memory-card__tags">
          <span className="memory-card__tag-label">Topics</span>
          {uniqueTopics.map((topic) => (
            <Chip
              key={`t-${topic}`}
              label={topic}
              size="small"
              variant="filled"
              className="memory-card__topic-chip"
            />
          ))}
        </div>
      )}

      {uniqueEntities.length > 0 && (
        <div className="memory-card__tags memory-card__tags--entities">
          <span className="memory-card__tag-label">Entities</span>
          {uniqueEntities.map((entity) => (
            <Chip
              key={`e-${entity}`}
              label={entity}
              size="small"
              variant="filled"
              className="memory-card__entity-chip"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export { MemoryCard };
export type { MemoryCardProps };

"use client";

import type { MemoryRecordData } from "@/types/memory.types";

import { useState } from "react";
import Chip from "@mui/material/Chip";

import { MemoryTypeBadge } from "@/components/core";
import { MAX_MEMORY_TEXT_LENGTH } from "@/constants/app.constants";

import "./memory-card.component.css";

type MemoryCardProps = {
  memory: MemoryRecordData;
};

const dedupe = (items: string[]): string[] => [...new Set(items)];

const MemoryCard = ({ memory }: MemoryCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = memory.text.length > MAX_MEMORY_TEXT_LENGTH;
  const displayText = expanded ? memory.text : memory.text.slice(0, MAX_MEMORY_TEXT_LENGTH);
  const createdDate = new Date(memory.createdAt).toLocaleString();
  const uniqueTopics = dedupe(memory.topics);
  const uniqueEntities = dedupe(memory.entities);

  return (
    <div className={`memory-card memory-card--${memory.memoryType}`}>
      <div className="memory-card__header">
        <MemoryTypeBadge memoryType={memory.memoryType} />
        <span className="memory-card__date">{createdDate}</span>
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
          Event date: {memory.eventDate}
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

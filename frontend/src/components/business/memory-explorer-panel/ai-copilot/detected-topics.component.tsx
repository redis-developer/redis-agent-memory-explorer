"use client";

import type { DetectedTopic } from "@/types/suggestion.types";
import type { ReactNode } from "react";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { EmptyState } from "@/components/core";
import { DETECTED_TOPIC_STATUS, DETECTED_TOPIC_SOURCE } from "@/constants/app.constants";

import "./detected-topics.component.css";

type DetectedTopicsProps = {
  topics: DetectedTopic[];
  title: string;
  emptyTitle: string;
  emptyDescription: string;
};

const PRE_SEEDED_ICON: Record<string, string> = {
  [DETECTED_TOPIC_STATUS.PENDING]: "○",
  [DETECTED_TOPIC_STATUS.DISCUSSED]: "✓",
  [DETECTED_TOPIC_STATUS.NEW]: "✦",
  [DETECTED_TOPIC_STATUS.QUESTION]: "?",
};

const AI_DETECTED_ICON: Record<string, string> = {
  [DETECTED_TOPIC_STATUS.NEW]: "✦",
  [DETECTED_TOPIC_STATUS.DISCUSSED]: "✦",
  [DETECTED_TOPIC_STATUS.QUESTION]: "?",
};

const TOPIC_TITLE: Record<string, Record<string, string>> = {
  [DETECTED_TOPIC_SOURCE.PRE_SEEDED]: {
    [DETECTED_TOPIC_STATUS.PENDING]: "Pre-seeded topic—not yet discussed",
    [DETECTED_TOPIC_STATUS.DISCUSSED]: "Pre-seeded topic—discussed",
    [DETECTED_TOPIC_STATUS.NEW]: "Pre-seeded topic—newly raised",
    [DETECTED_TOPIC_STATUS.QUESTION]: "Pre-seeded topic—question raised",
  },
  [DETECTED_TOPIC_SOURCE.AI_DETECTED]: {
    [DETECTED_TOPIC_STATUS.NEW]: "AI-detected topic",
    [DETECTED_TOPIC_STATUS.DISCUSSED]: "AI-detected topic—discussed",
    [DETECTED_TOPIC_STATUS.QUESTION]: "AI-detected topic—question raised",
  },
};

const getTopicIcon = (topic: DetectedTopic): ReactNode => {
  const isAiDetected = topic.source === DETECTED_TOPIC_SOURCE.AI_DETECTED;

  if (
    !isAiDetected &&
    topic.status === DETECTED_TOPIC_STATUS.DISCUSSED
  ) {
    return <ArrowRight size={14} strokeWidth={2} />;
  }

  const icons = isAiDetected ? AI_DETECTED_ICON : PRE_SEEDED_ICON;

  return icons[topic.status] ?? "○";
};

const getTopicTitle = (topic: DetectedTopic): string => {
  return TOPIC_TITLE[topic.source]?.[topic.status] ?? topic.status;
};

const TRANSCRIPT_TIMESTAMP_PATTERN = /^\[?\d{2}:\d{2}:\d{2}\]?$/;

const formatTimestamp = (value: string): string => {
  const hasBrackets = value.startsWith("[");

  return hasBrackets ? value : `[${value}]`;
};

const DetectedTopics = ({ topics, title, emptyTitle, emptyDescription }: DetectedTopicsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasTopics = topics.length > 0;

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  return (
    <div className="detected-topics">
      <button
        className="detected-topics__header"
        onClick={toggleExpanded}
        type="button"
      >
        <h3 className="detected-topics__title">{title} ({topics.length})</h3>
        <span className={`detected-topics__chevron ${isExpanded ? "detected-topics__chevron--open" : ""}`}>
          &#9662;
        </span>
      </button>
      {isExpanded && hasTopics ? (
        <ul className="detected-topics__list">
          {topics.map((topic) => {
            const hasPlaybackTimestamp =
              topic.detectedAtTimestamp !== null &&
              TRANSCRIPT_TIMESTAMP_PATTERN.test(topic.detectedAtTimestamp);

            return (
              <li
                key={topic.name}
                className={`detected-topics__item detected-topics__item--${topic.status}`}
              >
                <span className="detected-topics__icon" title={getTopicTitle(topic)}>
                  {getTopicIcon(topic)}
                </span>
                <span className="detected-topics__name">{topic.name}</span>
                {hasPlaybackTimestamp && (
                  <span className="detected-topics__timestamp timestamp-pill">
                    {formatTimestamp(topic.detectedAtTimestamp!)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : isExpanded ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : null}
    </div>
  );
};

export { DetectedTopics };

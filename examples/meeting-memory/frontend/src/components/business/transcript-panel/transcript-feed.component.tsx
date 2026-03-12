"use client";

import type { TranscriptChunk } from "@/types/transcript.types";
import type { RoleConfig, ParticipantConfig } from "@/types/dataset-config.types";

import { useRef, useEffect, useState } from "react";

import { TranscriptChunkComponent } from "./transcript-chunk.component";

import "./transcript-feed.component.css";

type TranscriptFeedProps = {
  chunks: TranscriptChunk[];
  roles: Record<string, RoleConfig>;
  participants: Record<string, ParticipantConfig>;
  accentColor: string;
  isPlaying: boolean;
};

const TranscriptFeed = ({
  chunks,
  roles,
  participants,
  accentColor,
  isPlaying,
}: TranscriptFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevChunkCountRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const shouldScroll = autoScroll && container;
    if (!shouldScroll) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [chunks.length, autoScroll]);

  useEffect(() => {
    prevChunkCountRef.current = chunks.length;
  });

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setAutoScroll(distanceFromBottom < 80);
  };

  return (
    <div
      className="transcript-feed"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {chunks.map((chunk, idx) => {
        const participant = participants[chunk.role];
        const roleConfig = roles[chunk.role];
        const isNew = idx >= prevChunkCountRef.current;

        return (
          <TranscriptChunkComponent
            key={`${chunk.timestamp}-${idx}`}
            timestamp={chunk.timestamp}
            speaker={participant?.name ?? chunk.speaker}
            role={chunk.role}
            roleLabel={roleConfig?.shortLabel ?? chunk.role}
            text={chunk.text}
            isNew={isNew && isPlaying}
            accentColor={accentColor}
          />
        );
      })}
    </div>
  );
};

export { TranscriptFeed };
export type { TranscriptFeedProps };

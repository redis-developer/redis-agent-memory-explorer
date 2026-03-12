"use client";

import Chip from "@mui/material/Chip";

import "./memory-type-badge.component.css";

type MemoryType = "semantic" | "episodic" | "message";

type MemoryTypeBadgeProps = {
  memoryType: MemoryType;
};

const LABELS: Record<MemoryType, string> = {
  semantic: "Semantic",
  episodic: "Episodic",
  message: "Message",
};

const MemoryTypeBadge = ({ memoryType }: MemoryTypeBadgeProps) => {
  return (
    <Chip
      label={LABELS[memoryType]}
      size="small"
      className={`memory-type-badge memory-type-badge--${memoryType}`}
    />
  );
};

export { MemoryTypeBadge };
export type { MemoryTypeBadgeProps, MemoryType };

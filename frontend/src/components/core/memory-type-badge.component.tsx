"use client";

import type { MemoryType } from "@/constants/app.constants";

import Chip from "@mui/material/Chip";

import { MEMORY_TYPE_LABEL } from "@/constants/app.constants";

import "./memory-type-badge.component.css";

type MemoryTypeBadgeProps = {
  memoryType: MemoryType;
};

const MemoryTypeBadge = ({ memoryType }: MemoryTypeBadgeProps) => {
  return (
    <Chip
      label={MEMORY_TYPE_LABEL[memoryType]}
      size="small"
      className={`memory-type-badge memory-type-badge--${memoryType}`}
    />
  );
};

export { MemoryTypeBadge };
export type { MemoryTypeBadgeProps };

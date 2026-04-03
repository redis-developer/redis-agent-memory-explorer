"use client";

import type { HealthStatus } from "@/constants/app.constants";

import { HEALTH_STATUS } from "@/constants/app.constants";

import "./status-dot.component.css";

type StatusDotProps = {
  status: HealthStatus;
};

const STATUS_COLORS: Record<HealthStatus, string> = {
  [HEALTH_STATUS.OK]: "var(--color-episodic)",
  [HEALTH_STATUS.ERROR]: "var(--hyper-05)",
  [HEALTH_STATUS.CHECKING]: "var(--yellow)",
};

const StatusDot = ({ status }: StatusDotProps) => {
  return (
    <span
      className={`status-dot status-dot--${status}`}
      style={{ "--dot-color": STATUS_COLORS[status] } as React.CSSProperties}
      title={status}
    />
  );
};

export { StatusDot };
export type { StatusDotProps };

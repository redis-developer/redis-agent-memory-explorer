"use client";

import "./status-dot.component.css";

type StatusDotProps = {
  status: "ok" | "error" | "checking";
};

const STATUS_COLORS: Record<StatusDotProps["status"], string> = {
  ok: "var(--color-episodic)",
  error: "var(--hyper-05)",
  checking: "var(--yellow)",
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

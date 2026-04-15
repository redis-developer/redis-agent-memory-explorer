"use client";

import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";

const DropdownIcon = (props: ComponentProps<"svg">) => (
  <ChevronDown
    size={18}
    {...props}
    style={{
      ...props.style,
      color: "var(--fg-muted)",
      position: "absolute",
      right: 8,
      pointerEvents: "none",
      top: 0,
      bottom: 0,
      margin: "auto",
    }}
  />
);

export { DropdownIcon };

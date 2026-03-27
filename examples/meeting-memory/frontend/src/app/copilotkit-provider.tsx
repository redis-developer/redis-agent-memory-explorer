"use client";

import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core";

import { COPILOTKIT_RUNTIME_URL } from "@/constants/app.constants";

const CopilotKitProvider = ({ children }: { children: ReactNode }) => {
  return (
    <CopilotKit runtimeUrl={COPILOTKIT_RUNTIME_URL} showDevConsole={false}>
      {children}
    </CopilotKit>
  );
};

export { CopilotKitProvider };

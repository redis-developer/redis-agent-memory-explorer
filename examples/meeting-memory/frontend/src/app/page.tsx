"use client";

import type { AppendResult } from "@/types/memory.types";
import type { ComponentProps } from "react";

import { useState, useCallback } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotReadable } from "@copilotkit/react-core";

import { useDatasetConfig } from "@/hooks/use-dataset-config";
import { TranscriptPanel } from "@/components/business/transcript-panel";
import { MemoryExplorerPanel } from "@/components/business/memory-explorer-panel";
import {
  DEFAULT_CHATBOT_TITLE,
  DEFAULT_CHATBOT_INITIAL,
  DEFAULT_CHATBOT_PLACEHOLDER,
  DEFAULT_CHATBOT_INSTRUCTIONS,
} from "@/constants/app.constants";

import "@copilotkit/react-ui/styles.css";
import "./page.css";
import "@/styles/copilotkit-theme.css";

const DemoPage = () => {
  const { config, isLoading, error, retry } = useDatasetConfig();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastAppendResult, setLastAppendResult] = useState<AppendResult | null>(null);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlaybackComplete, setIsPlaybackComplete] = useState(false);

  useCopilotReadable({
    description: "Active session ID for the current meeting playback",
    value: sessionId ?? "none",
  });

  useCopilotReadable({
    description: "User ID for memory scoping",
    value: config?.userId ?? "",
  });

  useCopilotReadable({
    description: "Namespace for memory scoping",
    value: config?.namespace ?? "",
  });

  const handleSessionCreated = useCallback((id: string) => {
    setSessionId(id);
  }, []);

  const handleReset = useCallback(() => {
    setSessionId(null);
    setLastAppendResult(null);
    setCurrentChunkIndex(0);
    setIsPlaying(false);
    setIsPlaybackComplete(false);
  }, []);

  const handleAppendResult = useCallback((result: AppendResult) => {
    setLastAppendResult(result);
  }, []);

  const handlePlaybackStateChange = useCallback(
    (chunkIndex: number, playing: boolean, complete: boolean) => {
      setCurrentChunkIndex(chunkIndex);
      setIsPlaying(playing);
      setIsPlaybackComplete(complete);
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="demo-page demo-page--loading">
        <CircularProgress size={48} sx={{ color: "var(--primary-color)" }} />
        <p className="demo-page__loading-text">Loading dataset configuration...</p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="demo-page demo-page--error">
        <h2 className="demo-page__error-title">Failed to load configuration</h2>
        <p className="demo-page__error-message">{error}</p>
        <Button
          variant="contained"
          onClick={retry}
          sx={{
            backgroundColor: "var(--hyper-07)",
            "&:hover": { backgroundColor: "var(--hyper-08)" },
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const sidebarProps: ComponentProps<typeof CopilotSidebar> = {
    defaultOpen: false,
    instructions: config.chatbot?.instructions ?? DEFAULT_CHATBOT_INSTRUCTIONS,
    labels: {
      title: config.chatbot?.title ?? DEFAULT_CHATBOT_TITLE,
      initial: config.chatbot?.initialMessage ?? DEFAULT_CHATBOT_INITIAL,
      placeholder: config.chatbot?.placeholder ?? DEFAULT_CHATBOT_PLACEHOLDER,
    },
  };

  return (
    <CopilotSidebar {...sidebarProps}>
      <main className="demo-page">
        <header className="demo-page__header">
          <div className="demo-page__logo">
            <img src="/redis-logo.svg" alt="Redis" height={28} />
          </div>
          <div className="demo-page__title-group">
            <h1 className="demo-page__title">{config.branding.title}</h1>
            <p className="demo-page__subtitle">{config.branding.subtitle}</p>
          </div>
        </header>

        <div className="demo-page__panels">
          <div className="demo-page__panel demo-page__panel--transcript">
            <TranscriptPanel
              datasetConfig={config}
              onSessionCreated={handleSessionCreated}
              onReset={handleReset}
              onAppendResult={handleAppendResult}
              onPlaybackStateChange={handlePlaybackStateChange}
            />
          </div>
          <div className="demo-page__panel demo-page__panel--explorer">
            <MemoryExplorerPanel
              userId={config.userId}
              namespace={config.namespace}
              sessionId={sessionId}
              datasetConfig={config}
              lastAppendResult={lastAppendResult}
              currentChunkIndex={currentChunkIndex}
              isPlaying={isPlaying}
              isPlaybackComplete={isPlaybackComplete}
            />
          </div>
        </div>

        <footer className="demo-page__footer">
          <span>{config.branding.footerText}</span>
        </footer>
      </main>
    </CopilotSidebar>
  );
};

export default DemoPage;

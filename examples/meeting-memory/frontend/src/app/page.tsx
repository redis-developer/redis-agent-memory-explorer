"use client";

import type { AppendResult } from "@/types/memory.types";

import { useState, useCallback } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";

import { useDatasetConfig } from "@/hooks/use-dataset-config";
import { TranscriptPanel } from "@/components/business/transcript-panel";
import { MemoryExplorerPanel } from "@/components/business/memory-explorer-panel";

import "./page.css";

const DemoPage = () => {
  const { config, isLoading, error, retry } = useDatasetConfig();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastAppendResult, setLastAppendResult] = useState<AppendResult | null>(null);

  const handleSessionCreated = useCallback((id: string) => {
    setSessionId(id);
  }, []);

  const handleReset = useCallback(() => {
    setSessionId(null);
    setLastAppendResult(null);
  }, []);

  const handleAppendResult = useCallback((result: AppendResult) => {
    setLastAppendResult(result);
  }, []);

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

  return (
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
          />
        </div>
        <div className="demo-page__panel demo-page__panel--explorer">
          <MemoryExplorerPanel
            userId={config.userId}
            namespace={config.namespace}
            sessionId={sessionId}
            datasetConfig={config}
            lastAppendResult={lastAppendResult}
          />
        </div>
      </div>

      <footer className="demo-page__footer">
        <span>{config.branding.footerText}</span>
      </footer>
    </main>
  );
};

export default DemoPage;

"use client";

import type { AssistantMessageProps } from "@copilotkit/react-ui";

import { Markdown } from "@copilotkit/react-ui";

import "./assistant-message.component.css";

const SOURCE_PATTERN = /^\*\*Source:\s*(.+?)\*\*\s*$/;

const parseSourceLabel = (raw: string): string => {
  const trimmed = raw.trim();
  const isJsonArray = trimmed.startsWith("[");
  if (!isJsonArray) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as string[];
    return parsed.join(", ");
  } catch {
    return trimmed.replace(/[\[\]"]/g, "");
  }
};
const TOOLS_PATTERN = /^<tools>(.*?)<\/tools>\s*$/;

type ParsedMessage = {
  source: string | null;
  tools: string[];
  body: string;
};

const parseMessage = (text: string): ParsedMessage => {
  const lines = text.split("\n");
  let source: string | null = null;
  let tools: string[] = [];
  let bodyStartIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed === "") {
      bodyStartIdx = i + 1;
      continue;
    }

    const sourceMatch = trimmed.match(SOURCE_PATTERN);
    if (sourceMatch) {
      source = sourceMatch[1];
      bodyStartIdx = i + 1;
      continue;
    }

    const toolsMatch = trimmed.match(TOOLS_PATTERN);
    if (toolsMatch) {
      tools = toolsMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
      bodyStartIdx = i + 1;
      continue;
    }

    break;
  }

  const rawBody = lines.slice(bodyStartIdx).join("\n").trimStart();
  const body = rawBody.replace(/<\/?tools>/g, "");

  return { source, tools, body };
};

const AssistantMessage = (props: AssistantMessageProps) => {
  const { message, isLoading, isGenerating } = props;
  const content = message?.content ?? "";

  const isStreaming = isLoading || isGenerating;
  const hasContent = content.length > 0;

  if (!hasContent && isStreaming) {
    return (
      <div className="assistant-message assistant-message--loading">
        <div className="assistant-message__dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return null;
  }

  const { source, tools, body } = parseMessage(content);
  const displaySource = source ? parseSourceLabel(source) : null;

  return (
    <div className="assistant-message">
      {displaySource && (
        <div className="assistant-message__source">Source: {displaySource}</div>
      )}
      {tools.length > 0 && (
        <details className="assistant-message__tools">
          <summary>Tools used ({tools.length})</summary>
          <ul>
            {tools.map((tool) => (
              <li key={tool}>{tool}</li>
            ))}
          </ul>
        </details>
      )}
      {body && (
        <div className="assistant-message__body">
          <Markdown content={body} />
        </div>
      )}
      {isStreaming && (
        <div className="assistant-message__cursor" />
      )}
    </div>
  );
};

export { AssistantMessage };

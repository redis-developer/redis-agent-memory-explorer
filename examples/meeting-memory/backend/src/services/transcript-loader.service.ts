import type { TranscriptData, TranscriptSummary } from "../types";

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

import { DATA_DIR } from "../config";

const TRANSCRIPTS_SUBDIR = "transcripts";
const JSON_EXT = ".json";

const getTranscriptsDir = (datasetId: string): string => {
  return join(DATA_DIR, datasetId, TRANSCRIPTS_SUBDIR);
};

const loadTranscript = (
  datasetId: string,
  transcriptId: string,
): TranscriptData => {
  const filePath = join(
    getTranscriptsDir(datasetId),
    `${transcriptId}${JSON_EXT}`,
  );
  const fileExists = existsSync(filePath);

  if (!fileExists) {
    throw new Error(
      `Transcript not found: ${filePath}`,
    );
  }

  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as TranscriptData;

  return parsed;
};

const listTranscripts = (datasetId: string): TranscriptSummary[] => {
  const dir = getTranscriptsDir(datasetId);
  const dirExists = existsSync(dir);

  if (!dirExists) {
    return [];
  }

  const files = readdirSync(dir).filter((f) => f.endsWith(JSON_EXT));
  const summaries: TranscriptSummary[] = [];

  for (const file of files) {
    const id = basename(file, JSON_EXT);
    const data = loadTranscript(datasetId, id);

    summaries.push({
      id,
      date: data.meeting.date,
      type: data.meeting.type,
      durationMinutes: data.meeting.durationMinutes,
      chunkCount: data.chunks.length,
      participants: data.meeting.participants,
    });
  }

  return summaries;
};

const TranscriptLoaderService = {
  loadTranscript,
  listTranscripts,
};

export { TranscriptLoaderService };

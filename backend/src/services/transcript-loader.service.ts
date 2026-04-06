import type { TranscriptData, TranscriptSummary } from "../types";

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { Logger } from "cau-logger";

import { TRANSCRIPTS_SUBDIR, JSON_EXT } from "../constants";
import { ENV } from "../config";

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger)
    _logger = Logger.getInstance().child({ component: "TranscriptLoader" });
  return _logger;
};

const getTranscriptsDir = (datasetId: string): string => {
  return join(ENV.DATA_DIR, datasetId, TRANSCRIPTS_SUBDIR);
};

const loadTranscript = (
  datasetId: string,
  transcriptId: string,
): TranscriptData => {
  const logger = getLogger();
  const filePath = join(
    getTranscriptsDir(datasetId),
    `${transcriptId}${JSON_EXT}`,
  );
  const fileExists = existsSync(filePath);

  if (!fileExists) {
    throw new Error(`Transcript not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as TranscriptData;

  logger.info("Transcript loaded", {
    datasetId,
    transcriptId,
    chunkCount: parsed.chunks.length,
  });

  return parsed;
};

const listTranscripts = (datasetId: string): TranscriptSummary[] => {
  const dir = getTranscriptsDir(datasetId);
  const dirExists = existsSync(dir);
  const summaries: TranscriptSummary[] = [];

  if (dirExists) {
    const files = readdirSync(dir).filter((f) => f.endsWith(JSON_EXT));

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
  }

  return summaries;
};

const TranscriptLoaderService = {
  loadTranscript,
  listTranscripts,
};

export { TranscriptLoaderService };

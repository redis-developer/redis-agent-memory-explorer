import type { RouteHandler } from "cau-api-server";
import type { GetTranscriptInput } from "../types";

import { getAppState } from "../app-state";
import { TranscriptLoaderService } from "../services/transcript-loader.service";

const listTranscriptsHandler: RouteHandler = async (_input, { logger }) => {
  const { datasetConfig } = getAppState();
  const datasetId = datasetConfig!.id;
  const transcripts = TranscriptLoaderService.listTranscripts(datasetId);

  logger.info("Listing transcripts", {
    dataset: datasetId,
    count: transcripts.length,
  });

  return { transcripts };
};

const getTranscriptHandler: RouteHandler = async (input, { logger }) => {
  const { transcriptId } = input as GetTranscriptInput;
  const { datasetConfig } = getAppState();
  const datasetId = datasetConfig!.id;
  const transcript = TranscriptLoaderService.loadTranscript(
    datasetId,
    transcriptId,
  );

  logger.info("Serving transcript", {
    dataset: datasetId,
    transcriptId,
    chunkCount: transcript.chunks.length,
  });

  return transcript;
};

export { listTranscriptsHandler, getTranscriptHandler };

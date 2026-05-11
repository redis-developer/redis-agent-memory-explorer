import type { RouteDefinition } from "cau-api-server";

import {
  getDatasetHandler,
  listDatasetsHandler,
} from "./handlers/dataset.handlers";
import {
  listTranscriptsHandler,
  getTranscriptHandler,
} from "./handlers/transcript.handlers";
import {
  createWorkingMemoryHandler,
  appendWorkingMemoryHandler,
  getWorkingMemoryHandler,
  deleteWorkingMemoryHandler,
  listWorkingMemorySessionsHandler,
} from "./handlers/working-memory.handlers";
import {
  searchLongTermMemoryHandler,
  searchLongTermMemoryBySessionHandler,
} from "./handlers/long-term-memory.handlers";
import { resetLifecycleHandler } from "./handlers/lifecycle.handlers";
import {
  generateSuggestionHandler,
  listSuggestionsHandler,
} from "./handlers/suggestion.handlers";

const routes: RouteDefinition[] = [
  // Dataset
  { path: "/getDataset", handler: getDatasetHandler },
  { path: "/listDatasets", handler: listDatasetsHandler },

  // Transcripts
  { path: "/listTranscripts", handler: listTranscriptsHandler },
  { path: "/getTranscript", handler: getTranscriptHandler },

  // Working Memory (Session Memory)
  { path: "/createWorkingMemory", handler: createWorkingMemoryHandler },
  { path: "/appendWorkingMemory", handler: appendWorkingMemoryHandler },
  { path: "/getWorkingMemory", handler: getWorkingMemoryHandler },
  { path: "/deleteWorkingMemory", handler: deleteWorkingMemoryHandler },
  {
    path: "/listWorkingMemorySessions",
    handler: listWorkingMemorySessionsHandler,
  },

  // Long-Term Memory
  { path: "/searchLongTermMemory", handler: searchLongTermMemoryHandler },
  {
    path: "/searchLongTermMemoryBySession",
    handler: searchLongTermMemoryBySessionHandler,
  },

  // Suggestions
  { path: "/generateSuggestion", handler: generateSuggestionHandler },
  { path: "/listSuggestions", handler: listSuggestionsHandler },

  // Lifecycle
  { path: "/resetLifecycle", handler: resetLifecycleHandler },
];

export { routes };

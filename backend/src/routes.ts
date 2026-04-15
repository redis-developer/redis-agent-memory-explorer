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
import {
  createSummaryViewHandler,
  listSummaryViewsHandler,
  getSummaryViewHandler,
  computeSummaryHandler,
  getComputedSummariesHandler,
  deleteSummaryViewHandler,
  getTaskHandler,
} from "./handlers/summary-views.handlers";
import {
  resetLifecycleHandler,
  forgetLifecycleHandler,
} from "./handlers/lifecycle.handlers";
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

  // Working Memory
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

  // Summary Views
  { path: "/createSummaryView", handler: createSummaryViewHandler },
  { path: "/listSummaryViews", handler: listSummaryViewsHandler },
  { path: "/getSummaryView", handler: getSummaryViewHandler },
  { path: "/computeSummary", handler: computeSummaryHandler },
  { path: "/getComputedSummaries", handler: getComputedSummariesHandler },
  { path: "/deleteSummaryView", handler: deleteSummaryViewHandler },
  { path: "/getTask", handler: getTaskHandler },

  // Suggestions
  { path: "/generateSuggestion", handler: generateSuggestionHandler },
  { path: "/listSuggestions", handler: listSuggestionsHandler },

  // Lifecycle
  { path: "/resetLifecycle", handler: resetLifecycleHandler },
  { path: "/forgetLifecycle", handler: forgetLifecycleHandler },
];

export { routes };

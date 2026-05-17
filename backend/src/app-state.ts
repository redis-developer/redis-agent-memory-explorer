import type { AppState } from "./types";

const state: AppState = {
  datasetConfig: null,
  userId: "",
  ctxSurfaceId: "",
  mcpAgentKey: "",
};

const getAppState = (): AppState => state;

const setAppState = (updates: Partial<AppState>): void => {
  Object.assign(state, updates);
};

export { getAppState, setAppState };

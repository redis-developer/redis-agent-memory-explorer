import type { AppState } from "./types";

const state: AppState = {
  datasetConfig: null,
  userId: "",
};

const getAppState = (): AppState => state;

const setAppState = (updates: Partial<AppState>): void => {
  Object.assign(state, updates);
};

export { getAppState, setAppState };

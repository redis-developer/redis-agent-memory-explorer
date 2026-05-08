import { MODEL_CONTEXT_WINDOWS, DEFAULT_CONTEXT_WINDOW } from "../../constants";

const getModelContextWindow = (modelName?: string): number => {
  const normalized = modelName?.toLowerCase().trim() ?? "";
  const result = MODEL_CONTEXT_WINDOWS[normalized] ?? DEFAULT_CONTEXT_WINDOW;

  return result;
};

const getEffectiveTokenLimit = (modelName?: string, contextWindowMax?: number): number => {
  const result = contextWindowMax ?? getModelContextWindow(modelName);

  return result;
};

export { getModelContextWindow, getEffectiveTokenLimit };

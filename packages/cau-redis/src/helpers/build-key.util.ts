import { KEY_SEPARATOR } from "../constants";

const buildKey = (...segments: string[]): string => {
  return segments.join(KEY_SEPARATOR);
};

export { buildKey };

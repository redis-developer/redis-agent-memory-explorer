import type { RedisDbConfig, RedisDbState } from "../types";
import type { RedisClientType } from "redis";

import { createClient } from "redis";

import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_DISABLE_OFFLINE_QUEUE,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
} from "../constants";
import { ENV } from "../config";

const computeReconnectDelay = (
  retries: number,
  maxRetries: number,
  baseDelayMs: number,
): number | Error => {
  const isExhausted = retries >= maxRetries;

  let delay: number | Error;

  if (isExhausted) {
    delay = new Error(`Redis reconnect failed after ${maxRetries} retries`);
  } else {
    delay = Math.min(
      baseDelayMs * Math.pow(2, retries),
      DEFAULT_RETRY_MAX_DELAY_MS,
    );
  }

  return delay;
};

const buildClient = (config: RedisDbConfig): RedisClientType => {
  const url = config.url ?? ENV.REDIS_URL;
  const connectTimeoutMs =
    config.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const disableOfflineQueue =
    config.disableOfflineQueue ?? DEFAULT_DISABLE_OFFLINE_QUEUE;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const client = createClient({
    url,
    socket: {
      connectTimeout: connectTimeoutMs,
      reconnectStrategy: (retries: number, _cause: Error) =>
        computeReconnectDelay(retries, maxRetries, baseDelayMs),
    },
    disableOfflineQueue,
  });

  return client as RedisClientType;
};

const connect = async (state: RedisDbState): Promise<void> => {
  const isAlreadyConnected = state.client !== null && state.client.isOpen;
  const needsConnection = !isAlreadyConnected;

  if (needsConnection) {
    const client = buildClient(state.config);

    client.on("error", (err: Error) => {
      state.logger.error("Redis client error", { error: err.message });
    });

    await client.connect();

    state.client = client;

    const redactedUrl = (state.config.url ?? ENV.REDIS_URL).replace(
      /:\/\/[^@]+@/,
      "://<redacted>@",
    );
    state.logger.info("Redis connection opened", { url: redactedUrl });
  }
};

const close = async (state: RedisDbState): Promise<void> => {
  const hasClient = state.client !== null;

  if (hasClient) {
    const isOpen = state.client!.isOpen;

    if (isOpen) {
      await state.client!.close();
    }

    state.logger.info("Redis connection closed");
    state.client = null;
  }

  const hasSubscriber = state.subscriberClient !== null;

  if (hasSubscriber) {
    const isSubOpen = state.subscriberClient!.isOpen;

    if (isSubOpen) {
      await state.subscriberClient!.close();
    }

    state.subscriberClient = null;
  }
};

const isConnected = (state: RedisDbState): boolean => {
  return state.client !== null && state.client.isOpen;
};

export { computeReconnectDelay, buildClient, connect, close, isConnected };

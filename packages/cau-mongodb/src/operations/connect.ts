import type { Logger } from "cau-logger";
import type { MongoDbConfig, MongoDbState } from "../types";

import { MongoClient } from "mongodb";

import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_MAX_POOL_SIZE,
  DEFAULT_MIN_POOL_SIZE,
} from "../constants";

const buildClientUrl = (config: MongoDbConfig): string => {
  return config.uri;
};

const connect = async (state: MongoDbState): Promise<void> => {
  const isAlreadyConnected = state.client !== null && state.db !== null;
  const needsConnection = !isAlreadyConnected;

  if (needsConnection) {
    const config = state.config;
    const uri = buildClientUrl(config);

    const client = new MongoClient(uri, {
      connectTimeoutMS: config.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
      maxPoolSize: config.maxPoolSize ?? DEFAULT_MAX_POOL_SIZE,
      minPoolSize: config.minPoolSize ?? DEFAULT_MIN_POOL_SIZE,
    });

    await client.connect();

    state.client = client;
    state.db = client.db(config.database);

    const redactedUri = uri.replace(/:\/\/[^@]+@/, "://<redacted>@");
    state.logger.info("MongoDB connection opened", {
      uri: redactedUri,
      database: config.database,
    });
  }
};

const close = async (state: MongoDbState): Promise<void> => {
  const hasConnection = state.client !== null;

  if (hasConnection) {
    await state.client!.close();

    state.logger.info("MongoDB connection closed", {
      database: state.config.database,
    });

    state.client = null;
    state.db = null;
  }
};

const isConnected = (state: MongoDbState): boolean => {
  return state.client !== null && state.db !== null;
};

const ensureConnected = async (state: MongoDbState): Promise<void> => {
  const needsConnection = !isConnected(state);

  if (needsConnection) {
    await connect(state);
  }
};

export { connect, close, isConnected, ensureConnected };

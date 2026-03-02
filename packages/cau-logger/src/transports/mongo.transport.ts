import type { MongoState, MongoTransportOptions } from "../types";

import build from "pino-abstract-transport";

const MAX_FLUSH_ATTEMPTS = 2;

const createState = (): MongoState => ({
  client: null,
  collection: null,
  batch: [],
  connected: false,
});

const connect = async (
  state: MongoState,
  opts: MongoTransportOptions,
): Promise<void> => {
  const mongodb = await import("mongodb");
  const MongoClient = mongodb.MongoClient;
  state.client = new MongoClient(opts.uri);
  await state.client.connect();
  state.collection = state.client.db(opts.database).collection(opts.collection);
  state.connected = true;
};

const flush = async (state: MongoState): Promise<void> => {
  if (state.batch.length > 0 && state.connected) {
    const items = state.batch.splice(0);
    for (let attempt = 0; attempt < MAX_FLUSH_ATTEMPTS; attempt++) {
      try {
        await state.collection.insertMany(items, { ordered: false });
        break;
      } catch (err) {
        const isLastAttempt = attempt === MAX_FLUSH_ATTEMPTS - 1;
        if (isLastAttempt) {
          process.stderr.write(
            `cau-logger [mongo]: flush failed, dropping ${items.length} records: ${err}\n`,
          );
        }
      }
    }
  }
};

const processSource = async (
  state: MongoState,
  batchSize: number,
  connectPromise: Promise<unknown>,
  timer: ReturnType<typeof setInterval>,
  source: AsyncIterable<Record<string, unknown>>,
): Promise<void> => {
  await connectPromise;

  for await (const obj of source) {
    state.batch.push(obj as Record<string, unknown>);
    if (state.batch.length >= batchSize) {
      await flush(state);
    }
  }

  clearInterval(timer);
  await flush(state);
};

const closeTransport = (
  state: MongoState,
  timer: ReturnType<typeof setInterval>,
  cb: Function,
): void => {
  clearInterval(timer);
  flush(state)
    .then(() => (state.client ? state.client.close() : undefined))
    .then(() => cb())
    .catch(() => cb());
};

const mongoTransport = (opts: MongoTransportOptions) => {
  const state = createState();

  const connectPromise = connect(state, opts).catch((err: unknown) => {
    process.stderr.write(`cau-logger [mongo]: connection failed: ${err}\n`);
  });

  const timer = setInterval(() => flush(state), opts.flushInterval);

  return build(
    (source: any) =>
      processSource(state, opts.batchSize, connectPromise, timer, source),
    {
      close: (_err: Error, cb: Function) => closeTransport(state, timer, cb),
    },
  );
};

export default mongoTransport;

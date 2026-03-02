import type { LogRow, SqlState, SqlTransportOptions } from "../types";

import build from "pino-abstract-transport";

const MAX_FLUSH_ATTEMPTS = 2;

const createState = (): SqlState => ({
  knex: null,
  batch: [],
  connected: false,
});

const formatRecord = (record: Record<string, unknown>): LogRow => ({
  level: record.level as number,
  timestamp: record.time ? new Date(record.time as number) : new Date(),
  message: (record.msg as string) ?? "",
  context: (record.context as string) ?? null,
  data: JSON.stringify(record),
});

const connect = async (
  state: SqlState,
  opts: SqlTransportOptions,
): Promise<void> => {
  const knexModule = await import("knex");
  const knexFactory = (knexModule as any).default ?? knexModule;
  state.knex = knexFactory(opts.knexConfig);
  state.connected = true;
};

const flush = async (state: SqlState, table: string): Promise<void> => {
  if (state.batch.length > 0 && state.connected) {
    const items = state.batch.splice(0);
    const rows = items.map(formatRecord);
    for (let attempt = 0; attempt < MAX_FLUSH_ATTEMPTS; attempt++) {
      try {
        await state.knex(table).insert(rows);
        break;
      } catch (err) {
        const isLastAttempt = attempt === MAX_FLUSH_ATTEMPTS - 1;
        if (isLastAttempt) {
          process.stderr.write(
            `cau-logger [sql]: flush failed, dropping ${items.length} records: ${err}\n`,
          );
        }
      }
    }
  }
};

const processSource = async (
  state: SqlState,
  opts: SqlTransportOptions,
  connectPromise: Promise<unknown>,
  timer: ReturnType<typeof setInterval>,
  source: AsyncIterable<Record<string, unknown>>,
): Promise<void> => {
  await connectPromise;

  for await (const obj of source) {
    state.batch.push(obj as Record<string, unknown>);
    if (state.batch.length >= opts.batchSize) {
      await flush(state, opts.table);
    }
  }

  clearInterval(timer);
  await flush(state, opts.table);
};

const closeTransport = (
  state: SqlState,
  table: string,
  timer: ReturnType<typeof setInterval>,
  cb: Function,
): void => {
  clearInterval(timer);
  flush(state, table)
    .then(() => (state.knex ? state.knex.destroy() : undefined))
    .then(() => cb())
    .catch(() => cb());
};

const sqlTransport = (opts: SqlTransportOptions) => {
  const state = createState();

  const connectPromise = connect(state, opts).catch((err: unknown) => {
    process.stderr.write(`cau-logger [sql]: connection failed: ${err}\n`);
  });

  const timer = setInterval(() => flush(state, opts.table), opts.flushInterval);

  return build(
    (source: any) => processSource(state, opts, connectPromise, timer, source),
    {
      close: (_err: Error, cb: Function) =>
        closeTransport(state, opts.table, timer, cb),
    },
  );
};

export default sqlTransport;

import build from "pino-abstract-transport";

import type { SqlTransportOptions } from "../types";

type LogRow = {
  level: number;
  timestamp: Date;
  message: string;
  context: string | null;
  data: string;
};

const formatRecord = (record: Record<string, unknown>): LogRow => ({
  level: record.level as number,
  timestamp: record.time ? new Date(record.time as number) : new Date(),
  message: (record.msg as string) ?? "",
  context: (record.context as string) ?? null,
  data: JSON.stringify(record),
});

const sqlTransport = (opts: SqlTransportOptions) => {
  const { knexConfig, table, batchSize, flushInterval } = opts;

  let knex: any;
  let batch: Record<string, unknown>[] = [];
  let timer: ReturnType<typeof setInterval>;
  let connected = false;

  const connect = async () => {
    const knexModule = await import("knex");
    const knexFactory = (knexModule as any).default ?? knexModule;
    knex = knexFactory(knexConfig);
    connected = true;
  };

  const flush = async () => {
    if (batch.length === 0 || !connected) return;
    const items = batch.splice(0);
    const rows = items.map(formatRecord);
    try {
      await knex(table).insert(rows);
    } catch (err) {
      try {
        await knex(table).insert(rows);
      } catch (retryErr) {
        process.stderr.write(
          `cau-logger [sql]: flush failed, dropping ${items.length} records: ${retryErr}\n`,
        );
      }
    }
  };

  const connectPromise = connect().catch((err: unknown) => {
    process.stderr.write(`cau-logger [sql]: connection failed: ${err}\n`);
  });

  timer = setInterval(flush, flushInterval);

  return build(
    async (source: any) => {
      await connectPromise;

      for await (const obj of source) {
        batch.push(obj as Record<string, unknown>);
        if (batch.length >= batchSize) {
          await flush();
        }
      }

      clearInterval(timer);
      await flush();
    },
    {
      close(err: Error, cb: Function) {
        clearInterval(timer);
        flush()
          .then(() => (knex ? knex.destroy() : undefined))
          .then(() => cb())
          .catch(() => cb());
      },
    },
  );
};

export default sqlTransport;

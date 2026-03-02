import build from "pino-abstract-transport";

import type { MongoTransportOptions } from "../types";

const mongoTransport = (opts: MongoTransportOptions) => {
  const { uri, database, collection, batchSize, flushInterval } = opts;

  let client: any;
  let col: any;
  let batch: Record<string, unknown>[] = [];
  let timer: ReturnType<typeof setInterval>;
  let connected = false;

  const connect = async () => {
    const mongodb = await import("mongodb");
    const MongoClient = mongodb.MongoClient;
    client = new MongoClient(uri);
    await client.connect();
    col = client.db(database).collection(collection);
    connected = true;
  };

  const flush = async (): Promise<void> => {
    const shouldFlush = batch.length > 0 && connected;
    if (shouldFlush) {
      const items = batch.splice(0);
      try {
        await col.insertMany(items, { ordered: false });
      } catch (err) {
        try {
          await col.insertMany(items, { ordered: false });
        } catch (retryErr) {
          process.stderr.write(
            `cau-logger [mongo]: flush failed, dropping ${items.length} records: ${retryErr}\n`,
          );
        }
      }
    }
  };

  const connectPromise = connect().catch((err: unknown) => {
    process.stderr.write(`cau-logger [mongo]: connection failed: ${err}\n`);
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
      close: (err: Error, cb: Function) => {
        clearInterval(timer);
        flush()
          .then(() => (client ? client.close() : undefined))
          .then(() => cb())
          .catch(() => cb());
      },
    },
  );
};

export default mongoTransport;

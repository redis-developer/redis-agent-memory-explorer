import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient } from "mongodb";

import mongoTransport from "./mongo.transport";

const MONGO_URI = process.env.MONGO_URI!;
const TEST_DB = process.env.CAU_TEST_MONGO_DB!;
const TEST_COLLECTION = process.env.CAU_TEST_MONGO_COLLECTION!;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("MongoTransport", () => {
  let verifyClient: MongoClient;

  beforeAll(async () => {
    verifyClient = new MongoClient(MONGO_URI);
    await verifyClient.connect();
    await verifyClient.db(TEST_DB).collection(TEST_COLLECTION).deleteMany({});
  });

  afterEach(async () => {
    await verifyClient.db(TEST_DB).collection(TEST_COLLECTION).deleteMany({});
  });

  afterAll(async () => {
    await verifyClient.db(TEST_DB).dropDatabase();
    await verifyClient.close();
  });

  it("should insert log records into MongoDB after reaching batchSize", async () => {
    const stream = mongoTransport({
      uri: MONGO_URI,
      database: TEST_DB,
      collection: TEST_COLLECTION,
      batchSize: 2,
      flushInterval: 60000,
    });

    const record1 = JSON.stringify({ level: 30, time: Date.now(), msg: "batch msg 1" });
    const record2 = JSON.stringify({ level: 30, time: Date.now(), msg: "batch msg 2" });

    stream.write(record1 + "\n");
    stream.write(record2 + "\n");

    await wait(2000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    expect(docs.length).toBe(2);
    expect(docs.find((d) => d.msg === "batch msg 1")).toBeDefined();
    expect(docs.find((d) => d.msg === "batch msg 2")).toBeDefined();

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });

  it("should flush remaining records on interval timer", async () => {
    const stream = mongoTransport({
      uri: MONGO_URI,
      database: TEST_DB,
      collection: TEST_COLLECTION,
      batchSize: 100,
      flushInterval: 500,
    });

    const record = JSON.stringify({ level: 40, time: Date.now(), msg: "interval flush msg" });
    stream.write(record + "\n");

    await wait(2000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    expect(docs.length).toBe(1);
    expect(docs[0].msg).toBe("interval flush msg");
    expect(docs[0].level).toBe(40);

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });

  it("should flush remaining records when stream ends", async () => {
    const stream = mongoTransport({
      uri: MONGO_URI,
      database: TEST_DB,
      collection: TEST_COLLECTION,
      batchSize: 100,
      flushInterval: 60000,
    });

    const record = JSON.stringify({ level: 50, time: Date.now(), msg: "close flush msg" });
    stream.write(record + "\n");

    await new Promise<void>((resolve) => stream.end(() => resolve()));
    await wait(1000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    expect(docs.length).toBe(1);
    expect(docs[0].msg).toBe("close flush msg");
  });

  it("should preserve all fields from the log record", async () => {
    const stream = mongoTransport({
      uri: MONGO_URI,
      database: TEST_DB,
      collection: TEST_COLLECTION,
      batchSize: 1,
      flushInterval: 60000,
    });

    const now = Date.now();
    const record = JSON.stringify({
      level: 30,
      time: now,
      msg: "structured log",
      context: "OrderService",
      requestId: "req-abc-123",
      userId: "user-42",
    });

    stream.write(record + "\n");
    await wait(2000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    expect(docs.length).toBe(1);
    expect(docs[0].msg).toBe("structured log");
    expect(docs[0].context).toBe("OrderService");
    expect(docs[0].requestId).toBe("req-abc-123");
    expect(docs[0].userId).toBe("user-42");
    expect(docs[0].time).toBe(now);

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });
});

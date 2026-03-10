import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient } from "mongodb";

import { ENV } from "../config";
import mongoTransport from "./mongo.transport";

const MONGO_URI = ENV.MONGO_URI;
const TEST_DB = ENV.TEST.CAU_LOGGER_MONGO_DB_NAME;
const TEST_COLLECTION = ENV.TEST.CAU_LOGGER_MONGO_COLLECTION + "Transport";

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
    // intentionally left empty — cleanup happens in afterAll so records
    // can be inspected by commenting out the deleteMany below
  });

  afterAll(async () => {
    await verifyClient.db(TEST_DB).collection(TEST_COLLECTION).deleteMany({});
    await verifyClient.close();
  });

  it("should insert log records into MongoDB after reaching batchSize", async () => {
    const msg1 = "batch msg 1";
    const msg2 = "batch msg 2";

    const stream = mongoTransport({
      uri: MONGO_URI,
      database: TEST_DB,
      collection: TEST_COLLECTION,
      batchSize: 2,
      flushInterval: 60000,
    });

    const record1 = JSON.stringify({
      level: 30,
      time: Date.now(),
      msg: msg1,
    });
    const record2 = JSON.stringify({
      level: 30,
      time: Date.now(),
      msg: msg2,
    });

    stream.write(record1 + "\n");
    stream.write(record2 + "\n");

    await wait(2000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    expect(docs.find((d) => d.msg === msg1)).toBeDefined();
    expect(docs.find((d) => d.msg === msg2)).toBeDefined();

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });

  it("should flush remaining records on interval timer", async () => {
    const msg = "interval flush msg";

    const stream = mongoTransport({
      uri: MONGO_URI,
      database: TEST_DB,
      collection: TEST_COLLECTION,
      batchSize: 100,
      flushInterval: 500,
    });

    const record = JSON.stringify({
      level: 40,
      time: Date.now(),
      msg,
    });
    stream.write(record + "\n");

    await wait(2000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    const msgDoc = docs.find((d) => d.msg === msg);
    expect(msgDoc).toBeDefined();
    expect(msgDoc?.level).toBe(40);

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });

  it("should flush remaining records when stream ends", async () => {
    const msg = "close flush msg";

    const stream = mongoTransport({
      uri: MONGO_URI,
      database: TEST_DB,
      collection: TEST_COLLECTION,
      batchSize: 100,
      flushInterval: 60000,
    });

    const record = JSON.stringify({
      level: 50,
      time: Date.now(),
      msg,
    });
    stream.write(record + "\n");

    await new Promise<void>((resolve) => stream.end(() => resolve()));
    await wait(1000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    const msgDoc = docs.find((d) => d.msg === msg);
    expect(msgDoc).toBeDefined();
  });

  it("should preserve all fields from the log record", async () => {
    const msg = "structured log";
    const context = "OrderService";
    const requestId = "req-abc-123";
    const userId = "user-42";
    const now = Date.now();

    const stream = mongoTransport({
      uri: MONGO_URI,
      database: TEST_DB,
      collection: TEST_COLLECTION,
      batchSize: 1,
      flushInterval: 60000,
    });

    const record = JSON.stringify({
      level: 30,
      time: now,
      msg,
      context,
      requestId,
      userId,
    });

    stream.write(record + "\n");
    await wait(2000);

    const docs = await verifyClient
      .db(TEST_DB)
      .collection(TEST_COLLECTION)
      .find({})
      .toArray();

    const msgDoc = docs.find((d) => d.msg === msg);
    expect(msgDoc).toBeDefined();
    expect(msgDoc?.context).toBe(context);
    expect(msgDoc?.requestId).toBe(requestId);
    expect(msgDoc?.userId).toBe(userId);
    expect(msgDoc?.time).toBe(now);

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });
});

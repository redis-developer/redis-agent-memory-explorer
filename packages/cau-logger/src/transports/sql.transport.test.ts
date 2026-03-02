import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import knex from "knex";

import type { Knex } from "knex";

import { ENV } from "../config";
import sqlTransport from "./sql.transport";

const PG_CONNECTION = ENV.PG_CONNECTION_URL;
const TEST_TABLE = ENV.TEST.CAU_LOGGER_SQL_TABLE + "Transport";

const KNEX_CONFIG: Knex.Config = {
  client: "pg",
  connection: PG_CONNECTION,
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("SqlTransport", () => {
  let verifyDb: Knex;

  beforeAll(async () => {
    verifyDb = knex(KNEX_CONFIG);

    await verifyDb.schema.dropTableIfExists(TEST_TABLE);
    await verifyDb.schema.createTable(TEST_TABLE, (t) => {
      t.increments("id").primary();
      t.integer("level").notNullable();
      t.timestamp("timestamp").notNullable();
      t.text("message").notNullable();
      t.text("context").nullable();
      t.jsonb("data").notNullable();
    });
  });

  afterEach(async () => {
    // intentionally left empty — cleanup happens in afterAll so records
    // can be inspected by commenting out the truncate below
  });

  afterAll(async () => {
    await verifyDb(TEST_TABLE).truncate();
    await verifyDb.schema.dropTableIfExists(TEST_TABLE);
    await verifyDb.destroy();
  });

  it("should insert log records into PostgreSQL after reaching batchSize", async () => {
    const msg1 = "sql batch 1";
    const msg2 = "sql batch 2";

    const stream = sqlTransport({
      knexConfig: KNEX_CONFIG as Record<string, unknown>,
      table: TEST_TABLE,
      batchSize: 2,
      flushInterval: 60000,
    });

    const record1 = JSON.stringify({ level: 30, time: Date.now(), msg: msg1 });
    const record2 = JSON.stringify({ level: 30, time: Date.now(), msg: msg2 });

    stream.write(record1 + "\n");
    stream.write(record2 + "\n");

    await wait(2000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    expect(rows.find((r: { message: string }) => r.message === msg1)).toBeDefined();
    expect(rows.find((r: { message: string }) => r.message === msg2)).toBeDefined();

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });

  it("should flush remaining records on interval timer", async () => {
    const msg = "sql interval msg";

    const stream = sqlTransport({
      knexConfig: KNEX_CONFIG as Record<string, unknown>,
      table: TEST_TABLE,
      batchSize: 100,
      flushInterval: 500,
    });

    const record = JSON.stringify({ level: 40, time: Date.now(), msg });
    stream.write(record + "\n");

    await wait(2000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    const msgRow = rows.find((r: { message: string }) => r.message === msg);
    expect(msgRow).toBeDefined();
    expect(msgRow?.level).toBe(40);

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });

  it("should flush remaining records when stream ends", async () => {
    const msg = "sql close msg";

    const stream = sqlTransport({
      knexConfig: KNEX_CONFIG as Record<string, unknown>,
      table: TEST_TABLE,
      batchSize: 100,
      flushInterval: 60000,
    });

    const record = JSON.stringify({ level: 50, time: Date.now(), msg });
    stream.write(record + "\n");

    await new Promise<void>((resolve) => stream.end(() => resolve()));
    await wait(1000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    const msgRow = rows.find((r: { message: string }) => r.message === msg);
    expect(msgRow).toBeDefined();
  });

  it("should map log record fields to the correct columns", async () => {
    const msg = "structured sql log";
    const context = "PaymentService";
    const orderId = "ord-999";
    const now = Date.now();

    const stream = sqlTransport({
      knexConfig: KNEX_CONFIG as Record<string, unknown>,
      table: TEST_TABLE,
      batchSize: 1,
      flushInterval: 60000,
    });

    const record = JSON.stringify({
      level: 30,
      time: now,
      msg,
      context,
      orderId,
    });

    stream.write(record + "\n");
    await wait(2000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    const msgRow = rows.find((r: { message: string }) => r.message === msg);
    expect(msgRow).toBeDefined();
    expect(msgRow?.level).toBe(30);
    expect(msgRow?.context).toBe(context);

    const data = typeof msgRow?.data === "string" ? JSON.parse(msgRow.data) : msgRow?.data;
    expect(data.orderId).toBe(orderId);
    expect(data.time).toBe(now);

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });
});

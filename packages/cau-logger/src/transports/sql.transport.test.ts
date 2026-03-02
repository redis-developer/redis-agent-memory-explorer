import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import knex from "knex";

import type { Knex } from "knex";

import sqlTransport from "./sql.transport";

const PG_CONNECTION = process.env.PG_CONNECTION_URL!;
const TEST_TABLE = process.env.CAU_TEST_SQL_TABLE!;

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
    await verifyDb(TEST_TABLE).truncate();
  });

  afterAll(async () => {
    await verifyDb.schema.dropTableIfExists(TEST_TABLE);
    await verifyDb.destroy();
  });

  it("should insert log records into PostgreSQL after reaching batchSize", async () => {
    const stream = sqlTransport({
      knexConfig: KNEX_CONFIG as Record<string, unknown>,
      table: TEST_TABLE,
      batchSize: 2,
      flushInterval: 60000,
    });

    const record1 = JSON.stringify({ level: 30, time: Date.now(), msg: "sql batch 1" });
    const record2 = JSON.stringify({ level: 30, time: Date.now(), msg: "sql batch 2" });

    stream.write(record1 + "\n");
    stream.write(record2 + "\n");

    await wait(2000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    expect(rows.length).toBe(2);
    expect(rows.find((r: any) => r.message === "sql batch 1")).toBeDefined();
    expect(rows.find((r: any) => r.message === "sql batch 2")).toBeDefined();

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });

  it("should flush remaining records on interval timer", async () => {
    const stream = sqlTransport({
      knexConfig: KNEX_CONFIG as Record<string, unknown>,
      table: TEST_TABLE,
      batchSize: 100,
      flushInterval: 500,
    });

    const record = JSON.stringify({ level: 40, time: Date.now(), msg: "sql interval msg" });
    stream.write(record + "\n");

    await wait(2000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    expect(rows.length).toBe(1);
    expect(rows[0].message).toBe("sql interval msg");
    expect(rows[0].level).toBe(40);

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });

  it("should flush remaining records when stream ends", async () => {
    const stream = sqlTransport({
      knexConfig: KNEX_CONFIG as Record<string, unknown>,
      table: TEST_TABLE,
      batchSize: 100,
      flushInterval: 60000,
    });

    const record = JSON.stringify({ level: 50, time: Date.now(), msg: "sql close msg" });
    stream.write(record + "\n");

    await new Promise<void>((resolve) => stream.end(() => resolve()));
    await wait(1000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    expect(rows.length).toBe(1);
    expect(rows[0].message).toBe("sql close msg");
  });

  it("should map log record fields to the correct columns", async () => {
    const stream = sqlTransport({
      knexConfig: KNEX_CONFIG as Record<string, unknown>,
      table: TEST_TABLE,
      batchSize: 1,
      flushInterval: 60000,
    });

    const now = Date.now();
    const record = JSON.stringify({
      level: 30,
      time: now,
      msg: "structured sql log",
      context: "PaymentService",
      orderId: "ord-999",
    });

    stream.write(record + "\n");
    await wait(2000);

    const rows = await verifyDb(TEST_TABLE).select("*");

    expect(rows.length).toBe(1);
    expect(rows[0].level).toBe(30);
    expect(rows[0].message).toBe("structured sql log");
    expect(rows[0].context).toBe("PaymentService");

    const data = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
    expect(data.orderId).toBe("ord-999");
    expect(data.time).toBe(now);

    await new Promise<void>((resolve) => stream.end(() => resolve()));
  });
});

import { config } from "dotenv";

config({ path: "test.env" });

const defaults = {
  PG_CONNECTION_URL:
    process.env.PG_CONNECTION_URL ||
    "postgres://test:test@localhost:5432/cau_test",
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017",

  CAU_TEST_SQL_TABLE: "testLogs",
  CAU_TEST_MONGO_DB: "cauLoggerTest",
  CAU_TEST_MONGO_COLLECTION: "testLogs",
  CAU_TEST_TMP_SUFFIX: "cau-logger-test",
} as const;

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

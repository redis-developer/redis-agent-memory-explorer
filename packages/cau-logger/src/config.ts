import { config } from "dotenv";
import { resolve } from "node:path";

if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
  config({ path: resolve(process.cwd(), "test.env") });
} else {
  config();
}

const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PG_CONNECTION_URL:
    process.env.PG_CONNECTION_URL ??
    "postgres://test:test@localhost:5432/cau_test",
  MONGO_URI: process.env.MONGO_URI ?? "mongodb://localhost:27017",

  TEST: {
    CAU_LOGGER_MONGO_DB_NAME:
      process.env.TEST_CAU_LOGGER_MONGO_DB_NAME ?? "unitTestDb",
    CAU_LOGGER_MONGO_COLLECTION:
      process.env.TEST_CAU_LOGGER_MONGO_COLLECTION ?? "unitTestLogs",
    CAU_LOGGER_SQL_TABLE:
      process.env.TEST_CAU_LOGGER_SQL_TABLE ?? "unitTestLogs",
    CAU_LOGGER_TMP_SUFFIX:
      process.env.TEST_CAU_LOGGER_TMP_SUFFIX ?? "local-logs",
  },
} as const;

export { ENV };

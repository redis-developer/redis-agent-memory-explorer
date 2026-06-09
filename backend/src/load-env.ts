import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

const backendEnv = resolve(__dirname, "../.env");
const rootEnv = resolve(__dirname, "../../.env");

config({ path: existsSync(backendEnv) ? backendEnv : rootEnv });

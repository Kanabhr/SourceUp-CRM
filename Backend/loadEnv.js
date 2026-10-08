// loadEnv.js — must be the FIRST import in server.js
// ESM hoists all static imports and evaluates them in dependency order.
// By making this the first import, dotenv runs before any other module
// reads process.env at evaluation time (cookieOptions, JWT secrets, etc.)
import { existsSync } from "fs";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const envLocalPath = path.resolve(__dirname, ".env.local");
const envPath      = path.resolve(__dirname, ".env");

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else {
  config({ path: envPath });
}

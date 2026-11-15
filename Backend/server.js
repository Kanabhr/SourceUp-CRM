// loadEnv MUST be first - it configures process.env before any other module evaluates
import "./loadEnv.js";

import connectDB from "./MongoDB/Connection.js";
import { seedServicePrefixes } from "./MongoDB/seedPrefixes.js";
import { app } from "./app.js";

// --- Startup guard - reject placeholder JWT secrets ---------------------------
// Prevents the server from starting in an insecure state.
const PLACEHOLDER_ACCESS  = "replace_with_access_token_secret";
const PLACEHOLDER_REFRESH = "replace_with_refresh_token_secret";
// The value shipped in Backend/.env.example
const PLACEHOLDER_EXAMPLE = "replace_with_64_byte_hex";

const isBadSecret = (secret, placeholder) =>
  !secret || secret === placeholder || secret === PLACEHOLDER_EXAMPLE;

if (
  isBadSecret(process.env.ACCESS_TOKEN_SECRET, PLACEHOLDER_ACCESS) ||
  isBadSecret(process.env.REFRESH_TOKEN_SECRET, PLACEHOLDER_REFRESH)
) {
  throw new Error(
    "FATAL: JWT secrets are missing or still set to placeholder values.\n" +
    "Set ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET (env vars on Render, .env.local locally) before starting the server."
  );
}

const port = process.env.PORT || 3000;

connectDB()
  .then(async () => {
    console.log("Connection successful");
    await seedServicePrefixes();
    app.listen(port, "0.0.0.0", () => {
      console.log(`SourceUp CRM listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

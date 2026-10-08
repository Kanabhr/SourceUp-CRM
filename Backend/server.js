// loadEnv MUST be first — it configures process.env before any other module evaluates
import "./loadEnv.js";

import connectDB from "./MongoDB/Connection.js";
import { seedServicePrefixes } from "./MongoDB/seedPrefixes.js";
import { app } from "./app.js";

// --- Startup guard — reject placeholder JWT secrets ---------------------------
// Prevents the server from starting in an insecure state.
// Generate real secrets with:
//   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
const PLACEHOLDER_ACCESS  = "replace_with_access_token_secret";
const PLACEHOLDER_REFRESH = "replace_with_refresh_token_secret";

if (
  process.env.ACCESS_TOKEN_SECRET  === PLACEHOLDER_ACCESS ||
  process.env.REFRESH_TOKEN_SECRET === PLACEHOLDER_REFRESH
) {
  throw new Error(
    "FATAL: JWT secrets are still set to placeholder values in .env.local.\n" +
    "Generate real secrets with:\n" +
    "  node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"\n" +
    "Set ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET before starting the server."
  );
}

const port = process.env.PORT || 3000;

connectDB()
  .then(async () => {
    console.log("Connection successful");
    await seedServicePrefixes();
    app.listen(port, () => {
      console.log(`SourceUp CRM listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

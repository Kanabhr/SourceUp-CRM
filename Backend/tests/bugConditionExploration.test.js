/**
 * Bug Condition Exploration Tests
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2
 *
 * PURPOSE: Each test encodes the EXPECTED CORRECT behavior.
 * On UNFIXED code these tests FAIL — that failure is the signal that each bug exists.
 * After the fix is applied the same tests PASS — confirming each bug is resolved.
 *
 * Bug 1 — Placeholder Secret Guard (server.js)
 * Bug 2 — CWD-Dependent Env Loading   (loadEnv.js)
 * Bug 3 — Incomplete MONGODB_URI       (.env.local / Connection.js)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Absolute path to the Backend directory (parent of tests/)
const BACKEND_DIR = path.resolve(__dirname, "..");

// ─────────────────────────────────────────────────────────────────────────────
// Bug 1 — Placeholder Secret Guard
// ─────────────────────────────────────────────────────────────────────────────
describe("Bug 1 — Placeholder Secret Guard", () => {
  /**
   * FIX VERIFICATION: server.js must contain a startup guard that throws
   * when either JWT secret is still the placeholder value.
   *
   * On UNFIXED code: no guard exists — server starts insecurely. FAIL.
   * After the fix: guard references both placeholder strings + contains throw. PASS.
   *
   * Counterexample (unfixed): server.js has no reference to the placeholder
   * values and no throw/process.exit guard — placeholder secrets are silently accepted.
   */
  it("server.js should contain a startup guard that throws for placeholder secrets", () => {
    const PLACEHOLDER_ACCESS  = "replace_with_access_token_secret";
    const PLACEHOLDER_REFRESH = "replace_with_refresh_token_secret";

    const serverSrc = readFileSync(
      path.resolve(BACKEND_DIR, "server.js"),
      "utf8"
    );

    assert.ok(
      serverSrc.includes(PLACEHOLDER_ACCESS),
      `COUNTEREXAMPLE (Bug 1): server.js does not reference the placeholder ` +
      `ACCESS_TOKEN_SECRET value "${PLACEHOLDER_ACCESS}". ` +
      `No startup guard is present — the server starts insecurely with placeholder secrets.`
    );

    assert.ok(
      serverSrc.includes(PLACEHOLDER_REFRESH),
      `COUNTEREXAMPLE (Bug 1): server.js does not reference the placeholder ` +
      `REFRESH_TOKEN_SECRET value "${PLACEHOLDER_REFRESH}". ` +
      `No startup guard is present — the server starts insecurely with placeholder secrets.`
    );

    assert.ok(
      serverSrc.includes("throw") || serverSrc.includes("process.exit"),
      `COUNTEREXAMPLE (Bug 1): server.js contains no "throw" or "process.exit" call ` +
      `near the placeholder check — the guard does not halt the process.`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug 2 — CWD-Dependent Env Loading
// ─────────────────────────────────────────────────────────────────────────────
describe("Bug 2 — CWD-Dependent Env Loading", () => {
  /**
   * FIX VERIFICATION: loadEnv.js must resolve the env file path using
   * import.meta.url (file-relative), NOT process.cwd() (CWD-relative).
   *
   * On UNFIXED code: source contains existsSync("./.env.local") — CWD-relative. FAIL.
   * After the fix: source uses fileURLToPath + import.meta.url. PASS.
   *
   * Counterexample (unfixed): existsSync("./.env.local") resolves against CWD —
   * when CWD is the repo root, the file is not found and process.env stays empty,
   * causing jwt.sign() and mongoose.connect() to crash the server.
   */
  it("loadEnv.js must use import.meta.url for file-relative path resolution", () => {
    const loadEnvSrc = readFileSync(
      path.resolve(BACKEND_DIR, "loadEnv.js"),
      "utf8"
    );

    // The fix must use import.meta.url to derive a CWD-independent path
    assert.ok(
      loadEnvSrc.includes("import.meta.url"),
      `COUNTEREXAMPLE (Bug 2): loadEnv.js does not use import.meta.url. ` +
      `The file still resolves .env.local relative to process.cwd(), causing ` +
      `crashes when the server is started from outside the Backend/ directory.`
    );

    // Must also use fileURLToPath (standard ESM __dirname pattern)
    assert.ok(
      loadEnvSrc.includes("fileURLToPath"),
      `COUNTEREXAMPLE (Bug 2): loadEnv.js does not use fileURLToPath. ` +
      `Without it, import.meta.url cannot be converted to a filesystem path.`
    );

    // Must NOT contain the broken CWD-relative literal path
    assert.ok(
      !loadEnvSrc.includes('existsSync("./.env.local")'),
      `COUNTEREXAMPLE (Bug 2): loadEnv.js still contains existsSync("./.env.local") ` +
      `— a CWD-relative path that breaks startup from non-Backend/ directories.`
    );

    // The resolved path from loadEnv.js's own directory must point to an existing file
    const expectedPath = path.resolve(BACKEND_DIR, ".env.local");
    assert.ok(
      existsSync(expectedPath),
      `COUNTEREXAMPLE (Bug 2): .env.local does not exist at ${expectedPath}. ` +
      `The file-relative resolution in loadEnv.js will fail.`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug 3 — Incomplete MONGODB_URI
// ─────────────────────────────────────────────────────────────────────────────
describe("Bug 3 — Incomplete MONGODB_URI in .env.local", () => {
  /**
   * FIX VERIFICATION: MONGODB_URI in .env.local must include /SourceUpCRM.
   *
   * On UNFIXED code: URI = "mongodb://127.0.0.1:27017" (no DB name). FAIL.
   * After the fix: URI = "mongodb://127.0.0.1:27017/SourceUpCRM". PASS.
   *
   * Counterexample (unfixed): MONGODB_URI has no database-name path component —
   * any caller using the env value directly connects to the default database.
   */
  it("MONGODB_URI in .env.local should include the /SourceUpCRM database name", () => {
    const envLocalPath = path.resolve(BACKEND_DIR, ".env.local");
    assert.ok(existsSync(envLocalPath), `${envLocalPath} must exist`);

    const result = dotenvConfig({ path: envLocalPath });
    const rawURI = result.parsed?.MONGODB_URI;

    assert.ok(
      rawURI !== undefined,
      "MONGODB_URI must be present in .env.local"
    );

    assert.match(
      rawURI,
      /^mongodb:\/\/.+:\d+\/\S+/,
      `COUNTEREXAMPLE (Bug 3): MONGODB_URI="${rawURI}" does not match the ` +
      `expected pattern mongodb://[host]:[port]/[dbname].`
    );

    assert.ok(
      rawURI.includes("/SourceUpCRM"),
      `COUNTEREXAMPLE (Bug 3): MONGODB_URI="${rawURI}" does not include ` +
      `"/SourceUpCRM". Expected "mongodb://127.0.0.1:27017/SourceUpCRM".`
    );
  });
});

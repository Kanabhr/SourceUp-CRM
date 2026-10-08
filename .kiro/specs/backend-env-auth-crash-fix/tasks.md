# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Env & Auth Configuration Bugs
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms each bug exists
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each of the three bugs
  - **Scoped PBT Approach**: Each test is scoped to the concrete failing input — placeholder string values, a non-`Backend/` CWD path, and a URI string without a `/dbname` segment
  - **Bug 1 — Placeholder Secret Guard**: Simulate startup with `ACCESS_TOKEN_SECRET = "replace_with_access_token_secret"` and `REFRESH_TOKEN_SECRET = "replace_with_refresh_token_secret"`. Assert that a startup guard throws before the HTTP server binds. On unfixed code: no guard exists — no error is thrown. **EXPECTED OUTCOME**: FAIL (confirms Bug 1 exists)
  - **Bug 2 — CWD Env Load**: Invoke the env-loading logic with `process.cwd()` set to a directory that is NOT `Backend/` (e.g., the repo root). Assert `process.env.ACCESS_TOKEN_SECRET !== undefined` after loading. On unfixed code: `existsSync("./.env.local")` resolves against CWD and returns `false` — `process.env` stays empty. **EXPECTED OUTCOME**: FAIL (confirms Bug 2 exists)
  - **Bug 3 — Incomplete URI**: Read `process.env.MONGODB_URI` (loaded from unfixed `.env.local`) and assert it matches `mongodb://[host]:[port]/SourceUpCRM`. On unfixed code: URI ends at port `27017` with no database name. **EXPECTED OUTCOME**: FAIL (confirms Bug 3 exists)
  - Document counterexamples found:
    - Bug 1: No error thrown despite `ACCESS_TOKEN_SECRET = "replace_with_access_token_secret"`
    - Bug 2: `process.env.ACCESS_TOKEN_SECRET` is `undefined` after loading from repo root
    - Bug 3: `process.env.MONGODB_URI` equals `"mongodb://127.0.0.1:27017"` with no `/SourceUpCRM`
  - Mark task complete when all three tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Normal Startup, Auth, and DB Flows Are Unchanged
  - **IMPORTANT**: Follow observation-first methodology — run each test against UNFIXED code with non-buggy inputs first, observe the actual outputs, then write property assertions from those observations
  - **Observe on UNFIXED code (non-buggy inputs)**:
    - Start server from `Backend/` with real (non-placeholder) secrets → observe server binds on configured port
    - Call `User.generateAccessToken()` with valid payload and real secret → observe returned JWT string
    - Call `jwt.verify()` with that token and the same real secret → observe decoded payload matches input
    - Supply an expired token to `VerifyJWT` → observe 401 response
    - Supply a valid token for a user with `isActive = false` → observe 403 response
    - Call `requireRole([...])` with a token whose role is not in the allowed list → observe 403
    - Call `connectDB()` with URI `mongodb://127.0.0.1:27017/SourceUpCRM` → observe successful connection to `SourceUpCRM` database
  - **Write property-based tests** asserting the observed behaviors hold for all non-buggy inputs:
    - For all non-placeholder secret values: `jwt.sign(payload, secret)` followed by `jwt.verify(token, secret)` round-trips without error (from Preservation Requirements 3.2, 3.3)
    - For all valid `{_id, username, email, role}` payloads: decoded token payload matches the signed input (from Preservation Requirements 3.2)
    - For all random CWD values where CWD equals `Backend/`: env loads correctly — same behavior as before (from Preservation Requirements 3.1)
    - For all role values not in the permitted set: `requireRole` returns 403 (from Preservation Requirements 3.7)
    - For URI `mongodb://127.0.0.1:27017/SourceUpCRM`: `connectDB()` targets the `SourceUpCRM` database (from Preservation Requirements 3.6)
  - Run all property tests on UNFIXED code with non-buggy inputs
  - **EXPECTED OUTCOME**: All tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 3. Fix all three configuration bugs

  - [x] 3.1 Update `Backend/.env.local` — fix `MONGODB_URI` and document secret generation
    - Change `MONGODB_URI` from `mongodb://127.0.0.1:27017` to `mongodb://127.0.0.1:27017/SourceUpCRM`
    - Keep existing placeholder values for `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` as-is (real secrets must NOT be committed)
    - Add a comment above the JWT secret lines documenting the command to generate real secrets:
      ```
      # Generate real secrets with:
      # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
      ```
    - _Bug_Condition: isBugCondition_IncompleteURI(uri) where uri = "mongodb://127.0.0.1:27017" (no /dbname path component)_
    - _Expected_Behavior: process.env.MONGODB_URI matches "mongodb://[host]:[port]/SourceUpCRM" — a complete, standalone connection string_
    - _Preservation: All callers using MONGODB_URI directly now receive a fully qualified URI; no runtime string concatenation needed_
    - _Requirements: 2.8, 3.6_

  - [x] 3.2 Fix `Backend/loadEnv.js` — CWD-independent env file resolution
    - Add `import { fileURLToPath } from "url"` and `import path from "path"`
    - Derive `__dirname` equivalent: `const __dirname = path.dirname(fileURLToPath(import.meta.url))`
    - Replace `existsSync("./.env.local")` with `existsSync(path.resolve(__dirname, ".env.local"))`
    - Replace CWD-relative path strings in `config({ path: ... })` with `path.resolve(__dirname, ".env.local")` and `path.resolve(__dirname, ".env")` respectively
    - _Bug_Condition: isBugCondition_CWDEnvLoad(cwd) where resolve(cwd, ".env.local") != resolve(fileDir(loadEnv.js), ".env.local")_
    - _Expected_Behavior: loadEnv'(cwd) populates process.env.ACCESS_TOKEN_SECRET and process.env.MONGODB_URI for ALL cwd values — no crash_
    - _Preservation: Starting from Backend/ continues to work exactly as before (non-buggy path)_
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 3.1_

  - [ ] 3.3 Fix `Backend/MongoDB/Connection.js` — use `MONGODB_URI` directly
    - Remove `import { DBname } from "./constants.js"` — no longer needed
    - Change `mongoose.connect(\`${process.env.MONGODB_URI}/${DBname}\`)` to `mongoose.connect(process.env.MONGODB_URI)`
    - _Bug_Condition: isBugCondition_IncompleteURI(uri) — Connection.js was compensating for incomplete URI via runtime concatenation_
    - _Expected_Behavior: Connection.js uses process.env.MONGODB_URI as-is; the env value is now a complete URI including /SourceUpCRM_
    - _Preservation: mongoose.connect() still targets the SourceUpCRM database — same DB, same seed behavior_
    - _Requirements: 2.8, 3.6_

  - [ ] 3.4 Add startup guard in `Backend/server.js` — reject placeholder secrets at boot
    - After the `import "./loadEnv.js"` line, add a guard block that checks both secrets:
      ```js
      const PLACEHOLDER_ACCESS  = "replace_with_access_token_secret";
      const PLACEHOLDER_REFRESH = "replace_with_refresh_token_secret";

      if (
        process.env.ACCESS_TOKEN_SECRET  === PLACEHOLDER_ACCESS ||
        process.env.REFRESH_TOKEN_SECRET === PLACEHOLDER_REFRESH
      ) {
        throw new Error(
          "FATAL: JWT secrets are still set to placeholder values in .env.local.\n" +
          "Generate real secrets with:\n" +
          '  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"\n' +
          "Set ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET before starting the server."
        );
      }
      ```
    - Guard must execute before `connectDB()`, `seedServicePrefixes()`, and `app.listen()`
    - _Bug_Condition: isBugCondition_PlaceholderSecrets(env) where env.ACCESS_TOKEN_SECRET = "replace_with_access_token_secret" OR env.REFRESH_TOKEN_SECRET = "replace_with_refresh_token_secret"_
    - _Expected_Behavior: server.js throws with a descriptive message and halts before HTTP server binds — no insecure token operations possible_
    - _Preservation: Guard does NOT throw when both secrets are real (non-placeholder) values — normal startup is unaffected_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [ ] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - All Three Bug Conditions Are Resolved
    - **IMPORTANT**: Re-run the SAME tests written in task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behaviors; passing them confirms the bugs are fixed
    - Run all three property tests (placeholder guard, CWD env load, incomplete URI) from step 1 against the fixed code
    - **EXPECTED OUTCOME**: All three tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Normal Startup, Auth, and DB Flows Are Unchanged
    - **IMPORTANT**: Re-run the SAME tests written in task 2 — do NOT write new tests
    - Run all preservation property tests from step 2 against the fixed code
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions in normal startup, token flows, middleware, or DB connectivity)
    - Confirm all tests pass with zero regressions before proceeding to checkpoint

- [ ] 4. Checkpoint — Ensure all tests pass
  - Re-run the complete test suite (exploration tests from task 1 + preservation tests from task 2)
  - Verify the exploration tests (Property 1) now PASS — all three bugs are resolved
  - Verify the preservation tests (Property 2) still PASS — no regressions
  - Verify the server starts cleanly from a non-`Backend/` CWD with real secrets configured
  - Verify the server throws a descriptive error when placeholder secrets are present
  - Ask the user if any questions arise during final validation

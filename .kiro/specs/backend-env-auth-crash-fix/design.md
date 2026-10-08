# Backend Env & Auth Crash Bugfix Design

## Overview

Three related configuration bugs cause the SourceUp CRM backend to crash on startup or behave
insecurely at runtime. The fix targets `Backend/.env.local`, `Backend/loadEnv.js`, and
`Backend/MongoDB/Connection.js`. No business logic changes are required; all three fixes are
purely configuration and path-resolution corrections with a single defensive guard added to
`server.js`.

The bugs and their fixes:

| # | Bug | Root Cause | Fix |
|---|-----|------------|-----|
| 1 | Placeholder JWT secrets | `.env.local` ships with literal placeholder strings | Replace with real secrets; add startup guard in `server.js` |
| 2 | CWD-dependent env loading | `loadEnv.js` uses CWD-relative `existsSync("./.env.local")` | Resolve path from `import.meta.url` (file-relative) |
| 3 | Incomplete `MONGODB_URI` | URI lacks the database name segment | Embed full URI in `.env.local`; remove string concat in `Connection.js` |

---

## Glossary

- **Bug_Condition (C)**: The condition that identifies an input that triggers one of the three
  bugs — placeholder secret values, a non-`Backend/` CWD, or a URI without a database name.
- **Property (P)**: The desired correct behavior when the bug condition holds — tokens are
  signed securely, env vars are always loaded, and the DB URI is always complete.
- **Preservation**: All existing correct behaviors that must remain unchanged after the fix —
  normal startup from `Backend/`, token sign/verify flows, role-based access control, and DB
  connectivity when given a valid URI.
- **`loadEnv.js`**: The module at `Backend/loadEnv.js` that must be the first import in
  `server.js`; it calls `dotenv.config()` to populate `process.env`.
- **`Connection.js`**: The module at `Backend/MongoDB/Connection.js` that calls
  `mongoose.connect()`.
- **`DBname`**: The constant `"SourceUpCRM"` exported from `Backend/MongoDB/constants.js`.
- **`import.meta.url`**: The ESM URL of the currently executing module file; used to derive
  an absolute, CWD-independent file path.
- **`fileURLToPath`**: Node.js utility that converts a `file://` URL to an OS path.

---

## Bug Details

### Bug 1 — Placeholder JWT Secrets

The bug manifests when either `ACCESS_TOKEN_SECRET` or `REFRESH_TOKEN_SECRET` in `.env.local`
still holds the literal placeholder value shipped with the project. The `generateAccessToken`
and `generateRefreshToken` methods in `User.schema.js` call `jwt.sign()` with these values;
`VerifyJWT` calls `jwt.verify()` with `ACCESS_TOKEN_SECRET`. Operating with a publicly known
placeholder makes every issued token trivially forgeable.

**Formal Specification:**

```
FUNCTION isBugCondition_PlaceholderSecrets(env)
  INPUT: env of type EnvironmentConfig
  OUTPUT: boolean

  RETURN env.ACCESS_TOKEN_SECRET = "replace_with_access_token_secret"
      OR env.REFRESH_TOKEN_SECRET = "replace_with_refresh_token_secret"
END FUNCTION
```

**Examples:**

- `.env.local` is committed to source control with default values → all tokens share a
  known-public signing key; any attacker can forge valid JWTs.
- A developer resets `.env.local` from the template → all previously issued tokens are
  immediately invalidated because the secret changed, producing 401 errors for active sessions.
- A new deployment forgets to set real secrets → `jwt.sign` still succeeds (no crash), but
  security is silently broken.

---

### Bug 2 — CWD-Dependent Env Loading

The bug manifests when `node` is invoked from any directory other than `Backend/`. The
`existsSync("./.env.local")` call in `loadEnv.js` resolves `"./.env.local"` relative to
`process.cwd()`, not to the file itself. If CWD is the repo root or any other directory,
neither `.env.local` nor `.env` is found, `dotenv.config()` is a no-op, and all
`process.env` secrets remain `undefined`.

**Formal Specification:**

```
FUNCTION isBugCondition_CWDEnvLoad(cwd)
  INPUT: cwd of type FilePath (the process working directory at startup)
  OUTPUT: boolean

  // Bug triggers when the process CWD does not equal the Backend/ directory
  RETURN resolve(cwd, ".env.local") != resolve(fileDir(loadEnv.js), ".env.local")
END FUNCTION
```

**Examples:**

- `node Backend/server.js` run from the repo root → `existsSync("./.env.local")` checks
  `<repo-root>/.env.local`, which does not exist → `dotenv.config()` loads nothing →
  `process.env.ACCESS_TOKEN_SECRET` is `undefined` → `jwt.sign()` throws → server crash.
- `node Backend/server.js` run from `Backend/` → works correctly (non-bug path).
- A CI pipeline runs `node server.js` from a temp directory → same crash as the first case.

---

### Bug 3 — Incomplete `MONGODB_URI`

The bug manifests when `MONGODB_URI=mongodb://127.0.0.1:27017` (no database name). `Connection.js`
currently works around this by concatenating `/${DBname}`, but this makes the env value
non-self-contained and brittle: any future caller that uses `MONGODB_URI` directly (e.g., a
migration script, a test harness, or a different ORM) will connect to the wrong database.

**Formal Specification:**

```
FUNCTION isBugCondition_IncompleteURI(uri)
  INPUT: uri of type String
  OUTPUT: boolean

  // Bug triggers when the URI string has no database-name path component
  RETURN uri does not match pattern "mongodb://[host]:[port]/[dbname]"
      OR uri ends with "27017" with no "/" after the port
END FUNCTION
```

**Examples:**

- `MONGODB_URI=mongodb://127.0.0.1:27017` → `Connection.js` appends `/SourceUpCRM` at
  runtime → works, but only because of the workaround in one specific file.
- A developer writes a standalone seed script and reads `process.env.MONGODB_URI` directly →
  connects to the default `test` database → silent data loss.
- `DBname` constant is renamed → the concatenated URI silently points to a new database.

---

## Expected Behavior

### Preservation Requirements

The following behaviors must remain completely unchanged after all three fixes are applied:

**Unchanged Behaviors:**

- Starting the server from `Backend/` with a correctly configured `.env.local` continues to
  load env vars and start the HTTP server on the configured port.
- `User.generateAccessToken()` and `User.generateRefreshToken()` continue to produce signed
  JWTs using the values in `process.env`.
- `VerifyJWT` middleware continues to decode a valid access token, fetch the user by `_id`,
  check `isActive`, attach `req.user`, and call `next()`.
- A missing, expired, or malformed token continues to produce a 401 Unauthorized response.
- `isActive = false` continues to produce a 403 Forbidden response.
- `requireRole` continues to enforce role-based access and return 403 on mismatch.
- `mongoose.connect()` called with a valid URI continues to connect to `SourceUpCRM` and
  seed service prefixes on startup.
- All existing routes, controllers, and middleware are unaffected — only the three specific
  files listed in Fix Implementation are changed.

**Scope:** All inputs that do NOT involve placeholder secrets, a non-`Backend/` CWD, or a
URI without a database name are completely unaffected by this fix.

---

## Hypothesized Root Cause

### Bug 1

1. **Template values left in place**: The `.env.local` file was bootstrapped from a template
   that used obviously named placeholders as reminders to fill in real values before running.
   No validation guard was added to catch the case where a developer skips this step.

2. **No startup enforcement**: `server.js` starts the application without checking whether
   secrets are still placeholders, so the system silently operates in an insecure state.

### Bug 2

1. **CWD-relative `existsSync` call**: `existsSync("./.env.local")` resolves against
   `process.cwd()` at runtime, not against the directory where `loadEnv.js` lives. This is
   correct only when CWD happens to be `Backend/`.

2. **No error thrown on missing env file**: When neither `.env.local` nor `.env` is found,
   `dotenv.config()` silently does nothing. The bug only surfaces later when `jwt.sign()` or
   `mongoose.connect()` encounters `undefined` secrets/URIs.

### Bug 3

1. **Partial URI in env, workaround in code**: The env value was written without a database
   name and `Connection.js` was written to compensate by appending `/${DBname}`. This couples
   the env variable to a specific code path rather than making the env value self-describing.

2. **`DBname` constant is now redundant**: Once the full URI is in the env, the `constants.js`
   file and the `/${DBname}` interpolation in `Connection.js` serve no purpose and can be
   removed to eliminate the coupling.

---

## Correctness Properties

Property 1: Bug Condition — Placeholder Secrets Are Rejected at Startup

_For any_ environment where `isBugCondition_PlaceholderSecrets(env)` returns `true`, the
fixed `server.js` startup guard SHALL throw an error with a descriptive message and halt the
process before the HTTP server starts, preventing insecure token operations.

**Validates: Requirements 2.1, 2.2, 2.3**

---

Property 2: Bug Condition — Env File Is Loaded Regardless of CWD

_For any_ working directory where `isBugCondition_CWDEnvLoad(cwd)` returns `true` (i.e., CWD
is not `Backend/`), the fixed `loadEnv.js` SHALL resolve the env file path relative to its
own file location using `import.meta.url`, load the file successfully, and populate
`process.env` so that no downstream module receives `undefined` secrets or URIs.

**Validates: Requirements 2.4, 2.5, 2.6, 2.7**

---

Property 3: Bug Condition — `MONGODB_URI` Is Self-Contained

_For any_ environment where `isBugCondition_IncompleteURI(uri)` returns `true`, the fixed
`.env.local` SHALL contain a complete URI including the `/SourceUpCRM` database name, and
the fixed `Connection.js` SHALL use `process.env.MONGODB_URI` directly without any
string concatenation.

**Validates: Requirements 2.8**

---

Property 4: Preservation — Normal Startup and Auth Flows Are Unchanged

_For any_ input where none of the three bug conditions holds (real secrets, correct CWD or
file-relative resolution, complete URI), the fixed code SHALL produce exactly the same
observable behavior as the original code — the same tokens, the same middleware decisions,
the same DB connection, and the same HTTP responses.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

---

## Fix Implementation

### Changes Required

#### File 1: `Backend/.env.local`

**Specific Changes:**

1. **Replace `ACCESS_TOKEN_SECRET`**: Change from `replace_with_access_token_secret` to a
   real 64-byte hex secret. Generate with:
   ```
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Replace `REFRESH_TOKEN_SECRET`**: Same as above — generate a separate 64-byte hex secret.

3. **Update `MONGODB_URI`**: Change from `mongodb://127.0.0.1:27017` to
   `mongodb://127.0.0.1:27017/SourceUpCRM` so the value is a complete, standalone connection
   string.

> **Note:** `.env.local` is in `.gitignore`. The generated secrets must never be committed to
> source control. Developers cloning the repo should generate their own secrets using the
> command above.

---

#### File 2: `Backend/loadEnv.js`

**Specific Changes:**

1. **Import `fileURLToPath` and `path`**: Add `import { fileURLToPath } from "url"` and
   `import path from "path"`.

2. **Derive `__dirname` equivalent**: Use
   `const __dirname = path.dirname(fileURLToPath(import.meta.url))` to get the absolute
   directory of `loadEnv.js` itself.

3. **Replace CWD-relative paths with file-relative paths**:
   - Before: `existsSync("./.env.local")`
   - After: `existsSync(path.resolve(__dirname, ".env.local"))`
   - Before: `config({ path: envFile })` where `envFile` was `"./.env.local"` or `"./.env"`
   - After: Use `path.resolve(__dirname, ".env.local")` and `path.resolve(__dirname, ".env")`
     respectively.

---

#### File 3: `Backend/MongoDB/Connection.js`

**Specific Changes:**

1. **Remove `DBname` import**: Delete `import { DBname } from "./constants.js"` — no longer
   needed.

2. **Use `MONGODB_URI` directly**: Change
   `mongoose.connect(\`${process.env.MONGODB_URI}/${DBname}\`)` to
   `mongoose.connect(process.env.MONGODB_URI)`.

---

#### File 4: `Backend/server.js`

**Specific Changes:**

1. **Add a startup guard after the `loadEnv` import** that checks for placeholder values and
   throws immediately if either secret is still a placeholder:

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

---

## Testing Strategy

### Validation Approach

Testing follows a two-phase approach:
1. **Exploratory** — run tests against the **unfixed** code to surface concrete counterexamples
   that confirm each root cause hypothesis.
2. **Fix + Preservation** — after applying the fix, run the same tests to verify correct
   behavior, then run preservation tests to confirm no regressions.

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fix.
Confirm or refute each root cause hypothesis.

**Test Plan**: Write tests that simulate the three bug conditions and assert the expected
correct behavior. Run these on the **unfixed** code to observe failures.

**Test Cases:**

1. **Placeholder Secret Guard (Bug 1)**: Start the app with placeholder secrets and assert
   that the process throws before binding the HTTP port. *(Will fail on unfixed code — no
   guard exists yet.)*

2. **CWD Env Load from Repo Root (Bug 2)**: Call `loadEnv.js` with `process.cwd()` set to the
   repo root and assert that `process.env.ACCESS_TOKEN_SECRET` is defined afterward.
   *(Will fail on unfixed code — env file is not found.)*

3. **JWT Sign with Undefined Secret (Bug 2, downstream)**: Call `User.generateAccessToken()`
   when `process.env.ACCESS_TOKEN_SECRET` is `undefined` and assert no throw occurs.
   *(Will fail on unfixed code — `jwt.sign` throws a synchronous error.)*

4. **Incomplete URI Direct Use (Bug 3)**: Read `process.env.MONGODB_URI` and assert it
   contains `/SourceUpCRM`. *(Will fail on unfixed code — URI ends at port 27017.)*

**Expected Counterexamples:**

- No startup error is thrown despite placeholder secrets being set.
- `process.env.ACCESS_TOKEN_SECRET` is `undefined` after loading from a non-`Backend/` CWD.
- `process.env.MONGODB_URI` does not contain a database name path component.

---

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed code produces
the expected correct behavior.

**Pseudocode:**

```
// Bug 1
FOR ALL env WHERE isBugCondition_PlaceholderSecrets(env) DO
  result := startServer(env)
  ASSERT result.threw_before_listen = true
  ASSERT result.error_message contains "placeholder"
END FOR

// Bug 2
FOR ALL cwd WHERE isBugCondition_CWDEnvLoad(cwd) DO
  result := loadEnv'(cwd)
  ASSERT process.env.ACCESS_TOKEN_SECRET != undefined
  ASSERT process.env.MONGODB_URI != undefined
END FOR

// Bug 3
FOR ALL uri WHERE isBugCondition_IncompleteURI(uri) DO
  // env is fixed; this tests Connection.js directly
  ASSERT process.env.MONGODB_URI matches "mongodb://[host]:[port]/SourceUpCRM"
  ASSERT Connection.js does NOT append "/${DBname}"
END FOR
```

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed code
produces the same observable behavior as the original code.

**Pseudocode:**

```
FOR ALL inputs WHERE NOT any_bug_condition(inputs) DO
  ASSERT server_start_original(inputs) = server_start_fixed(inputs)  // same startup behavior
  ASSERT jwt_sign_original(payload)    = jwt_sign_fixed(payload)      // same token output
  ASSERT verify_jwt_original(token)    = verify_jwt_fixed(token)      // same auth decisions
  ASSERT db_connect_original(uri)      = db_connect_fixed(uri)        // same DB connection
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation of the JWT and
middleware paths because:
- It generates many token shapes, payloads, and role combinations automatically.
- It catches edge cases (very short expiry, non-ASCII claims, missing `_id`) that manual
  tests miss.
- It gives strong guarantees that auth behavior is unchanged across the full input space.

**Test Cases:**

1. **Normal Startup Preservation**: Start server from `Backend/` with real secrets — assert
   it binds on the configured port (same as before).
2. **Token Round-Trip Preservation**: Generate an access token and verify it with `VerifyJWT`
   — assert `req.user._id` matches (same as before).
3. **Expired Token Preservation**: Provide an expired token — assert 401 is returned (same
   as before).
4. **Inactive User Preservation**: Provide a valid token for `isActive = false` user — assert
   403 (same as before).
5. **Role Check Preservation**: Provide a token whose `role` is not in `requireRole(...)` —
   assert 403 (same as before).
6. **DB Connect Preservation**: Call `connectDB()` with the complete URI — assert connection
   succeeds and targets `SourceUpCRM` database (same database as before).

---

### Unit Tests

- Test `loadEnv.js` resolves the env file path from its own directory, not from CWD.
- Test `loadEnv.js` loads the correct file when CWD is the repo root, `Backend/`, and a temp
  directory.
- Test the `server.js` startup guard throws with a descriptive message when either secret is
  a placeholder.
- Test the `server.js` startup guard does NOT throw when both secrets are non-placeholder
  values.
- Test `Connection.js` calls `mongoose.connect()` with exactly `process.env.MONGODB_URI` and
  no appended string.
- Test edge cases: `ACCESS_TOKEN_SECRET` is empty string, `undefined`, or partial placeholder.

---

### Property-Based Tests

- Generate random working directory paths and verify `loadEnv.js` always resolves to the
  same absolute env file path (file-relative, not CWD-relative).
- Generate random string values for `ACCESS_TOKEN_SECRET` (never the placeholder) and verify
  `jwt.sign()` + `jwt.verify()` round-trip succeeds without error.
- Generate random `{_id, username, email, role}` payloads and verify the decoded token
  payload matches the input after a sign/verify round-trip.
- Generate random role values and verify `requireRole` grants access only when the user's
  role is in the allowed list, across many role combinations.

---

### Integration Tests

- Start the full server from the repo root (non-`Backend/` CWD) with the fixed `loadEnv.js`
  and verify the health endpoint responds.
- Complete a login flow end-to-end: POST `/auth/login` → receive tokens → GET a protected
  route with the access token → verify 200 response.
- Verify that `connectDB()` with the updated `MONGODB_URI` establishes a connection to the
  `SourceUpCRM` database (not the default `test` database).
- Simulate a server restart with placeholder secrets still set and verify the process exits
  before the port is bound.

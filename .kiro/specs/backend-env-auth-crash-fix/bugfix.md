# Bugfix Requirements Document

## Introduction

The Node.js/Express CRM backend crashes or behaves incorrectly due to three related environment and authentication configuration bugs. These bugs affect JWT token generation and verification, server startup, and database connectivity. Together they cause 401 Unauthorized errors on all authenticated routes, fatal server crashes when the process is started from a non-standard working directory, and fragile database connection configuration.

The three bugs are:
1. **Placeholder JWT secrets** — `.env.local` contains literal placeholder strings for `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` instead of real cryptographic secrets, causing JWT operations to be insecure and any env reset to invalidate all tokens.
2. **CWD-dependent env loading** — `loadEnv.js` uses a relative path (`"./.env.local"`) to locate the env file, so if the server is started from any directory other than `Backend/`, the env file is silently not found, `process.env` stays empty, and the server crashes fatally.
3. **Incomplete `MONGODB_URI`** — `.env.local` defines `MONGODB_URI` without the database name, relying entirely on runtime string concatenation in `Connection.js` to produce a valid URI, making the configuration fragile.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — Placeholder JWT secrets:**

1.1 WHEN `ACCESS_TOKEN_SECRET` is set to the literal string `replace_with_access_token_secret` THEN the system signs JWT access tokens with a publicly known placeholder value, rendering token security ineffective

1.2 WHEN `REFRESH_TOKEN_SECRET` is set to the literal string `replace_with_refresh_token_secret` THEN the system signs JWT refresh tokens with a publicly known placeholder value, rendering token security ineffective

1.3 WHEN the environment is reset or redeployed with fresh placeholder values THEN the system invalidates all previously issued tokens, causing all authenticated routes to return 401 crashes for active users

**Bug 2 — CWD-dependent env loading:**

2.1 WHEN the server process is started from a directory other than `Backend/` (e.g., the repo root) THEN `existsSync("./.env.local")` returns `false` because the relative path does not resolve to the correct file location

2.2 WHEN `existsSync("./.env.local")` returns `false` THEN the system silently falls back to `dotenv.config({ path: "./.env" })`, which also does not exist, leaving `process.env` entirely empty

2.3 WHEN `process.env.ACCESS_TOKEN_SECRET` is `undefined` at JWT sign/verify time THEN `jsonwebtoken` throws a fatal synchronous error, crashing the server process

2.4 WHEN `process.env.MONGODB_URI` is `undefined` THEN `mongoose.connect()` fails with a connection error, triggering `process.exit(1)` and crashing the server

**Bug 3 — Incomplete `MONGODB_URI`:**

3.1 WHEN `MONGODB_URI` is defined as `mongodb://127.0.0.1:27017` without a database name THEN the env value alone does not represent a complete, usable MongoDB connection string

3.2 WHEN the database-name appending logic in `Connection.js` is removed or changed THEN the system connects to the wrong database or fails to connect entirely, causing data loss or connection errors

---

### Expected Behavior (Correct)

**Bug 1 — Placeholder JWT secrets:**

2.1 WHEN `ACCESS_TOKEN_SECRET` is set to a real cryptographically strong secret THEN the system SHALL sign JWT access tokens with a secure, unpredictable value

2.2 WHEN `REFRESH_TOKEN_SECRET` is set to a real cryptographically strong secret THEN the system SHALL sign JWT refresh tokens with a secure, unpredictable value

2.3 WHEN the environment configuration is updated THEN the system SHALL maintain stable token validation for all previously issued tokens until their natural expiry, without causing 401 crashes for active users

**Bug 2 — CWD-dependent env loading:**

2.4 WHEN the server process is started from any working directory THEN `loadEnv.js` SHALL resolve the path to `.env.local` relative to its own file location (i.e., using `import.meta.url` and `path.resolve`), not relative to the process's CWD

2.5 WHEN the resolved `.env.local` file exists THEN the system SHALL load it successfully regardless of where `node` was invoked from

2.6 WHEN `process.env.ACCESS_TOKEN_SECRET` is defined THEN `jsonwebtoken` SHALL sign and verify tokens without throwing

2.7 WHEN `process.env.MONGODB_URI` is defined THEN `mongoose.connect()` SHALL establish the database connection and the server SHALL start successfully

**Bug 3 — Incomplete `MONGODB_URI`:**

2.8 WHEN `MONGODB_URI` is defined in `.env.local` THEN the system SHALL include the full database name in the URI value (e.g., `mongodb://127.0.0.1:27017/SourceUpCRM`) so the env value is a complete, standalone connection string

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the server is started from the `Backend/` directory with a valid `.env.local` THEN the system SHALL CONTINUE TO load environment variables correctly and start successfully

3.2 WHEN a user provides correct credentials THEN the system SHALL CONTINUE TO generate a valid access token and refresh token and return them in the login response

3.3 WHEN a valid JWT access token is included in a request THEN `VerifyJWT` middleware SHALL CONTINUE TO decode it, fetch the user, and attach `req.user` before calling `next()`

3.4 WHEN a JWT access token is expired or malformed THEN the system SHALL CONTINUE TO return a 401 Unauthorized response

3.5 WHEN a user's `isActive` flag is `false` THEN `VerifyJWT` SHALL CONTINUE TO return a 403 Forbidden response

3.6 WHEN `mongoose.connect()` is called with a valid URI THEN the system SHALL CONTINUE TO connect to the `SourceUpCRM` database and seed service prefixes on startup

3.7 WHEN the `requireRole` middleware is used on a route THEN the system SHALL CONTINUE TO enforce role-based access control and return 403 if the user's role is not permitted

---

## Bug Condition Pseudocode

### Bug 1 — Placeholder JWT Secrets

```pascal
FUNCTION isBugCondition_PlaceholderSecrets(env)
  INPUT: env of type EnvironmentConfig
  OUTPUT: boolean

  RETURN env.ACCESS_TOKEN_SECRET = "replace_with_access_token_secret"
      OR env.REFRESH_TOKEN_SECRET = "replace_with_refresh_token_secret"
END FUNCTION

// Property: Fix Checking
FOR ALL env WHERE isBugCondition_PlaceholderSecrets(env) DO
  ASSERT env.ACCESS_TOKEN_SECRET != "replace_with_access_token_secret"
  ASSERT env.REFRESH_TOKEN_SECRET != "replace_with_refresh_token_secret"
  ASSERT length(env.ACCESS_TOKEN_SECRET) >= 32
  ASSERT length(env.REFRESH_TOKEN_SECRET) >= 32
END FOR

// Property: Preservation Checking
FOR ALL env WHERE NOT isBugCondition_PlaceholderSecrets(env) DO
  ASSERT jwt.sign(payload, env.ACCESS_TOKEN_SECRET) = F'(payload, env)
END FOR
```

### Bug 2 — CWD-Dependent Env Loading

```pascal
FUNCTION isBugCondition_CWDEnvLoad(cwd)
  INPUT: cwd of type FilePath
  OUTPUT: boolean

  // Bug triggers when process CWD is not the Backend/ directory
  RETURN resolve(cwd, ".env.local") != resolve(__dirname_of_loadEnv, ".env.local")
END FUNCTION

// Property: Fix Checking
FOR ALL cwd WHERE isBugCondition_CWDEnvLoad(cwd) DO
  result ← loadEnv'(cwd)
  ASSERT process.env.ACCESS_TOKEN_SECRET != undefined
  ASSERT process.env.MONGODB_URI != undefined
  ASSERT no_crash(result)
END FOR

// Property: Preservation Checking
FOR ALL cwd WHERE NOT isBugCondition_CWDEnvLoad(cwd) DO
  ASSERT loadEnv(cwd) = loadEnv'(cwd)
END FOR
```

### Bug 3 — Incomplete MONGODB_URI

```pascal
FUNCTION isBugCondition_IncompleteURI(uri)
  INPUT: uri of type String
  OUTPUT: boolean

  // Bug triggers when URI has no database name segment
  RETURN uri does not contain "/<dbname>" path component
END FUNCTION

// Property: Fix Checking
FOR ALL uri WHERE isBugCondition_IncompleteURI(uri) DO
  fixed_uri ← uri + "/SourceUpCRM"
  ASSERT fixed_uri contains "/SourceUpCRM"
  ASSERT mongoose.connect(fixed_uri) succeeds
END FOR

// Property: Preservation Checking
FOR ALL uri WHERE NOT isBugCondition_IncompleteURI(uri) DO
  ASSERT Connection.js uses uri as-is without double-appending the DB name
END FOR
```

# Audit Bugfix Sweep Bugfix Design

## Overview

This design covers the seven in-scope audit findings (H2, M1, M2, M3, M4, M5, L2) for the SourceUpCRM stack (Node/Express + MongoDB backend, React/Vite frontend). Each fix is intentionally minimal and scoped to the exact file/function that contains the defect, with explicit regression-prevention notes tied to the unchanged-behavior clauses in the requirements.

H1 (Vendor AuditLog `performedBy` → `userId`) is out of scope because it is already fixed in the codebase; no design or task is created for it so the already-correct code is not regressed.

The general strategy is a targeted edit per bug, with two cross-cutting rules applied where they matter:
- **RBAC consistency (M3/M4)**: the frontend permission checks and backend `requireRole` arrays MUST describe the same set of allowed roles, so the UI never renders an action the API will reject with a guaranteed 403.
- **Behavior-preserving refactors (M5/L2)**: M5 (cookieOptions placement) and L2 (dead `DEV_BYPASS` path) change code structure only; runtime behavior must be byte-for-byte identical to the current behavior.

Four bugs carry a recommended option and an alternative (H2, M2, M3, M4). The Expected Behavior and Correctness Properties are written for the recommended option; the alternative is noted inline so it can be confirmed during review. Whichever option is chosen for M3/M4, frontend and backend MUST agree.

## Glossary

- **Bug_Condition (C)**: the condition that triggers the bug — the set of inputs/states where the current code behaves incorrectly (or, for M5/L2, where the maintainability/dead-code defect is present).
- **Property (P)**: the desired behavior for inputs that satisfy C — what the fixed function SHALL produce.
- **Preservation (¬C)**: all inputs/states that do NOT satisfy C; the fixed code SHALL behave identically to the original here.
- **F**: the original (unfixed) function/handler/component.
- **F'**: the fixed function/handler/component.
- **`register`**: the registration handler in `Backend/Controllers/Auth.controller.js` that creates a user and writes an `AuditLog` `REGISTER` entry.
- **`login` / `logout`**: the auth handlers in `Backend/Controllers/Auth.controller.js` that set/clear `accessToken`/`refreshToken` cookies and write `AuditLog` `LOGIN`/`LOGOUT` entries.
- **`cookieOptions`**: the `{ httpOnly, secure, sameSite }` object shared (duplicated) by `login` and `logout`.
- **`requireRole(...roles)`**: the RBAC middleware in `Backend/Middleware/Auth.middleware.js`; it throws `403` unless `roles.includes(req.user.role)`.
- **DealDetail load effect**: the `useEffect` in `Frontend/src/Pages/DealDetail.jsx` that fetches the deal (`getDealById`) then the linked POs (`getPOs`).
- **`AddDealModal`**: the modal in `Frontend/src/Pages/Deals.jsx` whose lead dropdown fetches `getLeads({ limit: 100 })`.
- **`PortalDropdown`**: the existing static-options dropdown component in `Frontend/src/components/PortalDropdown.jsx` (no built-in search).
- **`canEdit` (Vendors)**: the role-permission expression in `Frontend/src/Pages/Vendors.jsx` that gates the Edit button.
- **`AuthProvider`**: the context provider in `Frontend/src/context/Authcontext.jsx` that runs the real auth flow.

## Bug Details

### Bug Condition

The sweep's bug condition is the union of seven independent conditions. The current system is defective for an input/state `X` when ANY of the following holds:

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input — an HTTP request, a page load/render, or a UI interaction
  OUTPUT: boolean

  RETURN
    // H2 — self-service superadmin registration when users already exist
    ( input.kind = "HTTP_REQUEST"
      AND input.method = "POST"
      AND input.path = "/api/v1/auth/register"
      AND User.countDocuments() > 0 )

    // M1 — DealDetail loads the deal but the linked-PO fetch rejects
    OR ( input.kind = "DEAL_DETAIL_LOAD"
      AND getDealById(input.id) RESOLVES
      AND getPOs({ dealId: input.id }) REJECTS )

    // M2 — Add Deal lead dropdown populated while more than 100 leads exist
    OR ( input.kind = "ADD_DEAL_LEAD_DROPDOWN"
      AND Lead.countDocuments() > 100 )

    // M3 — a manager sends PATCH /leads/:id
    OR ( input.kind = "HTTP_REQUEST"
      AND input.method = "PATCH"
      AND input.path matches "/api/v1/leads/:id"
      AND input.user.role = "manager" )

    // M4 — a purchase user is offered the Vendor Edit action
    OR ( input.kind = "VENDOR_EDIT_OFFER"
      AND input.user.role = "purchase" )

    // M5 — login or logout builds cookies via the misplaced cookieOptions
    OR ( input.kind = "HTTP_REQUEST"
      AND input.method IN ["POST", "GET"]
      AND input.path IN ["/api/v1/auth/login", "/api/v1/auth/logout"] )

    // L2 — the auth context initializes with the dead DEV_BYPASS path present
    OR ( input.kind = "AUTH_CONTEXT_INIT" )
END FUNCTION
```

Note on M5/L2: these are always-present structural defects (not input-conditional runtime failures). Their condition covers every login/logout (M5) and every app initialization (L2); the fix asserts identical runtime behavior, not a changed outcome.

### Examples

- **H2**: With one user already in the DB, `POST /api/v1/auth/register` with valid `{ username, email, password }` → currently creates a new `superadmin` (200/201); expected → `403 "Registration is closed…"`. With zero users (bootstrap), the same request → currently and expected → creates the first `superadmin` (3.1).
- **M1**: `getDealById("6…1")` resolves to a real deal; `getPOs({ dealId: "6…1" })` rejects (500/network). Currently the page shows "Deal not found" (the stale `!deal` is `true`); expected → the deal renders and a non-fatal "could not load linked POs" warning is shown instead.
- **M2**: 250 leads exist. User opens Add Deal → the dropdown lists only the first 100; lead #150 is unselectable. Expected → user can type to search and select any of the 250 leads.
- **M3**: A `manager` sends `PATCH /api/v1/leads/6…9` → currently `403`; expected → `200` (update applied), matching the manager's ability to edit deals.
- **M4**: A `purchase` user opens Vendors → the Edit button currently renders; clicking it → `PATCH` returns `403`. Expected → the Edit button is not offered to `purchase` users.
- **M5**: A successful `POST /api/v1/auth/login` currently sets both cookies with `{ httpOnly, secure, sameSite }` — works, but `cookieOptions` is declared mid-handler with misaligned indentation. Expected → identical cookies/responses with `cookieOptions` declared cleanly above the response.
- **L2**: On app load, `AuthProvider` currently runs the real flow because `DEV_BYPASS` is `false`, but ships `DEV_USER` and the bypass ternaries. Expected → real flow only; identical user/loading state.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors (mapped to requirements clauses):**

- **H2**: The bootstrap first-user path (zero users) MUST still create a `superadmin` and return it (3.1). Invalid input MUST still return validation errors without creating a user (3.2). A successful bootstrap registration MUST still write the `AuditLog` `REGISTER` entry (3.3).
- **M1**: When the deal fetch itself fails (genuinely missing deal), the deal-not-found state MUST still show (3.4). When both deal and PO fetches succeed, the deal and linked POs MUST render as before (3.5).
- **M2**: With 100 or fewer leads and no search term, the dropdown MUST still populate and auto-fill the customer name from the selected lead (3.6).
- **M3**: `sales`/`superadmin` MUST still be accepted on `PATCH /leads/:id`; `purchase` (and any other role) MUST still be rejected with `403` (3.7). Lead view/create/note/history permissions MUST remain unchanged (3.8).
- **M4**: `manager`/`superadmin` MUST still be able to edit vendors; `sales` (and, after the fix, `purchase`) MUST still be rejected with `403` (3.9). `canCreate` behavior MUST remain unchanged — only the Edit/`purchase` mismatch is changed (3.10).
- **M5**: Login/logout MUST still set/clear the same cookies with the same attributes (`httpOnly`, `secure`, `sameSite`) and return the same responses (3.11). The `AuditLog` `LOGIN`/`LOGOUT` entries MUST still be written (3.12).
- **L2**: An unauthenticated user MUST still call `getCurrentUser`, set `null` on failure, and show the login flow (3.13). Login/logout MUST still use the real `LoginUser`/`LogoutUser` calls and update user state (3.14).

**Scope:**
All inputs/states that do NOT satisfy `isBugCondition` MUST be completely unaffected. This includes: valid bootstrap registration, non-registration auth flows, DealDetail when the PO fetch succeeds, Add Deal with ≤100 leads, `sales`/`superadmin` lead edits, `manager`/`superadmin` vendor edits, all non-auth backend routes, and every page whose RBAC is not touched by M3/M4.

## Hypothesized Root Cause

1. **H2 — disabled bootstrap guard + hardcoded role**: In `register`, the `existingUsers > 0` guard is commented out (a leftover "Allow multiple superadmin accounts during development" TODO) and `User.create` hardcodes `role: "superadmin"`. Without the guard, every caller of the discovered endpoint becomes superadmin. The hardcoded role is correct ONLY for the bootstrap user; the missing guard is the actual security hole.
2. **M1 — stale-closure error gate**: The shared `.catch` reads `if (!deal)`, but `deal` is captured from the render in which the effect ran (`null` on first mount). After `getDealById` resolves and `setDeal` schedules a state update, the running effect's closure still sees the old `null`, so a PO-fetch rejection is always misreported as "Deal not found". There is no separate state for the PO error.
3. **M2 — fixed-limit fetch with no search**: `AddDealModal` calls `getLeads({ limit: 100 })` and feeds the result into a static `PortalDropdown`. The backend `getLeads` caps `limit` at `100` (`Math.min(100, …)`), so even raising the client limit cannot exceed 100; with more leads the tail is silently dropped and unselectable.
4. **M3 — RBAC omission**: `Lead.routes.js` `PATCH /:id` uses `requireRole("sales", "superadmin")`, omitting `manager`, even though the parallel `Deal.routes.js` `PATCH /:id` allows `("sales", "manager", "superadmin")`. The omission is most likely unintentional.
5. **M4 — frontend/backend RBAC drift**: `Vendors.jsx` `canEdit` includes `"purchase"` so the Edit button renders, but `Vendor.routes.js` `PATCH /:id` allows only `manager`/`superadmin`, so a `purchase` click is a guaranteed `403`. `canCreate` (which includes `purchase`) is a separate permission and is not the defect.
6. **M5 — cut-paste declaration placement**: `cookieOptions` is declared mid-handler (after `bcrypt`/user lookups in `login`, after the token-unset/AuditLog in `logout`) with misaligned indentation, reading like a paste artifact. Functionally harmless today but a maintainability risk.
7. **L2 — dormant dev-bypass path**: `Authcontext.jsx` ships `DEV_BYPASS = false`, a `DEV_USER` superadmin mock, and the `DEV_BYPASS ? DEV_USER : null` / `useState(!DEV_BYPASS)` / `if (DEV_BYPASS) return` ternaries. The real flow already runs because the constant is `false`, but a dormant superadmin-bypass path remains in production code.

## Correctness Properties

Property 1: Bug Condition - H2 Self-Service Superadmin Registration

_For any_ `POST /api/v1/auth/register` where one or more users already exist (isBugCondition holds for H2), the fixed `register` handler SHALL reject the request with `403` so no new superadmin account is self-created.

**Validates: Requirements 2.1**

Property 2: Preservation - H2 Bootstrap and Validation

_For any_ registration request where the H2 bug condition does NOT hold (zero users exist, or the input is invalid), the fixed `register` handler SHALL produce the same result as the original: creating the first `superadmin` on bootstrap, returning the existing validation errors for invalid input without creating a user, and writing the `REGISTER` AuditLog on success.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 3: Bug Condition - M1 Linked-PO Fetch Error

_For any_ DealDetail load where the deal fetch resolves but the linked-PO fetch rejects (isBugCondition holds for M1), the fixed page SHALL surface the PO-fetch error without reporting "Deal not found", and the deal SHALL still render.

**Validates: Requirements 2.2**

Property 4: Preservation - M1 Deal-Not-Found and Success

_For any_ DealDetail load where the M1 bug condition does NOT hold (the deal fetch fails, or both fetches succeed), the fixed page SHALL produce the same result as the original: showing the deal-not-found state only when the deal fetch fails, and rendering the deal with its linked POs when both succeed.

**Validates: Requirements 3.4, 3.5**

Property 5: Bug Condition - M2 Lead Dropdown Truncation

_For any_ Add Deal lead dropdown opened while more than 100 leads exist (isBugCondition holds for M2), the fixed dropdown SHALL allow the user to find and select any lead with no silent truncation.

**Validates: Requirements 2.3**

Property 6: Preservation - M2 Small Lead Set and Auto-Fill

_For any_ Add Deal interaction where the M2 bug condition does NOT hold (100 or fewer leads, and/or a search term is applied), the fixed modal SHALL populate the dropdown and auto-fill the customer name from the selected lead exactly as before.

**Validates: Requirements 3.6**

Property 7: Bug Condition - M3 Manager Lead Edit

_For any_ `PATCH /api/v1/leads/:id` from a `manager` (isBugCondition holds for M3), the fixed route SHALL accept the update by including `"manager"` in `requireRole`, making lead editing consistent with deal editing.

**Validates: Requirements 2.4**

Property 8: Preservation - M3 Other Roles and Lead Operations

_For any_ `PATCH /api/v1/leads/:id` where the M3 bug condition does NOT hold (caller is `sales`/`superadmin`, or a non-allowed role such as `purchase`), the fixed route SHALL produce the same result as the original: accepting `sales`/`superadmin` and rejecting others with `403`. All other lead operations (view, create, notes, history) SHALL remain unchanged.

**Validates: Requirements 3.7, 3.8**

Property 9: Bug Condition - M4 Purchase Vendor Edit Offer

_For any_ Vendors page render for a `purchase` user (isBugCondition holds for M4), the fixed page SHALL NOT offer the Edit action, so no UI leads to a guaranteed `403`.

**Validates: Requirements 2.5**

Property 10: Preservation - M4 Manager/Superadmin Edits and canCreate

_For any_ vendor edit where the M4 bug condition does NOT hold (caller is `manager`/`superadmin`, or a non-allowed role such as `sales`/`purchase`), the fixed system SHALL produce the same result as the original: accepting `manager`/`superadmin` and rejecting others with `403`. The `canCreate` permission SHALL remain unchanged.

**Validates: Requirements 3.9, 3.10**

Property 11: Bug Condition - M5 Cookie Options Placement

_For any_ login or logout request (isBugCondition holds for M5), the fixed handlers SHALL build `cookieOptions` with the declaration placed clearly above the cookie response and with correct indentation, while producing identical cookie attributes and responses.

**Validates: Requirements 2.6**

Property 12: Preservation - M5 Identical Cookie/Auth Behavior

_For any_ login or logout request, the fixed handlers SHALL set/clear the `accessToken` and `refreshToken` cookies with the same `httpOnly`/`secure`/`sameSite` attributes and return the same responses as the original, and SHALL still write the `LOGIN`/`LOGOUT` AuditLog entries.

**Validates: Requirements 3.11, 3.12**

Property 13: Bug Condition - L2 Dead Dev-Bypass Removal

_For any_ auth context initialization (isBugCondition holds for L2), the fixed `AuthProvider` SHALL always run the real auth flow with no dormant `DEV_BYPASS`/`DEV_USER` path present.

**Validates: Requirements 2.7**

Property 14: Preservation - L2 Identical Runtime Behavior

_For any_ auth context initialization, the fixed `AuthProvider` SHALL produce the same user/loading/isWakingUp state and the same login/logout behavior as the original (which already runs the real flow because `DEV_BYPASS` is `false`), still calling `getCurrentUser`, setting `null` on failure, and using the real `LoginUser`/`LogoutUser` calls.

**Validates: Requirements 3.13, 3.14**

## Fix Implementation

### H2 — Re-enable the registration guard

**File**: `Backend/Controllers/Auth.controller.js`
**Function**: `register`
**Recommended decision**: re-enable the `existingUsers > 0` guard.

**Specific Changes**:
1. **Remove the commented-out guard and its dev/TODO comment**: delete the `// Allow multiple superadmin accounts during development. / TODO: re-enable this check before production deployment.` lines and the commented `if (existingUsers > 0) { … }` block.
2. **Re-enable the guard after format validation**: move `const existingUsers = await User.countDocuments();` and the guard to sit AFTER the `ValidPassword`/`ValidUserName`/`ValidEmail` validation block and BEFORE `User.create`. Placing it after validation means invalid input still surfaces its `400` validation error first (precisely preserving 3.2), and the DB count is only paid for valid input. For zero users (bootstrap) the guard passes and the first `superadmin` is created (3.1, 3.3).
3. **Keep `role: "superadmin"`** in `User.create` — it is correct for the bootstrap user, which is now the only user this handler can create.
4. **Add a one-line clarifying comment** above the guard, e.g. `// Bootstrap-only: the first user becomes superadmin; further accounts are created by a superadmin via /users.`

**Regression prevention**: 3.1 (zero users → first superadmin), 3.2 (invalid input → validation error, no user created), 3.3 (success → AuditLog). All preserved because validation order and the create+AuditLog path are unchanged; only the guard is inserted.

**Alternative (not recommended)**: default new registrations to a normal role and only allow superadmin creation via a superadmin-only `PATCH /users`. Larger blast radius; would also require touching the User routes. Noted for review.

### M1 — Split the DealDetail deal/PO fetch with a dedicated PO error state

**File**: `Frontend/src/Pages/DealDetail.jsx`
**Function**: the load `useEffect` (~line 296) and the component state/render.
**Recommended decision**: split the deal fetch and PO fetch into separate effects with a dedicated `poError` state.

**Specific Changes**:
1. **Add a `poError` state**: `const [poError, setPoError] = useState("");` alongside the existing `error` state.
2. **Split the single effect into two**:
   - **Deal effect** (keeps `loading`): `getDealById(id).then(res => setDeal(res.data.data)).catch(err => setError(err.response?.data?.message || "Deal not found")).finally(() => setLoading(false))`. Dependency: `[id]`.
   - **PO effect**: depends on `deal` so it only runs once the deal exists — `if (!deal) return; getPOs({ dealId: id }).then(poRes => { if (poRes?.data?.data?.purchases) setLinkedPOs(poRes.data.data.purchases); }).catch(() => setPoError("Could not load linked POs"))`. Dependency: `[id, deal]`. Gating on `deal` means a missing deal never triggers a spurious PO error (preserves 3.4).
3. **Replace the stale `if (!deal)` gate**: the old shared `.catch` is removed entirely; the deal-not-found message now comes only from the deal effect's `setError` (3.4), and the PO error goes to the separate `poError` state (2.2).
4. **Render `poError` as a non-fatal inline banner** in the linked-POs area (not the full-page `error || !deal` guard, which stays unchanged for the not-found case). This lets the deal render while surfacing the PO failure.
5. **Clear `poError`** appropriately when the deal/POs reload (e.g., reset `poError` at the start of the PO effect) so stale errors don't linger across navigation.

**Regression prevention**: 3.4 (deal fetch fails → not-found state; PO effect returns early because `deal` is null), 3.5 (both succeed → deal + POs render as before, `poError` empty).

**Alternative**: keep a single effect but replace the stale `if (!deal)` with a local `let dealLoaded = false;` flag set inside the `getDealById` `.then`, and route the PO error to the new `poError` state. Same correctness, slightly less separation; noted for review.

### M2 — Search-as-you-type lead filter in Add Deal

**File**: `Frontend/src/Pages/Deals.jsx`
**Function**: `AddDealModal` (the leads fetch effect and the lead `PortalDropdown`).
**Recommended decision**: add search-as-you-type filtering for leads, reusing the existing debounced-server-search pattern (no new library).

**Existing patterns to stay consistent with**: `Deals.jsx` and `Vendors.jsx` list pages both debounce a search string with a `useRef` timer + `setTimeout(…, 350)` into a `debouncedSearch` state, then call the list API with a `search` query param. The backend `getLeads` already supports `search` (it maps to `filter.$text = { $search: query.search }`) and is capped at `limit: 100` (`Math.min(100, …)`). Reuse this exact pattern inside the modal.

**Specific Changes**:
1. **Add search state**: `const [leadSearch, setLeadSearch] = useState("");` and `const [debouncedLeadSearch, setDebouncedLeadSearch] = useState("");`.
2. **Add a debounce effect** mirroring the Deals/Vendors pattern: a `useRef` timer that sets `debouncedLeadSearch` from `leadSearch` after 350ms, clearing on cleanup.
3. **Replace the single mount fetch** with a fetch keyed on `debouncedLeadSearch`: `getLeads({ search: debouncedLeadSearch, limit: 100 })` → map to the same `{ value, label, clientName }` shape → `setLeads(...)`. On mount (empty search) this returns the first page so the user sees options immediately (3.6).
4. **Replace the plain lead `PortalDropdown`** with a search input + `PortalDropdown` combo consistent with the list-page filter bars:
   - A text input (with the `Search` icon and `input-glass` styling, matching the Deals/Vendors filter bar) bound to `leadSearch`.
   - The existing `PortalDropdown` (unchanged component) receiving the fetched `leads` as `options` and `form.leadId` as `value`.
   - While `leadsLoading`, show "Loading leads…"; when the search returns no results, show "No leads found" (empty state).
5. **Keep the auto-fill behavior unchanged**: `setV("leadId")` still does `leads.find(l => l.value === v)` and sets `customerName` (3.6). Because the selected lead is present in the fetched `leads` for the current search, the find still resolves.

**Regression prevention**: 3.6 (≤100 leads, no/any search → dropdown populates, auto-fill works; the search input is additive and the initial empty-search fetch reproduces today's behavior).

**Alternative (minimal, not recommended)**: increase the fetch limit. Note this also requires raising the backend `getLeads` cap (`Math.min(100, …)`) and still does not scale beyond the new cap; search-as-you-type avoids the cap entirely. Noted for review.

### M3 — Add `manager` to the leads PATCH route

**File**: `Backend/Routes/Lead.routes.js`
**Route**: `PATCH /:id`
**Recommended decision**: treat the omission as unintentional and add `"manager"`.

**Specific Changes**:
1. **Change the PATCH role list** from `requireRole("sales", "superadmin")` to `requireRole("sales", "manager", "superadmin")`, matching `Deal.routes.js` `PATCH /:id` exactly. One-token edit; `requireRole` is variadic and already used this way.

**Regression prevention**: 3.7 (`sales`/`superadmin` still accepted; `purchase`/others still `403` — only `manager` was added), 3.8 (GET/POST/notes/history routes untouched).

**Alternative**: if the restriction is intentional, document it instead of changing the route. Noted for review.

### M4 — Remove `purchase` from the Vendors `canEdit`

**File**: `Frontend/src/Pages/Vendors.jsx` (`canEdit`); `Backend/Routes/Vendor.routes.js` is NOT changed.
**Recommended decision**: remove `"purchase"` from `canEdit` so the frontend matches the existing backend (`manager`/`superadmin`).

**Specific Changes**:
1. **Change `canEdit`** from `user?.role === "manager" || user?.role === "superadmin" || user?.role === "purchase"` to `user?.role === "manager" || user?.role === "superadmin"`. This matches `Vendor.routes.js` `PATCH /:id` (`requireRole("manager", "superadmin")`), so a `purchase` user no longer sees an Edit button that would 403.
2. **Do NOT touch `canCreate`** — it includes `"purchase"` and is a separate permission; 3.10 requires it unchanged.
3. **Do NOT touch the backend route** under the recommended option (it already rejects `purchase`).

**Regression prevention**: 3.9 (`manager`/`superadmin` still edit; `sales`/`purchase` still `403` — `purchase` was already rejected by the backend, now just not offered), 3.10 (`canCreate` unchanged).

**Alternative**: add `"purchase"` to the `Vendor.routes.js` PATCH `requireRole` if purchase users should edit vendors. Either way, frontend and backend MUST agree. Noted for review.

### M5 — Move `cookieOptions` above the response with correct indentation

**File**: `Backend/Controllers/Auth.controller.js`
**Functions**: `login`, `logout`
**Recommended decision**: move each `cookieOptions` declaration clearly above the cookie response; behavior unchanged.

**Specific Changes**:
1. **In `login`**: move the `const cookieOptions = { httpOnly: true, secure: …, sameSite: … }` declaration to the top of the handler (right after the destructuring/empty-field guard, before the `findOne`), with correct 2-space indentation matching the file style.
2. **In `logout`**: move the same declaration to the top of the handler (right after the handler opens, before the `findByIdAndUpdate`), with correct indentation.
3. **No value or attribute changes**: keep the identical `{ httpOnly, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" }` object in both handlers. The `.cookie()`/`.clearCookie()` calls and the AuditLog writes stay exactly where they are.

**Regression prevention**: 3.11 (same cookie attributes/responses — the move is positional + indentation only), 3.12 (AuditLog writes untouched).

**Optional cleanup (note, not required)**: the two `cookieOptions` objects are identical and depend only on env, so they could be hoisted to a single module-level constant. This is a larger structural change; the per-handler move satisfies the requirement. Flagged for review, not part of the recommended scope.

### L2 — Remove the dead `DEV_BYPASS` path

**File**: `Frontend/src/context/Authcontext.jsx`
**Component**: `AuthProvider`
**Recommended decision**: remove the dead dev path; behavior unchanged.

**Specific Changes**:
1. **Delete the dev-bypass block**: remove the `// ─── DEV BYPASS ───` comment, `const DEV_BYPASS = false;`, the `DEV_USER = { … }` mock, and the trailing comment line.
2. **Remove the ternaries/usages**:
   - `useState(DEV_BYPASS ? DEV_USER : null)` → `useState(null)`.
   - `useState(!DEV_BYPASS)` → `useState(true)`.
   - Inside the `useEffect`, remove the `if (DEV_BYPASS) return; // skip API call in dev bypass mode` line.
3. **Leave the real flow untouched**: the `wakeTimer`/`getCurrentUser().then(setUser).catch(() => setUser(null)).finally(…)` logic, and the `login`/`logout` functions remain exactly as they are.

**Regression prevention**: 3.13 (unauthenticated → `getCurrentUser`, `null` on fail, login flow — already the real behavior since `DEV_BYPASS` was `false`), 3.14 (real `LoginUser`/`LogoutUser` calls unchanged). Because every removed expression evaluated to the value the real path already uses, runtime behavior is identical.

### Shared concerns

- **RBAC consistency rule (M3/M4)**: after the fixes, the allowed-edit role sets are: leads PATCH = `{sales, manager, superadmin}` (matches deals PATCH); vendors PATCH (backend) = `{manager, superadmin}` and Vendors `canEdit` (frontend) = `{manager, superadmin}`. The rule "frontend permission expression == backend `requireRole` set" should be the acceptance check for both bugs. Any future role added to one side MUST be added to the other.
- **No new dependencies**: M2 reuses the existing `useRef`+debounce + `PortalDropdown` + `getLeads({ search })` pattern; no new library is introduced.
- **Out-of-scope guardrail**: H1 is already fixed; none of the changes above touch `Vendor.controller.js` AuditLog calls, so the already-correct code is not regressed.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on the UNFIXED code (exploratory), then verify the fix produces the expected behavior for buggy inputs (fix checking) and identical behavior for non-buggy inputs (preservation checking). Because M5 and L2 are behavior-preserving refactors, their exploratory phase confirms the structural defect (not a runtime failure) and both fix/preservation phases assert identical runtime behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fix, to confirm or refute the root-cause analysis. Run these on the UNFIXED code.

**Test Cases**:
1. **H2 Registration Closed Test**: seed one user, `POST /api/v1/auth/register` with valid body → expect a new `superadmin` is created (bug; will fail after fix which returns `403`).
2. **H2 Bootstrap Test**: empty DB, same request → expect first `superadmin` created (must still pass after fix; baseline for 3.1).
3. **M1 PO-Error Misreport Test**: mount DealDetail, mock `getDealById` to resolve a deal and `getPOs` to reject → expect page shows "Deal not found" (bug; will fail after fix which surfaces a PO error and renders the deal).
4. **M2 Truncation Test**: seed >100 leads, open Add Deal, assert lead #101+ is absent from the dropdown (bug; will fail after fix which allows search/select of any lead).
5. **M3 Manager 403 Test**: as `manager`, `PATCH /api/v1/leads/:id` → expect `403` (bug; will fail after fix which returns `200`).
6. **M4 Purchase Edit 403 Test**: as `purchase`, render Vendors, assert the Edit button renders and `PATCH` returns `403` (bug; will fail after fix which removes the button).
7. **M5 Placement Test**: read `login`/`logout`, confirm `cookieOptions` is declared mid-handler with misaligned indentation (structural; will fail after the move).
8. **L2 Dead-Path Test**: read `Authcontext.jsx`, confirm `DEV_BYPASS`/`DEV_USER`/bypass ternaries are present (structural; will fail after removal).

**Expected Counterexamples**: H2 creates a superadmin it should reject; M1 misreports a PO error as "Deal not found"; M2 drops leads beyond 100; M3/M4 return/offer a 403 path for `manager`/`purchase`; M5/L2 ship the structural defect.

### Fix Checking

**Goal**: Verify that for all inputs where `isBugCondition` holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := F'(input)
  ASSERT expectedBehavior(result)   // Property 1,3,5,7,9,11,13
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where `isBugCondition` does NOT hold, the fixed code produces the same result as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT F(input) = F'(input)        // Property 2,4,6,8,10,12,14
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many inputs across each domain and catches edge cases manual tests miss. For M5/L2 (behavior-preserving refactors), the preservation property is the primary guarantee: `F(input) = F'(input)` over the full login/logout (M5) and auth-init/login/logout (L2) domains.

**Test Cases**:
1. **H2 Preservation**: empty DB → first registration still creates superadmin + AuditLog (3.1, 3.3); invalid body → still returns validation error, no user (3.2).
2. **M1 Preservation**: deal fetch fails → not-found state (3.4); both succeed → deal + POs render (3.5).
3. **M2 Preservation**: ≤100 leads with no search → dropdown populates + auto-fill works (3.6); search term → only matching leads shown, auto-fill still works.
4. **M3 Preservation**: `sales`/`superadmin` still `200`; `purchase`/others still `403` (3.7); other lead routes unchanged (3.8).
5. **M4 Preservation**: `manager`/`superadmin` still edit; `sales`/`purchase` still `403` (3.9); `canCreate` unchanged (3.10).
6. **M5 Preservation**: login/logout set/clear the same cookies with the same attributes and same responses (3.11); AuditLog entries still written (3.12).
7. **L2 Preservation**: auth init still calls `getCurrentUser`, sets `null` on fail, shows login (3.13); login/logout still use real API calls (3.14).

### Unit Tests

- **H2**: `register` with seeded users → `403`; with empty DB → creates superadmin + AuditLog; invalid body → `400` validation error with no user.
- **M1**: DealDetail with deal-resolve + PO-reject → `poError` set, deal renders, no "Deal not found"; deal-reject → `error` set, not-found state.
- **M2**: AddDeal with >100 leads → search filters server-side; ≤100 leads with no search → full list + auto-fill.
- **M3**: `PATCH /leads/:id` as `manager` → `200`; as `purchase` → `403`; as `sales`/`superadmin` → `200`.
- **M4**: Vendors `canEdit` excludes `purchase`; `canCreate` still includes `purchase`; backend PATCH still rejects `purchase`.
- **M5**: `login`/`logout` cookie attributes identical before/after the move; AuditLog still written.
- **L2**: `AuthProvider` initial state `user=null`, `loading=true`; no `DEV_BYPASS`/`DEV_USER` references remain in the file.

### Property-Based Tests

- **H2**: generate random valid/invalid registration bodies and random user-count states; assert rejection iff users exist, and bootstrap/validation/AuditLog behavior otherwise.
- **M1**: generate random deal/PO resolve/reject combinations; assert the error state matches which fetch failed and that PO errors never masquerade as "Deal not found".
- **M2**: generate random lead counts and search strings; assert every lead is selectable (no truncation) and auto-fill resolves.
- **M3/M4**: generate random roles; assert the accept/reject decision equals the documented allowed set for leads and vendors.
- **M5/L2**: generate random login/logout/init sequences; assert `F(input) = F'(input)` over the full domain (identical cookies/responses/state).

### Integration Tests

- **H2**: full bootstrap flow — empty DB → register first superadmin → subsequent register returns `403` → first user can still log in.
- **M1**: full DealDetail navigation — load a deal, simulate a PO-fetch failure, assert the deal renders with a PO warning; navigate to a missing deal, assert the not-found state.
- **M2**: full Add Deal flow with >100 leads — type a search, select a lead beyond the first 100, assert customer name auto-fills and the deal creates successfully.
- **M3/M4**: full role flows — `manager` edits a lead (200) and a vendor (200); `purchase` edits a vendor (403, no Edit button); `sales` edits a lead (200) and a vendor (403).
- **M5/L2**: full auth flow — login sets both cookies with the same attributes as before the refactor; app load with no session shows the login flow; login/logout still write AuditLog and update user state.

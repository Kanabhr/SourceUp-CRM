# Bugfix Requirements Document

## Introduction

This bugfix covers the open High and Medium audit findings (plus one Low code-cleanup) for the SourceUpCRM project (Node/Express + MongoDB backend, React/Vite frontend) that still require code changes. The Critical findings (C1, C2, C3) were already fixed in a prior pass and are intentionally NOT re-fixed here.

### Scope — bugs to fix (7)

| ID | Severity | Area | Affected file(s) | Root cause (bug condition) |
|----|----------|------|-------------------|------------------------------|
| H2 | High | Auth security | `Backend/Controllers/Auth.controller.js` (`register`) | `role: "superadmin"` is hardcoded for every registration and the `existingUsers > 0` bootstrap guard is commented out, so anyone who discovers `/api/v1/auth/register` can self-create a superadmin account. |
| M1 | Medium | Deal UX | `Frontend/src/Pages/DealDetail.jsx` (load effect ~line 296) | The shared `.catch` checks `if (!deal)`, but `deal` is `null` in the stale closure, so the condition is always true and any linked-PO fetch error is misreported as "Deal not found". |
| M2 | Medium | Deal UX | `Frontend/src/Pages/Deals.jsx` (`AddDealModal`) | The lead dropdown fetches `getLeads({ limit: 100 })`; with more than 100 leads the dropdown silently truncates and leads become unselectable. |
| M3 | Medium | Lead RBAC | `Backend/Routes/Lead.routes.js` (`PATCH /:id`) | `PATCH /api/v1/leads/:id` permits only `sales` and `superadmin`; `manager` (who can edit deals) is excluded — an inconsistency. |
| M4 | Medium | Vendor RBAC | `Frontend/src/Pages/Vendors.jsx` (`canEdit`); `Backend/Routes/Vendor.routes.js` (`PATCH /:id`) | `canEdit` includes `"purchase"` so the Edit button renders, but the PATCH route allows only `manager`/`superadmin`, so a purchase user gets a guaranteed 403. |
| M5 | Medium | Auth maintainability | `Backend/Controllers/Auth.controller.js` (`login`, `logout`) | `cookieOptions` is declared with misaligned indentation/placement that reads like a cut-paste artifact; works today but is a maintainability risk. |
| L2 | Low | Frontend auth cleanup | `Frontend/src/context/Authcontext.jsx` | Dead `DEV_BYPASS = false` block + `DEV_USER` mock + ternaries ship in production (a dormant superadmin-bypass path). |

### Decision points to confirm at review

These four bugs have a recommended option and an alternative. The Expected Behavior clauses (Section 2) are written for the recommended option; the alternative is noted so it can be confirmed during review. Whichever is chosen, the frontend and backend policies MUST be kept consistent.

- **H2 (registration)** — Recommended: re-enable the `existingUsers > 0` guard so registration works only for the first (bootstrap) user. Alternative: default new registrations to a normal role and only allow superadmin creation via a superadmin-only `PATCH /users`.
- **M2 (lead dropdown)** — Recommended: add search-as-you-type filtering for leads in the Add Deal dropdown. Alternative (minimal): increase the fetch limit.
- **M3 (manager edits leads)** — Recommended: treat the omission as unintentional and add `"manager"` to the PATCH route's `requireRole`. Alternative: if the restriction is intentional, document it instead of changing the route.
- **M4 (purchase edits vendors)** — Recommended: remove `"purchase"` from `canEdit` in `Vendors.jsx` (purchase users likely shouldn't edit vendors). Alternative: add `"purchase"` to the PATCH route. Either way, frontend and backend MUST agree.

### Out of scope (not fixed in this sweep)

- **H1 — Vendor AuditLog field name mismatch:** Verified as already fixed. The `AuditLog` schema uses `userId`, and `Vendor.controller.js` already calls `AuditLog.create({ userId: req.user._id, ... })` in all three places (create/update/delete). A grep for `performedBy` across the backend returns zero matches. Excluded per review decision; no task is created so the already-correct code is not regressed.
- **C1, C2, C3 (Critical):** Already fixed in a prior pass. Not re-fixed.
- **H3 (Purchase.jsx response shape):** Confirmed correct — no bug.
- **L1 (two API envelopes):** Larger refactor, out of scope for this sweep; tracked as a known follow-up.
- **L3 (quickCategory):** Confirmed used — no bug.
- **L4 (LeadImport.controller.js):** Not audited — out of scope.
- **L5 (vendorId index):** Intentional — no bug.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN any client sends `POST /api/v1/auth/register` THEN the system creates a new user with `role: "superadmin"` for every registration, because the `existingUsers > 0` bootstrap guard in `Auth.controller.js` is commented out, so anyone who discovers the endpoint obtains a superadmin account.

1.2 WHEN the DealDetail page loads a deal successfully but the subsequent linked-PO fetch (`getPOs`) fails THEN the page displays "Deal not found", because the shared `.catch` handler in `DealDetail.jsx` checks `if (!deal)` and `deal` is `null` in the stale closure, so the condition is always true and a PO-fetch error is misreported as a missing deal.

1.3 WHEN the Add Deal modal's lead dropdown is populated and the backend holds more than 100 leads THEN the dropdown silently truncates to the first 100 leads (the modal fetches `getLeads({ limit: 100 })` in `Deals.jsx`), so leads beyond the first 100 are unselectable when creating a deal.

1.4 WHEN a user with role `manager` sends `PATCH /api/v1/leads/:id` THEN the system returns 403, because the route's `requireRole` array in `Lead.routes.js` permits only `sales` and `superadmin`, even though `manager` can view leads and can edit deals.

1.5 WHEN a user with role `purchase` opens the Vendors page and clicks Edit THEN the subsequent `PATCH /api/v1/vendors/:id` returns 403, because `canEdit` in `Vendors.jsx` includes `"purchase"` (so the button renders) while the PATCH route in `Vendor.routes.js` permits only `manager` and `superadmin`.

1.6 WHEN the `login` and `logout` handlers in `Auth.controller.js` set/clear cookies THEN the `cookieOptions` object is declared with misaligned indentation/placement that reads like a cut-paste artifact (declared amid the awaited operations rather than clearly above the response), creating a maintainability risk even though it currently works.

1.7 WHEN the frontend auth context initializes THEN the dead `DEV_BYPASS` code path (the constant `DEV_BYPASS = false`, the `DEV_USER` mock, and the `DEV_BYPASS ? DEV_USER : null` ternaries in `Authcontext.jsx`) ships in production, adding a dormant superadmin-bypass path that should not be present.

### Expected Behavior (Correct)

2.1 WHEN a client sends `POST /api/v1/auth/register` and one or more users already exist THEN the system SHALL reject the registration so no new superadmin accounts can be self-created (registration restricted to the first/bootstrap user). [Recommended: re-enable the `existingUsers > 0` guard. Alternative: default new registrations to a normal role and only allow superadmin via a superadmin-only `PATCH /users` — to confirm at review.]

2.2 WHEN the linked-PO fetch on DealDetail fails while the deal itself loaded THEN the page SHALL surface the PO-fetch error without falsely reporting "Deal not found", and the deal-not-found error SHALL be shown only when the deal fetch itself fails. [Fix: call `setError` unconditionally for the PO fetch error, or split the deal fetch and PO fetch into separate effects.]

2.3 WHEN the Add Deal lead dropdown is opened and more than 100 leads exist THEN the system SHALL allow the user to find and select any lead with no silent truncation. [Recommended: add search-as-you-type filtering for leads in the dropdown. Alternative (minimal): increase the fetch limit — to confirm at review.]

2.4 WHEN a `manager` sends `PATCH /api/v1/leads/:id` THEN the system SHALL accept the update by adding `"manager"` to the route's `requireRole` array, making lead editing consistent with deal editing. [Recommended: treat the omission as unintentional and add `"manager"`. Alternative: if intentional, document the restriction instead — to confirm at review.]

2.5 WHEN a `purchase` user opens the Vendors page THEN the Edit button SHALL NOT be offered (no UI that leads to a guaranteed 403), by removing `"purchase"` from `canEdit` in `Vendors.jsx` to match the PATCH route. [Recommended: remove `"purchase"` from `canEdit`. Alternative: add `"purchase"` to the PATCH route if purchase users should edit vendors — to confirm at review. Frontend and backend MUST stay consistent.]

2.6 WHEN the `login` and `logout` handlers build cookie options THEN the `cookieOptions` declaration SHALL be placed clearly above the `.cookie()`/`.clearCookie()` response with correct indentation, and the runtime behavior SHALL be identical (same cookie attributes and responses).

2.7 WHEN the frontend auth context initializes THEN the system SHALL always run the real auth flow (fetch current user, login, logout) with no dormant dev-bypass path, by removing the `DEV_BYPASS` block and its usages from `Authcontext.jsx`. Behavior SHALL be unchanged because `DEV_BYPASS` is already `false`.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a client sends `POST /api/v1/auth/register` and NO users exist THEN the system SHALL CONTINUE TO create the first (bootstrap) superadmin account and return it.

3.2 WHEN registration input fails validation (empty fields, invalid email/username/password) THEN the system SHALL CONTINUE TO return the existing validation errors without creating a user.

3.3 WHEN a registration succeeds (bootstrap) THEN the system SHALL CONTINUE TO write the `AuditLog` entry for the `REGISTER` action.

3.4 WHEN the DealDetail deal fetch itself fails (the deal is genuinely missing) THEN the page SHALL CONTINUE TO display the deal-not-found state.

3.5 WHEN the DealDetail deal fetch and PO fetch both succeed THEN the page SHALL CONTINUE TO render the deal and its linked POs as before.

3.6 WHEN the Add Deal modal is used with 100 or fewer leads THEN the modal SHALL CONTINUE TO populate the dropdown and auto-fill the customer name from the selected lead as before.

3.7 WHEN a `sales` or `superadmin` user sends `PATCH /api/v1/leads/:id` THEN the system SHALL CONTINUE TO accept the update; WHEN a `purchase` user (or any other role) sends it THEN the system SHALL CONTINUE TO reject with 403.

3.8 WHEN leads are viewed, created, or have notes/history accessed THEN the existing role permissions for those operations SHALL CONTINUE TO apply unchanged.

3.9 WHEN a `manager` or `superadmin` edits a vendor THEN the system SHALL CONTINUE TO accept the PATCH; WHEN a `sales` user (and, after the fix, a `purchase` user) attempts to edit THEN the system SHALL CONTINUE TO reject with 403.

3.10 WHEN `canCreate` is evaluated on the Vendors page THEN the existing create-permission behavior SHALL CONTINUE TO apply (only the Edit/purchase mismatch is changed).

3.11 WHEN login or logout completes THEN the system SHALL CONTINUE TO set/clear the `accessToken` and `refreshToken` cookies with the same attributes (httpOnly, secure, sameSite) and return the same responses.

3.12 WHEN login or logout runs THEN the existing `AuditLog` entries for LOGIN/LOGOUT SHALL CONTINUE TO be written.

3.13 WHEN an unauthenticated user loads the app THEN the system SHALL CONTINUE TO call `getCurrentUser`, set the user to `null` on failure, and show the login flow (the real flow already runs because `DEV_BYPASS` is `false`).

3.14 WHEN login or logout is performed THEN the system SHALL CONTINUE TO use the real `LoginUser`/`LogoutUser` API calls and update user state accordingly.

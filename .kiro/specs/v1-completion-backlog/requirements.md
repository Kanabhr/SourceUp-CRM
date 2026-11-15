# Requirements Document

## Introduction

SourceUp CRM v1 has its transactional backbone implemented and working: Leads (CRUD, status pipeline, notes, duplicate detection, Excel bulk import with Gemini AI verification), Deals (CRUD, auto-financials, stage pipeline, commission), Purchase (CRUD, auto landed-cost, sync-to-deal, QC status), Vendors (CRUD), Auth (JWT, roles, cookies), Users (management), and role-based access control (sales sees own data; manager/superadmin see all).

This spec covers the **remaining features** required to satisfy the full scope in `docs/Main-SRS.md`, derived from the prior completion-progress report. These are currently placeholder pages or entirely absent: the management/visibility layer (Dashboard, Reports, Commission, Settings), the missing Purchase-Quotations module, the DB export utility, lead-enrichment fields, and service-prefix-aware deal numbering.

### Scope - remaining features (8)

| ID | Feature | Status today |
|----|---------|--------------|
| R1 | Lead enrichment fields | Partial: product specs exist as text; reference-photo upload, packing details, MOQ/Qty, CBP, target price are missing |
| R2 | Live Dashboard | Placeholder page; no aggregation endpoint |
| R3 | Quotations module | Placeholder page; no schema/controller/route |
| R4 | Reports | Placeholder page; no aggregation endpoint |
| R5 | Commission summary page | Placeholder page; commission is computed on deals but has no summary view |
| R6 | DB linking/dumping utility | Entirely absent (explicit SRS scope item) |
| R7 | Settings (ServicePrefix management) | Placeholder page; ServicePrefix is seeded but unmanaged |
| R8 | Service-prefix-aware deal numbering | ServicePrefix codes are seeded but NOT used in deal IDs (SRS requirement only partially met) |

### Out of scope

- Any already-implemented module (Leads/Deals/Purchase/Vendors/Auth/Users CRUD, RBAC, Excel import, AI verification) - these are not re-specified here.
- Phase 2/3 items explicitly excluded by the SRS: mobile app, desktop app, accounting/tax module, HR/payroll.
- Bug fixes from the prior audit report (those are tracked separately).

### Shared implementation principles (apply to all features)

- Backend follows existing patterns: `AsyncHandler` wrappers, `ApiError`/`ApiResponse` envelopes, `AuditLog` writes on mutating actions, `VerifyJWT` + `requireRole` on every route, `scopeFilter` so sales users only see their own data.
- Frontend follows existing patterns: glass UI styling, `PortalDropdown`, `EditField`, `input-glass`, `useRef`+debounced search, reuse of `authapi/axios.js` axios instance with credentials.
- No new runtime dependencies unless explicitly required ( multer is already installed; reuse it for uploads ).
- Every new route module is registered in `Backend/app.js`.

## Glossary

| Term | Meaning |
| :--- | :--- |
| KPI | Key Performance Indicator shown on the Dashboard/Reports |
| ServicePrefix | Short code (SRC, PKG, WEB, SMM, LEG, INV, CON) identifying one of the 7 services; used in deal numbering |
| scopeFilter | Existing helper that restricts sales users to their own leads/deals |
| buyingCost / landedCost | Cost fields on a Deal; landedCost is pushed from the linked Purchase's auto-calc |
| Quotation | A vendor price quote tied to a Lead (and optionally a Deal/Vendor) |
| MOQ | Minimum Order Quantity (lead enrichment field) |
| CBP | Current Buying Price (lead enrichment field) |
| Counter | MongoDB collection holding per-entity per-year incrementing sequences for ID generation |

## Requirements

### Requirement 1: Lead Enrichment Fields

**User Story:** As a sales, manager, or superadmin user, I want to capture the product and procurement context fields the SRS lead field-list requires (reference photos, packing details, MOQ/Qty, CBP, target price), so that each lead carries the full sourcing context needed for quotation and purchase decisions.

#### Acceptance Criteria

1. WHEN a sales/manager/superadmin user creates or edits a lead THEN the system SHALL accept packing details (free text), MOQ/Qty (number), Current Buying Price (CBP) (number), and target price (number) as optional fields.
2. WHEN a user views a lead on LeadDetail THEN the system SHALL display these fields and allow inline editing using the existing EditField pattern (same as expectedOrderValue and remarks).
3. WHEN a user with edit permission uploads a reference photo for an existing lead THEN the system SHALL store the image to disk under `public/uploads/leads`, append the stored filename to the existing `lead.photos` array (preserving prior uploads as a multi-photo gallery), and serve it via the existing `express.static("public")`.
4. WHEN a user with edit permission removes a reference photo THEN the system SHALL delete the file from disk and remove its entry from `lead.photos`.
5. WHEN reference photos are rendered on LeadDetail THEN the system SHALL show thumbnails with a remove control only to users who have edit permission.
6. WHEN a lead is created without any of the new fields THEN the system SHALL accept it (all new fields are optional) so existing behaviour is preserved.

**How to implement:**
- Modify `Backend/MongoDB/Models/Lead.schema.js`: add `packingDetails` (String, default ""), `moq` (Number), `cbp` (Number), `targetPrice` (Number), `photos` ([String], default []).
- Modify `Backend/Controllers/Lead.controller.js` (`createLead` and `updateLead`): accept and persist the four scalar fields.
- Add to `Lead.controller.js`: `uploadLeadPhoto` (push filename to photos) and `removeLeadPhoto` (remove file + array entry).
- Modify `Backend/Routes/Lead.routes.js`: `POST /:id/photos` (multer single image) and `DELETE /:id/photos/:index`, both `requireRole("sales","manager","superadmin")`.
- New `Backend/Middleware/MulterImages.middleware.js`: diskStorage destination `public/uploads/leads`, fileFilter for jpg/jpeg/png/webp, ~5 MB limit, single field name `photo`.
- Modify `Frontend/src/api/leadsApi.js`: `uploadLeadPhoto(id, file)`, `removeLeadPhoto(id, index)`, and include the four new fields in create/update payloads.
- Modify `Frontend/src/Pages/Leads.jsx` (add-lead form) and `Frontend/src/Pages/LeadDetail.jsx` (EditField rows for the four fields + photo UI).
- New `Frontend/src/components/PhotoUpload.jsx`: file input, thumbnail grid, per-image remove button.

**Acceptance:** new fields persist and round-trip via API and UI; photo upload stores the file and shows a thumbnail; removal deletes the file and the array entry; a lead created with none of the new fields still succeeds.

### Requirement 2: Live Dashboard

**User Story:** As a manager, superadmin, sales, or purchase user, I want a live dashboard showing sales records, reference numbers, and commission tracking KPIs scoped to my role, so that I can monitor business performance at a glance.

#### Acceptance Criteria

1. WHEN a manager or superadmin opens the Dashboard THEN the system SHALL display KPIs: total leads, leads by status, deals by stage, won-deals count, total order value, total commission split into pending vs paid, POs by status, and vendor count.
2. WHEN a sales user opens the Dashboard THEN the system SHALL scope every figure to their own leads, deals, and commission (consistent with the existing `scopeFilter`).
3. WHEN the dashboard data is requested THEN the system SHALL compute all aggregations on the server in a single `GET /api/v1/dashboard/summary` endpoint; the client SHALL only render, not aggregate.
4. WHEN a purchase user opens the Dashboard THEN the system SHALL see PO and vendor KPIs (purchase-scoped view) and not sales-commission figures they cannot access.

**How to implement:**
- New `Backend/Controllers/Dashboard.controller.js`: `getDashboardSummary` using MongoDB aggregation pipelines over Lead/Deal/Purchase/Vendor; apply `scopeFilter` for the sales role; gate commission figures to sales/manager/superadmin only.
- New `Backend/Routes/Dashboard.routes.js`: `GET /` with `requireRole("sales","manager","superadmin","purchase")`.
- Register the router in `Backend/app.js`.
- New `Frontend/src/api/dashboardApi.js`: `getDashboardSummary()`.
- Replace `Frontend/src/Pages/Dashboard.jsx` (currently a placeholder) with KPI cards, a deal-stage funnel, and a commission summary widget, matching the existing glass UI style.

**Acceptance:** manager sees all-organisation KPIs; a sales user sees only their own; KPIs are real DB aggregates (not hardcoded); the page renders and refreshes on load.

### Requirement 3: Quotations Module

**User Story:** As a purchase, manager, or superadmin user, I want to manage vendor quotations tied to a lead (and optionally a deal and vendor), upload quotation files, and select the best quotation, so that I can execute the SRS purchase-department "quotations requested and uploaded, best quotation selected" flow.

#### Acceptance Criteria

1. WHEN a purchase/manager/superadmin user creates a quotation THEN the system SHALL store it linked to a Lead (required), optionally to a Deal and a Vendor, with vendor name, price, currency, exchange rate, validity date, terms, and an uploaded quotation file (PDF or image).
2. WHEN quotations are listed for a lead THEN the system SHALL return all quotations for that lead, sorted by price ascending.
3. WHEN a user selects the best quotation for a lead THEN the system SHALL mark exactly one quotation as selected (deselecting the previous one) Updating the linked Deal's `buyingCost` from the quotation price is a manual action for v1, not automatic.
4. WHEN a quotation file is uploaded THEN the system SHALL store it under `public/uploads/quotations` and serve it via static; the quotation record SHALL keep its file URL.
5. WHEN a quotation is deleted THEN the system SHALL remove its file from disk and the record from the DB.
6. WHEN a user without the purchase, manager, or superadmin role attempts to create a quotation THEN the system SHALL reject the request with a 403 error.

**How to implement:**
- New `Backend/MongoDB/Models/Quotation.schema.js`: `quotationId` (SUI-Q-YYYY-XXXX, unique sparse), `leadId` (ref Lead, required), `dealId` (ref Deal, optional), `vendorRef` (ref Vendor, optional), `vendorName`, `product`, `price` (Number), `currency` (INR/CNY/USD), `exchangeRate` (Number, default 1), `validity` (Date), `terms` (String), `fileUrl` (String), `isSelected` (Boolean, default false), `createdBy`, timestamps, and a statusHistory optional.
- Extend `Backend/Utils/generateId.js`: `generateQuotationId()` using prefix `SUI-Q`.
- New `Backend/Controllers/Quotation.controller.js`: `createQuotation` (multer file), `getQuotations` (filter by leadId/dealId), `getQuotationById`, `updateQuotation`, `selectBestQuotation` (sets `isSelected` true on one, false on others, the linked Deal`s `buyingCost` is NOT auto-updated for v1), `deleteQuotation`.
- New `Backend/Routes/Quotation.routes.js`: full CRUD plus `POST /:id/select`; `requireRole("purchase","manager","superadmin")` for write, `requireRole("sales","purchase","manager","superadmin")` for read.
- Reuse `MulterImages.middleware.js` extended to also accept PDF for quotations (or a sibling middleware).
- New `Frontend/src/api/quotationApi.js`.
- Replace `Frontend/src/Pages/Quotations.jsx` (placeholder) with: lead picker, quotation list sorted by price, upload form, price comparison, and a "Select best" action that confirms before overwriting the previous selection.

**Acceptance:** quotation CRUD works end to end; the file uploads and is downloadable; selecting best marks one and updates the linked Deal's buying cost; RBAC denies sales write access.

### Requirement 4: Reports

**User Story:** As a manager or superadmin, I want sales, commission, conversion, and vendor reports filtered by a date range, so that I can analyze business performance over time.

#### Acceptance Criteria

1. WHEN a manager or superadmin opens Reports THEN the system SHALL offer four reports: Sales (deals won, revenue by period and by sales rep), Commission (pending vs paid by rep), Conversion (lead-to-deal funnel rates), and Vendor (PO counts and average landed cost by vendor).
2. WHEN a report is generated with a date range (from/to) THEN the system SHALL filter every aggregate by that range.
3. WHEN a sales or purchase user attempts to open Reports THEN the system SHALL deny access (403), because reports are manager/superadmin only.

**How to implement:**
- New `Backend/Controllers/Reports.controller.js`: one aggregation endpoint per report type, reusing pipeline patterns from `Dashboard.controller`; accept `from`/`to` date filters.
- New `Backend/Routes/Reports.routes.js`: `GET /sales`, `GET /commission`, `GET /conversion`, `GET /vendor`; `requireRole("manager","superadmin")`.
- New `Frontend/src/api/reportsApi.js`.
- Replace `Frontend/src/Pages/Reports.jsx` (placeholder) with a report-type selector, a date-range filter, and table rendering in the existing glass style (no new charting library; tables/bars via styled divs).

**Acceptance:** each report returns real aggregates filtered by the chosen date range; sales/purchase users get 403; manager/superadmin see all.

### Requirement 5: Commission Summary Page

**User Story:** As a manager, superadmin, or sales user, I want a dedicated commission summary view showing per-sales-rep totals and a pending-vs-paid split, so that I can track commission payments.

#### Acceptance Criteria

1. WHEN a manager or superadmin opens the Commission page THEN the system SHALL show, per sales rep, total gross profit, total commission amount, and a pending-vs-paid split, plus the list of deals carrying commission.
2. WHEN a sales user opens the Commission page THEN the system SHALL show only their own commission.
3. WHEN commission is marked Paid (already supported via `PATCH /deals/:id` `commissionStatus`) THEN the summary SHALL reflect the updated status after refresh.

**How to implement:**
- Add a `GET /api/v1/commission/summary` endpoint (in `Reports.controller` or a small new `Commission.controller`) that aggregates Deal `commissionAmount`/`commissionStatus` by `salesRep`, grouped by status; sales role scoped to self.
- New `Frontend/src/api/commissionApi.js` (or reuse `dealsApi`).
- Replace `Frontend/src/Pages/Commission.jsx` (placeholder) with per-rep summary cards, a deals table, and a "Mark Paid" action that calls the existing `updateDeal`.

**Acceptance:** aggregates match deal data; sales users see only their own; marking paid updates the summary on refresh.

### Requirement 6: DB Linking / Dumping Utility

**User Story:** As a superadmin, I want to export a selected collection (Leads, Deals, Purchases, Vendors, or Users) as a streamed JSON or CSV file download with sensitive fields excluded, so that I can perform data integration per the SRS.

#### Acceptance Criteria

1. WHEN a superadmin requests a data dump THEN the system SHALL export a selected collection (Leads, Deals, Purchases, Vendors, or Users) in JSON or CSV format as a streamed file download.
2. WHEN the Users collection is exported THEN the system SHALL exclude sensitive fields (`password`, `RefreshToken`) from every record.
3. WHEN a dump is generated for a large collection THEN the system SHALL stream the response (no full in-memory buffering).
4. WHEN any non-superadmin role attempts the dump THEN the system SHALL deny access (403).

**How to implement:**
- New `Backend/Controllers/DbUtility.controller.js`: `exportCollection` accepting `collection` and `format` (`json`/`csv`); use a safelist of allowed collections; for Users, project out `password` and `RefreshToken`; stream with `cursor` + `res.write` for JSON, and a CSV serializer row-by-row.
- New `Backend/Routes/DbUtility.routes.js`: `GET /export`; `requireRole("superadmin")` only.
- New `Frontend/src/Pages/DbUtility.jsx` + `Frontend/src/api/dbUtilityApi.js`: collection selector, format toggle, and a download button that triggers the file download.
- Add the page route in `Frontend/src/App.jsx` and a superadmin-only nav entry in `Frontend/src/components/Sidebar.jsx`.

**Acceptance:** superadmin can download each allowed collection as JSON and CSV; the Users export contains no password or refresh-token fields; non-superadmin gets 403; large exports stream without crashing.

### Requirement 7: Settings - ServicePrefix Management

**User Story:** As a superadmin, I want to manage (create, update, toggle active/inactive) the 7 service prefixes that drive deal numbering, so that I can configure which prefixes are active and offered when generating new deal IDs.

#### Acceptance Criteria

1. WHEN a superadmin opens Settings THEN the system SHALL list all ServicePrefix entries (`code`, `name`, `isActive`) and allow create, update, and toggle active/inactive.
2. WHEN a prefix is toggled inactive THEN that prefix SHALL NOT be offered when generating new deal IDs (per R8).
3. WHEN a non-superadmin attempts to change settings THEN the system SHALL deny access (403).

**How to implement:**
- New `Backend/Controllers/Settings.controller.js`: CRUD over the existing `ServicePrefix` model (already defined and seeded in `seedPrefixes.js`).
- New `Backend/Routes/Settings.routes.js`: `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`; `requireRole("superadmin")`.
- New `Frontend/src/api/settingsApi.js`.
- Replace `Frontend/src/Pages/Settings.jsx` (placeholder) with a prefix table plus add/edit/toggle controls.

**Acceptance:** prefix CRUD persists and the seeded defaults remain editable; only superadmin can change settings; inactive prefixes are excluded from deal-ID generation.

### Requirement 8: Service-Prefix-Aware Deal Numbering

**User Story:** As a developer, I want deal IDs to embed the ServicePrefix code matching the lead's service type with a per-prefix per-year sequence, so that deals are uniquely numbered by service type satisfying the SRS.

#### Acceptance Criteria

1. WHEN a deal is created from a lead THEN the system SHALL generate a deal ID that embeds the ServicePrefix code matching the lead's `serviceType` (for example a Sourcing lead yields an ID like `SUI-D-SRC-2026-0001` (keeping the SUI-D token)).
2. WHEN the lead's `serviceType` has no matching active prefix THEN the system SHALL fall back to a default prefix (for example `SUI-D`) and log a warning, and SHALL still guarantee uniqueness.
3. WHEN deal IDs are generated THEN the numeric sequence SHALL be unique per prefix+year (the `Counter` collection keyed by `entity = deal-<PREFIX>`).
4. WHEN existing deals (already using `SUI-D-YYYY-XXXX`) are viewed THEN their IDs SHALL remain unchanged (backward compatibility; only new deals use the prefix-based scheme).

**How to implement:**
- Modify `Backend/Utils/generateId.js`: add `generateDealId(serviceType)` that resolves the lead's `serviceType` to an active `ServicePrefix` code, then calls `generateId("deal-" + code, "SUI-D-" + code)` so the ID keeps the SUI-D token (e.g. `SUI-D-SRC-2026-0001`); fall back to `generateId("deal", "SUI-D")` (the existing `SUI-D-YYYY-XXXX`) when no match.
- Define a shared `serviceType -> prefix code` map (Sourcing -> SRC, Packaging -> PKG, Website & IT -> WEB, Social Media -> SMM, Legal -> LEG, Investment -> INV, Consultancy -> CON), sourced from the `ServicePrefix` collection so admins can change it via R7.
- Modify `Backend/Controllers/Deal.controller.js` `createDeal`: pass `lead.serviceType` into `generateDealId`.
- Keep `Counter` keyed per prefix+year so each prefix has its own incrementing sequence.

**Acceptance:** a deal from a Sourcing lead gets an ID starting with `SRC-`; each prefix has its own per-year sequence; fallback is used and uniqueness preserved when no matching prefix exists; existing deal IDs are unchanged.

## Resolved decisions

- R3.3: Selecting the best quotation marks it but does NOT auto-update the linked Deal's `buyingCost` for v1 (manual).
- R6: Export supports both JSON and CSV.
- R6: The DB utility is export-only for v1 (no import/linking).
- R2/R4/R5: Dashboard, Reports, and Commission share a single backend aggregation helper (`Backend/Utils/aggregation.js`) to avoid duplication.
- R8: Deal IDs keep the `SUI-D` token and embed the service prefix code, e.g. `SUI-D-SRC-2026-0001`.

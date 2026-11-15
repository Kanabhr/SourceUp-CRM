# Design Document

## Overview

This design implements the v1 completion backlog defined in requirements.md (features R1-R8) for SourceUp CRM. It specifies the data models, API contracts, frontend structure, and shared utilities. Existing patterns are reused: AsyncHandler, ApiError/ApiResponse, AuditLog, VerifyJWT/requireRole, scopeFilter, the axios instance, and the glass UI. No new runtime dependencies are introduced (multer is already installed).

## Goals

- Add Lead enrichment fields (R1) including reference-photo upload.
- Build a server-aggregated Live Dashboard (R2).
- Build a full-stack Quotations module (R3) with manual best-selection (no auto Deal cost update).
- Build Reports (R4), Commission summary (R5), DB export utility (R6), and Settings (R7).
- Make deal numbering service-prefix-aware while keeping the SUI-D token (R8).
- Share aggregation logic across R2/R4/R5 via Backend/Utils/aggregation.js.

## Non-Goals

- Auto-updating Deal.buyingCost from a selected quotation (manual for v1).
- DB import/linking (export-only for v1).
- Rework of any already-implemented module.
- Mobile/desktop apps, accounting/tax, HR/payroll (SRS phase 2/3 exclusions).

## Architecture

New features follow the existing layering: Routes -> Controllers -> Models, with Middleware (VerifyJWT/requireRole, multer) and Utils (generateId, aggregation). Every new router is mounted in Backend/app.js under /api/v1. Every mutating controller action writes an AuditLog entry and uses AsyncHandler. Sales users are scoped via scopeFilter; manager/superadmin see all; the purchase role governs vendor/quotation/PO access. Frontend: each feature gets an api client (Frontend/src/api) consumed by a page (Frontend/src/Pages); shared components live in Frontend/src/components.

### File inventory

New backend files:
- Backend/MongoDB/Models/Quotation.schema.js
- Backend/Controllers/Quotation.controller.js, Dashboard.controller.js, Reports.controller.js, Settings.controller.js, DbUtility.controller.js
- Backend/Routes/Quotation.routes.js, Dashboard.routes.js, Reports.routes.js, Settings.routes.js, DbUtility.routes.js
- Backend/Middleware/MulterImages.middleware.js
- Backend/Utils/aggregation.js

New frontend files:
- Frontend/src/api/quotationApi.js, dashboardApi.js, reportsApi.js, commissionApi.js, settingsApi.js, dbUtilityApi.js
- Frontend/src/components/PhotoUpload.jsx
- Frontend/src/Pages/DbUtility.jsx

Modified files:
- Lead.schema.js, Lead.controller.js, Lead.routes.js (R1)
- generateId.js, Deal.controller.js (R8)
- app.js (register routers)
- Dashboard.jsx, Quotations.jsx, Reports.jsx, Commission.jsx, Settings.jsx (replace placeholders)
- LeadDetail.jsx, Leads.jsx, leadsApi.js (R1)
- App.jsx, Sidebar.jsx (DbUtility route/nav)

## Components and Interfaces

Backend components (each exports named functions/models):
- Quotation.schema.js -> exports the Quotation model plus QUOTATION_CURRENCIES enum.
- Quotation.controller.js -> createQuotation, getQuotations, getQuotationById, updateQuotation, selectQuotation, deleteQuotation (all AsyncHandler).
- Dashboard.controller.js -> getDashboardSummary (AsyncHandler); consumes aggregation.js.
- Reports.controller.js -> getSalesReport, getCommissionReport, getConversionReport, getVendorReport.
- Settings.controller.js -> CRUD over ServicePrefix: getPrefixes, createPrefix, updatePrefix, deletePrefix.
- DbUtility.controller.js -> exportCollection (streams JSON/CSV; Users safelist).
- MulterImages.middleware.js -> uploadLeadPhoto (single "photo", images only), uploadQuotationFile (single "file", images + pdf).
- aggregation.js -> leadsByStatus, dealsByStage, commissionSplit, posByStatus, vendorStats, applyDateRange.
- generateId.js -> generateQuotationId() and generateDealId(serviceType) (modified).

Routes (mounted under /api/v1, all behind VerifyJWT + requireRole):
- Quotation.routes.js, Dashboard.routes.js, Reports.routes.js, Settings.routes.js, DbUtility.routes.js; Lead.routes.js gains POST /:id/photos and DELETE /:id/photos/:index.

Frontend components and interfaces:
- PhotoUpload.jsx -> props { photos: string[], canEdit: boolean, onUpload(file), onRemove(index) }.
- Pages Dashboard/Quotations/Reports/Commission/Settings/DbUtility consume their api clients and render glass-style UI.
- api clients wrap the existing axios instance (credentials included); each exports the functions listed in Frontend Structure.

## Data Models

### Lead.schema.js (modifications - R1)
Add fields:
- packingDetails: String, default ""
- moq: Number, default null
- cbp: Number, default null   (Current Buying Price)
- targetPrice: Number, default null
- photos: [String], default []   (stored filenames under public/uploads/leads)

### Quotation.schema.js (new - R3)
Fields:
- quotationId: String, unique, sparse   (SUI-Q-YYYY-XXXX)
- leadId: ObjectId ref Lead, required
- dealId: ObjectId ref Deal, optional
- vendorRef: ObjectId ref Vendor, optional
- vendorName: String, default ""
- product: String, default ""
- price: Number, default 0
- currency: String, enum [INR, CNY, USD], default INR
- exchangeRate: Number, default 1
- validity: Date, default null
- terms: String, default ""
- fileUrl: String, default ""   (path under public/uploads/quotations)
- isSelected: Boolean, default false
- createdBy: ObjectId ref User, required
- timestamps: true
Indexes: leadId, dealId, vendorRef. Export the model plus currency enum.

### ServicePrefix.schema.js (existing - R7/R8)
Already defined (code, name, isActive) and seeded in seedPrefixes.js. R7 adds CRUD; R8 reads active codes.

### No new models for Dashboard/Reports/Commission/DbUtility/Settings
These aggregate over existing models (Lead, Deal, Purchase, Vendor, User, ServicePrefix).

## API Contracts

All endpoints are under /api/v1 and behind VerifyJWT. Response envelope is new ApiResponse(statusCode, data, message) producing { status, data, message }, matching the Deals/Leads/Purchase shape. Mutating actions write an AuditLog entry.

### R1 Lead enrichment + photos
- PATCH /leads/:id (existing) is extended to accept packingDetails, moq, cbp, targetPrice via the existing updateLead pattern.
- POST /leads/:id/photos   (requireRole sales/manager/superadmin). Multipart form-data, field "photo", single image (jpg/jpeg/png/webp, <=5MB). Response data: { photos: [...] }.
- DELETE /leads/:id/photos/:index   (requireRole sales/manager/superadmin). Deletes the file from disk and the array entry. Response data: { photos: [...] }.
- GET /leads/:id returns the new fields automatically (schema-driven).

### R2 Dashboard
- GET /dashboard/summary   (requireRole sales/manager/superadmin/purchase). No query params; scope applied server-side by role.
- Response data shape:
  leads: { total, byStatus: { Open, InProgress, QuotationSent, ClosedWon, ClosedLost } }
  deals: { total, byStage: { ... }, won, totalOrderValue }
  commission: { pendingAmount, paidAmount }   (sales/manager/superadmin only)
  purchase: { byStatus: { ... } }
  vendors: { total }
- Sales role: every figure scoped to own leads/deals; commission included. Purchase role: receives purchase + vendors blocks; deals/commission blocks omitted.

### R3 Quotations
- POST /quotations   (requireRole purchase/manager/superadmin). Multipart: file field "file" (pdf/jpg/png/webp) plus text fields leadId, dealId, vendorRef, vendorName, product, price, currency, exchangeRate, validity, terms. Response data: quotation.
- GET /quotations?leadId=&dealId=&page=&limit=   (requireRole sales/purchase/manager/superadmin). Response data: { quotations, pagination }.
- GET /quotations/:id   (same read roles).
- PATCH /quotations/:id   (write roles); text fields, optional file re-upload.
- POST /quotations/:id/select   (requireRole purchase/manager/superadmin). Sets isSelected true on this quotation and false on siblings sharing the same leadId. Does NOT touch Deal.buyingCost (manual for v1). Response data: quotation.
- DELETE /quotations/:id   (write roles); deletes file + record.

### R4 Reports
- GET /reports/sales?from=&to=   (requireRole manager/superadmin)
- GET /reports/commission?from=&to=
- GET /reports/conversion?from=&to=
- GET /reports/vendor?from=&to=
Each returns aggregates filtered by the from/to date range.

### R5 Commission summary
- GET /commission/summary   (requireRole sales/manager/superadmin). Response data: { reps: [ { salesRep, gp, commissionAmount, pending, paid, deals: [...] } ] }. Sales role: scoped to self (single rep row).

### R6 DB export utility
- GET /db/export?collection=leads|deals|purchases|vendors|users&format=json|csv   (requireRole superadmin). Streams a file download with Content-Disposition attachment. Users export excludes password and RefreshToken. CSV is streamed row-by-row.

### R7 Settings (ServicePrefix)
- GET /settings/prefixes   (requireRole superadmin)
- POST /settings/prefixes   (code, name, isActive)
- PATCH /settings/prefixes/:id
- DELETE /settings/prefixes/:id

### R8 Deal numbering (internal, no new endpoint)
- generateDealId(serviceType) resolves the active ServicePrefix code for the lead serviceType and produces SUI-D-<CODE>-YYYY-XXXX; fallback SUI-D-YYYY-XXXX when no match.

## Shared Utilities

### Backend/Utils/aggregation.js (new)
Reusable MongoDB pipeline builders used by Dashboard/Reports/Commission:
- leadsByStatus(filter), dealsByStage(filter), commissionSplit(filter), posByStatus(filter), vendorStats(filter)
- applyDateRange(filter, from, to) helper
This prevents pipeline duplication across the R2/R4/R5 controllers.

### Backend/Middleware/MulterImages.middleware.js (new)
diskStorage destination public/uploads/<dir>, filename = Date.now()-<random>.<ext>, fileFilter for image MIME (and pdf for quotations), 5MB limit. Exports uploadLeadPhoto (single "photo", images only) and uploadQuotationFile (single "file", images + pdf).

### Backend/Utils/generateId.js (modified)
- Add generateQuotationId() -> generateId("quotation", "SUI-Q").
- Modify generateDealId(serviceType): resolve the active ServicePrefix for serviceType; prefix "SUI-D-<CODE>"; fallback "SUI-D".

## Frontend Structure

### New API clients (Frontend/src/api)
- dashboardApi.js: getDashboardSummary()
- quotationApi.js: createQuotation, getQuotations, getQuotationById, updateQuotation, selectQuotation, deleteQuotation
- reportsApi.js: getSalesReport, getCommissionReport, getConversionReport, getVendorReport
- commissionApi.js: getCommissionSummary
- settingsApi.js: getPrefixes, createPrefix, updatePrefix, deletePrefix
- dbUtilityApi.js: exportCollection(collection, format) -> triggers a file download

### Pages (replace placeholders)
- Dashboard.jsx: KPI cards + deal-stage funnel + commission widget (dashboardApi)
- Quotations.jsx: lead picker, list sorted by price, upload form, Select-best action (quotationApi)
- Reports.jsx: report-type selector + date range + table rendering (reportsApi)
- Commission.jsx: per-rep summary cards + deals table + Mark Paid (commissionApi + dealsApi.updateDeal)
- Settings.jsx: prefix table + add/edit/toggle (settingsApi)
- DbUtility.jsx (new): collection + format selector + download button (dbUtilityApi)

### Components
- PhotoUpload.jsx (new): props { photos, canEdit, onUpload(file), onRemove(index) }; thumbnail grid + remove; uses leadsApi.uploadLeadPhoto/removeLeadPhoto.

### Routing / nav
- App.jsx: add /db-utility route (RoleRoute superadmin).
- Sidebar.jsx: add DbUtility nav entry (superadmin only).

## Correctness Properties

Property 1: RBAC scoping

For any request to a Dashboard/Reports/Commission endpoint, sales users only ever receive their own leads/deals/commission; manager/superadmin receive all. Each new endpoint enforces requireRole and returns 403 to disallowed roles.

**Validates: Requirements 2.2**

Property 2: Quotation selection is manual

For any select-best action, exactly one quotation per leadId is marked isSelected and Deal.buyingCost is never mutated (per the R3.3 decision).

**Validates: Requirements 3.3**

Property 3: Deal ID uniqueness

For any deal creation, the (prefix, year) Counter sequence is incremented atomically via findOneAndUpdate with $inc and upsert; new SUI-D-<CODE> keys never collide with the existing deal key, and existing deal IDs are unchanged.

**Validates: Requirements 8.3**

Property 4: Secret safety in export

For any Users export, password and RefreshToken are never emitted regardless of format.

**Validates: Requirements 6.2**

Property 5: Backward compatibility

Leads without the new R1 fields load and edit normally; deals created before R8 keep SUI-D-YYYY-XXXX.

**Validates: Requirements 8.4**

Property 6: Streaming export

Large collections are streamed (JSON and CSV) without buffering the full result set in memory.

**Validates: Requirements 6.3**

Property 7: Auditability

Every mutating action (quotation create/update/select/delete, settings change, db export) writes an AuditLog entry.

**Validates: Requirements 3.1**

## Error Handling

- All controller actions are wrapped in AsyncHandler; thrown ApiError(statusCode, message) becomes a JSON error response.
- Multer limits: image/quotation uploads reject files over 5MB or with disallowed MIME with a 400 ApiError.
- R8 fallback: when serviceType has no active matching ServicePrefix, generateDealId falls back to SUI-D and logs a warning (never throws).
- Aggregation endpoints return empty arrays/zero counts (not 404) when no records match a date range.
- DB export: unknown collection or format returns 400; non-superadmin returns 403; streaming errors abort the response with a logged error.
- Frontend: api errors surface via the existing error-banner/AlertCircle pattern used across pages; failed downloads show an inline message.

## Testing Strategy

- Backend: node --check on all new/modified JS files; manual API smoke (curl) for one endpoint per module against a running server.
- Frontend: vite build must pass; oxlint clean; manual UI smoke per page.
- Each requirement acceptance criterion (R1.x .. R8.x) is verified in tasks.md.
- RBAC checks: confirm 403 for under-privileged roles on each new endpoint.
- Backward compatibility: existing deals keep SUI-D-YYYY-XXXX IDs; existing leads without the new fields still load.

## Risks / Notes

- Aggregation endpoints scan growing collections; rely on existing indexes (status, stage, createdBy) and prefer createdAt for date-range filters.
- File uploads require public/uploads/leads and public/uploads/quotations to exist (create at startup or on first write).
- Stream CSV export row-by-row; do not buffer a full collection in memory.
- R8 Counter must be keyed by deal-<CODE> per year; ensure new keys do not collide with the existing deal counter.
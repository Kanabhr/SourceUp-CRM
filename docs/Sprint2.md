# Sprint 2 — Prototype Showcase Build

## Goal
Deliver a working end-to-end prototype covering Leads (extended), Deals, and Purchase modules that can be demonstrated to founders. Speed over perfection — every feature must be functional, not polished.

## Audit Note
All code generated in this sprint will be audited after completion for bugs, security issues, and consistency with existing codebase patterns before production deployment.

---

## What Gets Built

### 1. Leads — Extended Fields (30 min)
Complete the partial work already started. Add to schema + controller + form.

**New fields (schema + controller):**
- `businessType`: enum ["D2C", "E-com", "B2B", "Other"]
- `serviceType`: enum ["Sourcing", "Packaging", "Website & IT", "Social Media", "Legal", "Investment", "Consultancy"]
- `sourcingOrigin`: enum ["India", "China", "Either"]
- `gstNo`: String, optional
- `expectedOrderValue`: Number, optional — flag in UI if < 100000 (₹1L)
- `nextFollowUpDate`: Date, optional
- `lastContactDate`: Date, optional
- `remarks`: String (replaces/supplements notes for quick comments)
- `lostReason`: String — only relevant when status = Closed Lost

**Frontend changes:**
- Add these fields to `AddLeadModal` (Row 5 and Row 6)
- Add `businessType` and `serviceType` badges to the leads table
- Show ₹1L warning flag in table if expectedOrderValue < 100000
- Add `lostReason` input in LeadDetail when advancing to Closed Lost
- Add `nextFollowUpDate` chip on lead detail card

**Files to change:**
- `Backend/MongoDB/Models/Lead.schema.js` — add fields + export constants
- `Backend/Controllers/Lead.controller.js` — destructure + save new fields in createLead and updateLead
- `Frontend/src/Pages/Leads.jsx` — AddLeadModal new rows
- `Frontend/src/Pages/LeadDetail.jsx` — show new fields in Details tab, lostReason on Closed Lost advance

---

### 2. Auto ID System (30 min)
Generate readable IDs: `SUI-L-2026-0001`, `SUI-D-2026-0001`, `SUI-P-2026-0001`

**Pattern:** `[PREFIX]-[YEAR]-[SEQUENCE padded to 4 digits]`
- Sequences reset per year
- Atomic — no duplicate IDs under concurrent saves
- Uses a `Counter` collection with `{ entity, year, seq }` + `findOneAndUpdate` with `$inc`

**Files to create:**
- `Backend/MongoDB/Models/Counter.schema.js` — Counter model
- `Backend/Utils/generateId.js` — `generateLeadId()`, `generateDealId()`, `generatePoId()`

**Files to change:**
- `Backend/Controllers/Lead.controller.js` — call `generateLeadId()` in createLead, store as `leadId` field
- `Backend/MongoDB/Models/Lead.schema.js` — add `leadId: String, unique: true`

---

### 3. Deals Module (2 hrs)

#### Backend
**Schema:** `Backend/MongoDB/Models/Deal.schema.js`
```
dealId: String (SUI-D-YYYY-XXXX, auto)
leadId: ref(Lead), required
customerName: String
salesRep: ref(User)
quotationNo: String
quotationDate: Date
piNo: String
invoiceNo: String
sellingPricePerUnit: Number
qty: Number
orderValue: Number (auto = sellingPrice * qty)
buyingCost: Number (auto-populated from Purchase)
landedCost: Number (auto from Purchase)
grossProfit: Number (auto = orderValue - landedCost * qty)
grossProfitPct: Number (auto)
commissionPct: Number, default: 20
commissionAmount: Number (auto = GP * commissionPct/100)
commissionStatus: enum ["Pending", "Paid"], default: "Pending"
sample: { required: Boolean, sentDate: Date, approved: Boolean }
advance: { amount: Number, receivedDate: Date }
balance: { amount: Number, dueTrigger: enum["Dispatch", "Reaching India"], receivedDate: Date }
orderConfirmDate: Date
expectedDelivery: Date
actualDelivery: Date
stage: enum [
  "Quotation Sent", "Negotiation", "Sample",
  "Won", "Advance Received", "In Production",
  "Dispatched", "Delivered", "Closed", "Lost"
]
stageHistory: [{ stage, changedBy, changedAt, remark }]
createdBy: ref(User)
```

**Controller:** `Backend/Controllers/Deal.controller.js`
- `createDeal` — requires leadId, auto-generates dealId, creates stageHistory entry
- `getDeals` — paginated, filter by stage/salesRep/leadId, scope sales to own deals
- `getDealById`
- `updateDeal` — stage transition validation, auto-recalculate GP/commission on price change
- `deleteDeal` — superadmin only

**Routes:** `Backend/Routes/Deal.routes.js`
```
GET    /api/v1/deals          sales, manager, superadmin
POST   /api/v1/deals          sales, superadmin
GET    /api/v1/deals/:id      sales (own), manager, superadmin
PATCH  /api/v1/deals/:id      sales (own), superadmin
DELETE /api/v1/deals/:id      superadmin
```

**Register in app.js:** `app.use("/api/v1/deals", dealRouter)`

#### Frontend
**API:** `Frontend/src/api/dealsApi.js`
- `getDeals(params)`, `getDealById(id)`, `createDeal(data)`, `updateDeal(id, data)`, `deleteDeal(id)`

**Pages:**
- `Frontend/src/Pages/Deals.jsx` — table (dealId, customer, stage, orderValue, GP%, commission status), Add Deal button, stage filter
- `Frontend/src/Pages/DealDetail.jsx` — stage tracker (9 steps), editable fields, auto-calc display for GP/commission, sample tracking, payment tracking

**App.jsx:** add `/deals/:id` route under the existing sales RoleRoute

**Key UI rules:**
- GP and commission are display-only (auto-calculated, never editable)
- Commission status toggle: Pending → Paid button
- Stage tracker same visual pattern as LeadDetail StatusTracker
- orderValue, GP, commission recalculate in real time as user edits prices in form

---

### 4. Purchase Module (1.5 hrs)

#### Backend
**Schema:** `Backend/MongoDB/Models/Purchase.schema.js`
```
poId: String (SUI-P-YYYY-XXXX, auto)
dealId: ref(Deal), required
vendorName: String
vendorCountry: enum ["India", "China", "Other"]
vendorContact: String
product: String
specs: String
qty: Number
unitCost: Number
currency: enum ["INR", "CNY", "USD"], default: "INR"
exchangeRate: Number, default: 1
packagingCost: Number, default: 0
// China-specific costs (only relevant when vendorCountry = China)
freight: Number, default: 0
customsDuty: Number, default: 0
clearingCharges: Number, default: 0
insurance: Number, default: 0
// Auto-calculated
landedCostPerUnit: Number (auto)
totalLandedCost: Number (auto)
// Payment
vendorPaymentTerms: String
advancePaid: { amount: Number, date: Date }
balancePaid: { amount: Number, date: Date }
// Dates
productionStart: Date
readyDate: Date
dispatchDate: Date
etaIndia: Date
receivedDate: Date
// Tracking
blNo: String
trackingNo: String
// QC
qcStatus: enum ["Pending", "Passed", "Failed"], default: "Pending"
qcRemarks: String
// Assignment
assignedTo: ref(User)
status: enum [
  "PO Raised", "In Production", "QC",
  "Dispatched", "Received", "Closed"
]
statusHistory: [{ status, changedBy, changedAt, remark }]
createdBy: ref(User)
```

**Landed cost formula:**
```
landedCostPerUnit = unitCost * exchangeRate
  + packagingCost / qty
  + (vendorCountry === "China" ? (freight + customsDuty + clearingCharges + insurance) / qty : 0)
```

**Controller:** `Backend/Controllers/Purchase.controller.js`
- `createPO` — auto-generates poId, calculates landedCostPerUnit, updates linked Deal's `buyingCost` and `landedCost` fields + recalculates GP
- `getPOs` — paginated, filter by status/dealId/vendorCountry
- `getPOById`
- `updatePO` — recalculate landed cost on any cost field change, push to Deal
- `deletePO` — superadmin only

**Routes:** `Backend/Routes/Purchase.routes.js`
```
GET    /api/v1/purchase        all roles
POST   /api/v1/purchase        superadmin, manager
GET    /api/v1/purchase/:id    all roles
PATCH  /api/v1/purchase/:id    superadmin, manager
DELETE /api/v1/purchase/:id    superadmin
```

**Register in app.js:** `app.use("/api/v1/purchase", purchaseRouter)`

#### Frontend
**API:** `Frontend/src/api/purchaseApi.js`
- `getPOs(params)`, `getPOById(id)`, `createPO(data)`, `updatePO(id, data)`, `deletePO(id)`

**Pages:**
- `Frontend/src/Pages/Purchase.jsx` — table (poId, vendor, product, landedCost, status), Add PO button, status filter
- `Frontend/src/Pages/PurchaseDetail.jsx` — status tracker (6 steps), cost breakdown panel showing all China costs + auto landed cost, date tracking, QC section

**App.jsx:** add `/purchase/:id` route under the existing purchase RoleRoute

**Key UI rules:**
- Show China-specific cost fields only when `vendorCountry === "China"`
- Landed cost updates live as user edits cost fields
- "Linked Deal" chip shows dealId, clicking navigates to `/deals/:id`

---

## Codebase Standards to Follow

These must be followed exactly — the auditor will check each one:

### Backend
1. **Always use `AsyncHandler`** — never use try/catch inside route handlers directly
2. **Always throw `ApiError`** — never `res.status(x).json({error:...})` directly
3. **Always return `ApiResponse`** — `res.status(x).json(new ApiResponse(x, data, message))`
4. **Mongoose models** — always `.lean()` on read queries, always `.populate()` ref fields before returning
5. **Role scoping** — sales users must only see their own records (use `scopeFilter` pattern from Lead.controller.js)
6. **AuditLog** — every CREATE, UPDATE (status change), DELETE must write to AuditLog
7. **Import order** — AsyncHandler, ApiError, ApiResponse, models, utils
8. **ESM** — all files use `import/export`, never `require()`

### Frontend
1. **PortalDropdown** — use for ALL select inputs, never native `<select>`
2. **glass + r-lg** — all card containers use these classes
3. **input-glass** — all text inputs use this class
4. **btn-primary / btn-ghost** — all buttons use these classes
5. **Status trackers** — replicate the exact StatusTracker pattern from LeadDetail.jsx (dots + connectors + colors)
6. **Error handling** — always `err.response?.data?.message || "fallback"` in catch blocks
7. **Loading states** — every API call must show a loading state
8. **Role gating** — check `user?.role` before showing edit/delete buttons
9. **Auto-calculated fields** — display-only, styled with `color: var(--accent)` and a small "auto" label
10. **navigate()** — use React Router `useNavigate()`, never `window.location`

### Naming conventions
- Controllers: `PascalCase.controller.js`
- Routes: `PascalCase.routes.js`
- Schema: `PascalCase.schema.js`
- Frontend pages: `PascalCase.jsx`
- Frontend API files: `camelCaseApi.js`
- Constants (enums): `SCREAMING_SNAKE_CASE` arrays exported from schema file

---

## API Endpoint Summary

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | /api/v1/deals | Yes | sales, manager, superadmin |
| POST | /api/v1/deals | Yes | sales, superadmin |
| GET | /api/v1/deals/:id | Yes | sales (own), manager, superadmin |
| PATCH | /api/v1/deals/:id | Yes | sales (own), superadmin |
| DELETE | /api/v1/deals/:id | Yes | superadmin |
| GET | /api/v1/purchase | Yes | all |
| POST | /api/v1/purchase | Yes | superadmin, manager |
| GET | /api/v1/purchase/:id | Yes | all |
| PATCH | /api/v1/purchase/:id | Yes | superadmin, manager |
| DELETE | /api/v1/purchase/:id | Yes | superadmin |

---

## MongoDB Models Summary

| Model | Collection | Key relationships |
|-------|-----------|-------------------|
| Lead | leads | createdBy → User, assignedTo → User |
| Deal | deals | leadId → Lead, salesRep → User, createdBy → User |
| Purchase | purchases | dealId → Deal, assignedTo → User, createdBy → User |
| Counter | counters | standalone — entity + year + seq |

---

## Auto-ID Counter Pattern

```js
// Backend/MongoDB/Models/Counter.schema.js
const counterSchema = new mongoose.Schema({
  entity: String,  // "lead", "deal", "purchase"
  year: Number,
  seq: { type: Number, default: 0 },
});
counterSchema.index({ entity: 1, year: 1 }, { unique: true });

// Backend/Utils/generateId.js
export async function generateId(entity, prefix) {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { entity, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${year}-${String(counter.seq).padStart(4, "0")}`;
}
// Usage:
// generateId("lead", "SUI-L")     → "SUI-L-2026-0001"
// generateId("deal", "SUI-D")     → "SUI-D-2026-0001"
// generateId("purchase", "SUI-P") → "SUI-P-2026-0001"
```

---

## Acceptance Criteria for Prototype Demo

- [ ] Sales user can create a lead with businessType, serviceType, sourcingOrigin
- [ ] Lead shows SUI-L-YYYY-XXXX ID in detail page
- [ ] Sales user can create a deal linked to a lead
- [ ] Deal shows GP and commission auto-calculated
- [ ] Deal stage can be advanced through the pipeline
- [ ] Superadmin can create a PO linked to a deal
- [ ] China cost fields appear only when vendor country = China
- [ ] Landed cost auto-calculates and updates the linked deal's buying cost
- [ ] All three modules have working list pages with filters
- [ ] Role access is enforced (sales can't access purchase module)

---

## What Is NOT in Scope for This Sprint

- Photo/file uploads (needs Cloudinary — defer to Sprint 3)
- Payment tracking (advance 70% / balance 30%) — schema fields exist, UI deferred
- QC photo uploads — schema field exists, UI deferred
- Sample tracking UI — schema field exists, UI deferred
- Dashboard widgets — Sprint 3
- Reports — Sprint 4
- Email notifications — Sprint 4

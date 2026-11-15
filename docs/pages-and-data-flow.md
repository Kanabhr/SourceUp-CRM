# SourceUp CRM — Pages & Data Flow Guide

A plain-English reference for every page in the app: what it does, who can use it, and how data moves between the browser and the database.

---

## How the App Is Structured

```
Browser (React + Vite)
        │
        │  HTTP/JSON  (credentials via httpOnly cookie)
        ▼
Backend (Node / Express)  →  MongoDB
```

Every API call goes to `http://localhost:3000/api/v1/...`.  
The browser stores an **access token** in a httpOnly cookie — no token is visible in JavaScript.  
Every protected route checks that cookie with **VerifyJWT** before doing anything.

---

## Roles

| Role | What they can do |
|---|---|
| **superadmin** | Everything — all pages, all data |
| **manager** | Leads, Deals, Commission, Vendors, Purchase, Dashboard, Reports |
| **sales** | Own leads, Deals, Commission, Vendors (read) |
| **purchase** | Purchase orders, Vendors, Quotations |

---

## Pages

### 1. Login `/login`
**Who:** Everyone (public page — redirects away if already logged in)

**What it does:**  
You enter your email and password. The backend checks the password hash, then sets two httpOnly cookies: an **access token** (short-lived) and a **refresh token** (long-lived).

**Data flow:**
```
Form submit → POST /api/v1/auth/login
           ← Sets accessToken + refreshToken cookies
           ← Returns { _id, username, email, role }
           → Stored in React AuthContext (in memory only)
           → Redirected to /leads (or /dashboard for managers)
```

---

### 2. Register `/register`
**Who:** Public — but only works for the **very first user ever** in the system.

**What it does:**  
Creates the first superadmin account. After that, all accounts must be created by a superadmin on the Users page. Trying to register a second account returns a 403 error.

---

### 3. Leads `/leads`
**Who:** superadmin, manager, sales

**What it does:**  
The main list of all business leads (potential customers). Sales users only see leads assigned to them. You can search, filter by status, and add new leads via a modal form.

**Key fields on a lead:**  
Client name, company, product needed, service type (Sourcing / Packaging / Web etc.), source, status (Open → In Progress → Quotation Sent → Closed Won/Lost), assigned sales rep, cost per lead, expected order value, GST number, business type.

**Data flow:**
```
Page load  → GET /api/v1/leads?page=1&limit=20&search=...&status=...
           ← { leads: [...], pagination: { total, page, pages } }

Add lead   → POST /api/v1/leads  (JSON body with all fields)
           ← { data: newLead }
           → Row appears in list

Bulk import → POST /api/v1/leads/import/preview  (CSV file upload)
            → POST /api/v1/leads/import/confirm   (after user reviews preview)
```

---

### 4. Lead Detail `/leads/:id`
**Who:** superadmin, manager, sales

**What it does:**  
The full profile of a single lead. Everything about that lead lives here. You can inline-edit any field, advance the lead through its status pipeline, add notes, upload reference photos, and see all quotations linked to this lead.

**Sections on the page:**

| Section | What's in it |
|---|---|
| Header | Lead ID, status badge, delete button |
| Core Info | Client, company, contact, email, phone, product, source |
| Business Details | Business type, service type, GST, sourcing origin |
| Financials | Cost per lead, expected order value, remarks |
| Procurement | Packing details, MOQ, CBP, target price |
| Reference Photos | Upload / view / remove product images |
| Quotations | See all vendor quotations for this lead, mark one as selected |
| Notes | Time-stamped notes log |
| History | Audit trail of every field change |

**Data flow:**
```
Page load     → GET /api/v1/leads/:id
              ← Full lead object with populated assignedTo

Edit a field  → PATCH /api/v1/leads/:id  { fieldName: newValue }
              ← Updated lead object (re-renders just that field)

Upload photo  → POST /api/v1/leads/:id/photos  (multipart, field: "photo")
              ← Updated lead with new filename in photos[]
              → File saved to  Backend/public/uploads/leads/

Remove photo  → DELETE /api/v1/leads/:id/photos/:index
              ← Updated lead with filename removed
              → File deleted from disk

Add note      → POST /api/v1/leads/:id/notes  { text }
              ← Updated lead with note appended

Advance status→ PATCH /api/v1/leads/:id  { status: "In Progress" }
```

---

### 5. Deals `/deals`
**Who:** superadmin, manager, sales

**What it does:**  
Deals are created when a lead has a confirmed order. A deal always links back to a lead. The list shows all deals with their stage, commission status, and revenue.

**Key fields:** Deal ID (e.g. `SUI-D-SRC-2026-0001`), linked lead, customer name, sales rep, selling price per unit, quantity, commission %, quotation number, PI number, invoice number, order confirm date, expected delivery, sample/advance/balance flags.

The deal ID is automatically generated using the lead's service type → e.g. a Sourcing lead gets `SUI-D-SRC-...`, a Packaging lead gets `SUI-D-PKG-...`.

**Data flow:**
```
Page load   → GET /api/v1/deals?page=1&limit=20&search=...
            ← { deals: [...], pagination }

Create deal → POST /api/v1/deals  { leadId, customerName, sellingPricePerUnit, qty, ... }
            ← { data: newDeal }   (Deal ID auto-generated from lead's serviceType)

Click row   → Navigate to /deals/:id
```

---

### 6. Deal Detail `/deals/:id`
**Who:** superadmin, manager, sales

**What it does:**  
Full view of one deal. You can edit any field inline, advance the deal stage, and mark commission as Paid.

**Data flow:**
```
Page load  → GET /api/v1/deals/:id
           ← Deal object with salesRep and leadId populated

Edit field → PATCH /api/v1/deals/:id  { field: value }
           ← Updated deal
```

---

### 7. Purchase `/purchase`
**Who:** superadmin, manager, purchase

**What it does:**  
Purchase Orders (POs) track the buying side — ordering goods from a vendor. A PO links to a Deal (so you always know which customer order triggered the purchase). It tracks costs: unit cost, freight, customs duty, packaging, clearing charges, insurance.

**Key fields:** PO ID (`SUI-P-YYYY-XXXX`), linked deal, vendor, product, specs, quantity, unit cost, currency, exchange rate, all cost components, status (PO Raised → In Production → QC → Dispatched → Received → Closed).

**Data flow:**
```
Page load    → GET /api/v1/purchase?page=1&limit=20
             ← { pos: [...], pagination }

Also fetches → GET /api/v1/deals  (to populate the Deal picker in the Add PO form)
             → GET /api/v1/vendors (to populate the Vendor picker)

Create PO    → POST /api/v1/purchase  { dealId, vendorRef, product, qty, unitCost, ... }
             ← { data: newPO }

Click row    → Navigate to /purchase/:id
```

---

### 8. Purchase Detail `/purchase/:id`
**Who:** superadmin, manager, purchase

**What it does:**  
Full view of one PO. Inline-edit fields. Advance the status through the fulfilment pipeline.

---

### 9. Vendors `/vendors`
**Who:** superadmin, manager, purchase, sales (sales is read-only)

**What it does:**  
The supplier directory. You can add vendors, edit their details, and mark them active/inactive. Vendors are referenced from Purchase Orders and Quotations.

**Key fields:** Vendor ID (`SUI-V-YYYY-XXXX`), company name, contact person, email, phone, country (India / China / Other), category (Packaging / Electronics / Apparel etc.), status (Active / Inactive), rating.

**Data flow:**
```
Page load     → GET /api/v1/vendors?page=1&limit=20&search=...
              ← { vendors: [...], pagination }

Create vendor → POST /api/v1/vendors  { companyName, contactPerson, email, ... }
              ← { data: newVendor }

Edit inline   → PATCH /api/v1/vendors/:id
Delete        → DELETE /api/v1/vendors/:id
```

---

### 10. Quotations `/quotations`
**Who:** superadmin, manager, purchase (read-only for sales)

**What it does:**  
A standalone list page for quotations. (Note: quotations also appear embedded inside Lead Detail.) A quotation is a vendor price offer for a specific product on a lead — before an order is confirmed.

**Key fields:** Quotation ID (`SUI-Q-YYYY-XXXX`), linked lead, optional linked deal, vendor name, product, price, currency (INR/CNY/USD), exchange rate, validity date, terms, optional file attachment (PDF or image), isSelected flag.

**Data flow:**  
Quotations on the `/quotations` page pull all quotations. On Lead Detail, only quotations for that lead are shown via `?leadId=...`.

```
GET    /api/v1/quotations?leadId=...  → list for a lead
POST   /api/v1/quotations             → create (multipart, optional file)
PATCH  /api/v1/quotations/:id         → update
POST   /api/v1/quotations/:id/select  → mark as selected (deselects others on same lead)
DELETE /api/v1/quotations/:id         → delete record + file from disk
```

---

### 11. Dashboard `/dashboard`
**Who:** superadmin, manager only

**What it does:**  
A summary overview of the business — numbers pulled live from the database every page load.

**What you see:**
- **KPI cards:** Total Deals, Total Revenue (₹), Average Deal Value (₹), Total Commission (₹)
- **Lead funnel:** total leads broken down by status (Open, In Progress, Quotation Sent, Closed Won/Lost) shown as horizontal bars
- **Monthly Sales chart:** a 12-month CSS bar chart of revenue by month
- **Deals by Stage table:** count of deals per pipeline stage

**Data flow:**
```
Page load → GET /api/v1/dashboard
          ← {
               deals: { totalDeals, totalRevenue, totalCommission, avgDealValue,
                         dealsByStatus, dealsByService, monthlySales[] },
               leads: { totalLeads, leadsByStatus, leadsByService, leadsBySource }
             }
```
The backend runs 8 MongoDB aggregation pipelines in parallel to compute these numbers.

---

### 12. Reports `/reports`
**Who:** superadmin, manager only

**What it does:**  
Two filterable report tabs:

**Sales Report tab** — filter by date range and service type. Shows a KPI strip (total deals/revenue/commission) plus a table of individual deals with deal ID, sales rep, price, qty, revenue, and commission.

**Leads Report tab** — filter by date range, status, and service type. Shows lead stats breakdown plus a table of individual leads.

**Data flow:**
```
Sales tab  → GET /api/v1/reports/sales?startDate=...&endDate=...&serviceType=...
           ← { kpis: {...}, deals: [...] }

Leads tab  → GET /api/v1/reports/leads?startDate=...&endDate=...&status=...
           ← { stats: {...}, leads: [...] }
```

---

### 13. Commission `/commission`
**Who:** superadmin, manager, sales

**What it does:**  
Shows commission earned per sales rep across all deals. Filter by date range and optionally a specific sales rep ID. Displays a ranked table (highest commission first) with total deals, total revenue, and commission earned. A "Total Commission Payable" sum appears at the bottom.

**Data flow:**
```
Click Fetch → GET /api/v1/reports/commission?startDate=...&endDate=...&salesRep=...
           ← { commissions: [
                { salesRepId, username, totalDeals, totalRevenue, totalCommission }
              ] }
```
The backend uses a MongoDB `$group` pipeline to aggregate per sales rep, then a `$lookup` to resolve usernames.

---

### 14. Users `/users`
**Who:** superadmin only

**What it does:**  
Create new user accounts and see the list of all users. The registration page is closed after the first superadmin is created — all future accounts must be created here.

**Key fields:** Username (5-16 chars), email, password (strong password required), role (sales / purchase / manager / superadmin).

**Data flow:**
```
Page load   → GET /api/v1/users
            ← [ { _id, username, email, role, isActive, createdAt } ]

Create user → POST /api/v1/users  { username, email, password, role }
            ← { data: newUser }
            → User appears in list; can now log in
```

---

### 15. Settings `/settings`
**Who:** superadmin only

**What it does:**  
Manage the **Service Prefix** codes used to generate deal IDs. The 7 default prefixes (SRC, PKG, WEB, SMM, LEG, INV, CON) cannot be deleted but can be renamed or toggled inactive. Custom prefixes can be added and deleted.

When a prefix is **inactive**, new deals for that service type fall back to the generic `SUI-D-YYYY-XXXX` format.

**Data flow:**
```
Page load    → GET /api/v1/service-prefixes
             ← { prefixes: [{ _id, code, name, isActive }] }

Add prefix   → POST /api/v1/service-prefixes  { code: "MFG", name: "Manufacturing" }
             ← { data: newPrefix }

Edit name    → PATCH /api/v1/service-prefixes/:id  { name: "New Name" }

Toggle on/off→ POST /api/v1/service-prefixes/:id/toggle
             ← { data: updatedPrefix }

Delete       → DELETE /api/v1/service-prefixes/:id
             ← 403 if it is one of the 7 seeded defaults
```

---

### 16. Export `/export`
**Who:** superadmin only

**What it does:**  
Download a full copy of any collection as a CSV or JSON file. Useful for backups, audits, or sharing data with external tools.

**Collections you can export:** Leads, Deals, Vendors, Quotations.  
**Formats:** CSV or JSON.  
**Optional filters:** Start date and end date.

The download is triggered as a real browser file download — the backend streams the file with a `Content-Disposition: attachment` header and the frontend triggers a click on a temporary link.

**Data flow:**
```
Click Export → GET /api/v1/export?entity=leads&format=csv&startDate=...&endDate=...
             ← File download (text/csv or application/json)
             → Browser saves to Downloads folder
```

---

## How Data Connects Across Pages

```
Lead ──────────────────┐
  │                    │
  │ (leadId)           │ (leadId)
  ▼                    ▼
Deal               Quotation
  │
  │ (dealId)
  ▼
Purchase Order ──── Vendor
  │
  │ (dealId → lead → serviceType)
  ▼
Deal ID (SUI-D-SRC-2026-0001) ← generated at Deal creation
```

- A **Lead** is the starting point for everything.
- A **Deal** is created from a Lead when an order is confirmed. The Deal ID encodes the service type prefix.
- **Quotations** are attached to a Lead (and optionally a Deal) to compare vendor prices before committing.
- A **Purchase Order** is created from a Deal to track the buy side from a vendor.
- **Vendors** are a standalone directory referenced by both POs and Quotations.
- **Dashboard / Reports / Commission** are read-only views that aggregate the above data.

---

## Authentication Flow (How Login Works)

```
1. User submits email + password on /login
2. Backend:
   a. Finds user by email
   b. Compares password with bcrypt hash
   c. Generates accessToken (JWT, 1 day) + refreshToken (JWT, 10 days)
   d. Saves refreshToken hash to User document in MongoDB
   e. Sets both as httpOnly, secure cookies
3. Browser stores cookies automatically (no JS access)
4. Every subsequent API call includes cookies automatically
5. VerifyJWT middleware on every protected route:
   a. Reads cookie
   b. Verifies JWT signature + expiry
   c. Looks up User in DB
   d. Attaches user object to req.user
6. requireRole("manager","superadmin") then checks req.user.role
```

If the access token expires, the frontend calls `POST /api/v1/auth/refresh` using the refresh token cookie to get a new access token silently.

---

## File Uploads

Two types of files can be uploaded:

| Type | Field name | Accepted formats | Stored at |
|---|---|---|---|
| Lead reference photo | `photo` | JPEG, PNG, WebP | `Backend/public/uploads/leads/` |
| Quotation attachment | `file` | JPEG, PNG, WebP, PDF | `Backend/public/uploads/quotations/` |

Files are served statically by Express at `/uploads/...`. In development, Vite proxies `/uploads` to the backend so the frontend can display them.

Filenames are randomized (`<timestamp>-<random>.<ext>`) to avoid collisions.

---

## ID Formats

| Entity | Format | Example |
|---|---|---|
| Lead | `SUI-L-YYYY-XXXX` | `SUI-L-2026-0042` |
| Deal | `SUI-D-{PREFIX}-YYYY-XXXX` | `SUI-D-SRC-2026-0001` |
| Purchase Order | `SUI-P-YYYY-XXXX` | `SUI-P-2026-0007` |
| Vendor | `SUI-V-YYYY-XXXX` | `SUI-V-2026-0003` |
| Quotation | `SUI-Q-YYYY-XXXX` | `SUI-Q-2026-0011` |

Sequences reset each calendar year. Each prefix (for deals) has its own independent counter.

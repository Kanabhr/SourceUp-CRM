# SourceUp CRM — Core SRS (Phase 1)

## Purpose
Track leads, vendors, quotations, and deals for SourceUp India's sourcing business.
Replaces spreadsheet tracking. Accessible via web browser.

## Out of Scope (Phase 1)
- WhatsApp API integration
- Payment Gateway integration
- DB dump/linking utility
- Website auto lead capture
- Accounting or HR modules
- Mobile/desktop app
- Real-time push notifications (polling only)
- Document attachments on deals

---

## Users & Roles

| Role | Can Access |
|------|-----------|
| SuperAdmin | Everything + user management + prefix settings |
| Sales | Own leads, own deals, own commission |
| Purchase | Vendors, quotations |
| Manager | Dashboard, all leads, all deals, all reports |

---

## Module 1 — Auth
- Login / logout with JWT + HttpOnly cookies
- 30-minute session timeout
- SuperAdmin creates and manages user accounts
- Role assigned at account creation — not self-selectable

---

## Module 2 — Leads

### Fields
Client name, company, contact person, email, phone, product needed, source (website/phone/referral), date, cost-per-lead (required), assigned salesperson, verification status, verification remarks

### Status Flow
Open → In Progress → Quotation Sent → Closed Won / Closed Lost

### Rules
- Cost-per-lead is required — cannot be empty
- Cannot set Closed Won without a linked deal
- Duplicate phone/email shows a warning
- Every status change is logged with user and timestamp
- Sales staff see only their own leads
- Notes can be added at any stage

---

## Module 3 — Purchase

### Vendors
Name, contact, phone, email, address, country, product categories, type (Vendor or Importer)

### Quotations
Linked lead, vendor, product details, quantity, specs, deadline, quoted price (INR), validity date, delivery terms, payment terms, status

### Status Flow
Requested → Received → Under Review → Approved / Rejected

### Rules
- Currency is INR only
- Approving one quotation rejects all others for that lead
- Expired validity date shows a warning
- At least one approved quotation required before a deal can be created

---

## Module 4 — Sales & Deals

### Deal Number Format
`[PREFIX]-[YEAR]-[SEQUENCE]` e.g. `SRC-2026-0001`

### 7 Default Prefixes
SRC, PKG, WEB, SMM, LEG, INV, CON
SuperAdmin can add or edit prefixes.

### Deal Fields
Deal number (auto, non-editable), linked lead, linked quotation, salesperson, service type, client, product, quantity, final price, cost price, payment terms, delivery date, commission %, commission amount

### Deal Stage Flow
Quotation Sent → Negotiation → PO Received → In Production → Shipped → Delivered → Payment Received

### Rules
- Deal number generated atomically — no duplicates under concurrent load
- Deal number cannot be edited after creation
- Commission = % of profit margin (finalPrice - costPrice)
- Commission cannot exceed profit margin
- Deal must link to a verified lead and an approved quotation

---

## Module 5 — Dashboard

| Widget | Shows |
|--------|-------|
| Total revenue | Sum for selected period vs previous period |
| Active deals | Deal number, client, value, stage, salesperson |
| Commission summary | Per salesperson — deals, revenue, commission |
| Lead funnel | Count per status stage |
| Pending quotations | Count + list |
| Top performer | Salesperson with highest revenue |
| Activity feed | Last 20 actions system-wide |

Accessible by Manager and SuperAdmin only.

---

## Module 6 — Reports

All reports exportable as PDF and Excel:
1. Sales report (by period / salesperson)
2. Commission report (per salesperson)
3. Lead conversion report
4. Quotation summary
5. Vendor performance report

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Concurrent users | 15+ |
| Page load | Under 3 seconds |
| Dashboard refresh | Manual refresh button |
| Session timeout | 30 minutes inactivity |
| Uptime | 99.5% during business hours |
| Scale target Year 1 | 10,000 leads, 5,000 deals |
| Localization | English, INR, IST |
| Data migration | None — fresh start |

---

## Tech Stack
- Backend: Node.js + Express 5 + MongoDB + Mongoose 9
- Frontend: React 19 + Vite 8 + Tailwind CSS v4
- Auth: JWT + bcrypt + HttpOnly cookies
- File upload: Multer
- Email: Nodemailer (SMTP)
- PDF: pdfkit
- Excel: exceljs
- Deploy: Render (backend) + Vercel (frontend)

# SourceUp CRM — Business Guide to Every Page

**Audience:** Business stakeholders, team leads, and anyone onboarding to the system.
This document explains each page in plain business language — what it does, what is working right now, what is still missing, and a realistic estimate of how long the remaining work would take.

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ Complete | Fully built and tested — ready to use |
| 🔶 Partial | Core functionality works; some features missing |
| 🔲 Not started | Page exists as a placeholder or has not been designed yet |

---

---

## 1. Login Page ✅

**Business purpose:** This is the front door of the system. Every team member — sales, purchase, manager, or admin — enters their username and password here to gain access. The system automatically sends each person to the right starting page based on their role (managers go to the Dashboard, sales staff go to the Leads list).

**What works:** Full login with secure token-based authentication. Passwords are never stored in plain text. After login, the session is maintained securely via an httpOnly cookie that the browser manages automatically — users stay logged in across page refreshes. Animated glass-effect interface is live.

**What is missing:** There is no "Forgot Password" or password reset flow. If a team member forgets their password, a superadmin currently has to delete and recreate their account.

**Estimate to complete remaining work:** Forgot-password + email reset link — approximately **1–2 days** (requires an email service like SendGrid or Nodemailer to be configured).

---

## 2. Register Page ✅ (Bootstrap only)

**Business purpose:** This page exists purely for the very first time the system is set up. The first person to register automatically becomes the superadmin — the owner of the entire system. After that one account is created, this page becomes locked and shows an error if anyone tries to use it. All future team accounts are created by the superadmin from the Users page.

**What works:** First-user registration works. Password strength and email format are validated. Subsequent registrations are correctly blocked.

**What is missing:** Nothing — this page has done its job once the superadmin account exists. It is intentionally limited by design.

**Estimate to complete remaining work:** None required.

---

## 3. Leads List Page ✅

**Business purpose:** This is the central nerve centre for the sales team. Every potential client (lead) that SourceUp India is pursuing lives here. A sales rep can see only their own leads; managers and the superadmin see everyone's. From this page you can search leads by name, filter by status or service type, add a new lead manually via a form, or bulk-import leads from an Excel file.

**What works:** Full paginated list with search and status filtering. Add-lead form with all fields including the new procurement fields (MOQ, CBP, target price, packing details). Bulk Excel import with an AI-powered preview step before confirming. Role-based visibility is enforced — sales reps see only their assigned leads.

**What is missing:** There is no bulk delete or bulk status change. There is no way to export leads directly from this page (the Export page handles that separately). There is no "duplicate lead" detection or warning.

**Estimate to complete remaining work:** Bulk actions and duplicate detection — approximately **2–3 days**.

---

## 4. Lead Detail Page ✅

**Business purpose:** This is the full profile of a single lead — the most information-dense page in the system. Everything about a potential client lives here: their contact details, what product they need, which service type applies, procurement requirements, the deal history, notes from sales calls, reference product photos, vendor quotations being compared for that lead, and a full audit trail of every change ever made. A sales rep works this page daily to progress a lead through its pipeline (Open → In Progress → Quotation Sent → Closed Won/Lost).

**What works:** Inline editing for every field — click any value to edit it, it saves automatically. Status advancement with a controlled pipeline (you can only move forward, not skip steps). Notes log with timestamps. Reference photo uploads (multiple images, stored on the server). Full quotations panel embedded inside the page showing all vendor quotes for that lead, with the ability to mark one as selected. Complete audit history visible to managers.

**What is missing:** There is no email notification when a lead is assigned or when the status changes. There is no ability to @mention a colleague in a note. There is no reminder or follow-up scheduling feature.

**Estimate to complete remaining work:** Email notifications — **2–3 days**. Reminders/follow-ups — **3–5 days** (requires a scheduler like node-cron or a third-party reminder service).

---

## 5. Deals List Page ✅

**Business purpose:** Deals represent confirmed orders — leads that have converted into actual business. When a customer commits to placing an order, the sales team creates a deal linked to that lead. This page shows all active and closed deals, their stage in the fulfilment pipeline, the revenue figure, and the commission status. Each deal gets a smart ID that reflects the service type (e.g. SUI-D-SRC-2026-0001 for a Sourcing deal, SUI-D-PKG for Packaging).

**What works:** Full paginated list with search. Add-deal form that links to an existing lead (required), sets the price per unit, quantity, commission percentage, sales rep, and key dates. Smart deal ID generation using the lead's service type and the ServicePrefix settings. Stage badges and commission status badges are shown in the list.

**What is missing:** There is no bulk stage update. There is no revenue summary line at the bottom of the list showing total value in view. There is no filter by stage or by commission status directly on the list page.

**Estimate to complete remaining work:** Filter improvements and summary footer — approximately **1 day**.

---

## 6. Deal Detail Page ✅

**Business purpose:** The full profile of a single confirmed deal. This page is where the sales team manages the deal through its lifecycle from "Quotation Sent" all the way to "Closed." It shows all financial details (selling price, quantity, computed revenue, commission amount), key dates, payment milestones (advance received, balance due, sample status), and the linked purchase orders for that deal.

**What works:** Full inline editing for all deal fields. Stage advancement with a controlled pipeline. Commission status can be flipped between Pending and Paid. Linked purchase orders for that deal are visible. Delete deal (superadmin only).

**What is missing:** There is no PDF generation for a Proforma Invoice or Sales Confirmation. There is no email sending from within the deal. The linked quotation (the selected vendor quote) is not surfaced here — you have to go back to the lead to see it.

**Estimate to complete remaining work:** Showing linked quotation on deal detail — **half a day**. PDF/PI generation — **2–3 days** (requires a library like puppeteer or pdfkit).

---

## 7. Quotations Page ✅

**Business purpose:** Before an order is confirmed and a deal is created, the purchase team collects price quotes from multiple vendors for a specific product. This page gives the purchase team a dedicated workspace to manage those quotes. You select a lead, see all the vendor quotations collected for it, compare prices across currencies (INR, CNY, USD), check validity dates, view or download attached files (PDFs or images of the quote), and mark the best quote as "Selected."

**What works:** Lead picker dropdown with all leads listed. Once a lead is selected, all its quotations appear sorted by price (cheapest first). Add new quotation with full details including file attachment. Mark a quotation as selected (automatically deselects all others for that lead). Delete a quotation. The same quotations also appear embedded inside the Lead Detail page — both views stay in sync. URL updates with the leadId so the page is shareable.

**What is missing:** There is no edit functionality on an existing quotation from this page (you cannot update the price or replace the file after creation). There is no side-by-side comparison view for two quotes. There is no currency conversion calculator (e.g. showing the CNY price in INR equivalent using the exchange rate). Most importantly, **there is no PDF generation for a quotation** — the purchase team currently cannot print or email a formatted vendor quotation document to the client or internal team for approval. And critically, **there is no ability to email a quotation directly to the client from within the system** — the client's email address is already stored on the Lead record, but there is zero email-sending infrastructure anywhere in the codebase (no Nodemailer, no SendGrid, no SMTP configuration). This is a significant workflow gap: the purchase team currently has to copy quotation details manually and send emails outside the CRM.

**PDF Quotation requirement:** The system should be able to generate a clean, branded PDF from any quotation record. The PDF should include the quotation ID, lead/client name, vendor name, product description, price, currency, exchange rate, validity date, terms and conditions, and SourceUp India's letterhead. This PDF should be downloadable with one click from the quotation card, and emailed directly to the client's email address (pulled from the linked Lead record) with a single "Send to Client" button.

**Email-to-client requirement:** When the purchase or sales team clicks "Send Quotation to Client," the system should:
1. Generate the PDF on the server.
2. Compose an email to the client's email address stored on the Lead.
3. Attach the PDF to the email.
4. Send it via a configured email service (Nodemailer with Gmail/SMTP or SendGrid).
5. Record a note on the Lead's notes log — "Quotation SUI-Q-XXXX sent to client@email.com on [date]" — so there is a permanent audit trail.

This email infrastructure, once built, can also be reused for other notifications: lead assignment alerts, deal status changes, PO dispatch notifications.

**Estimate to complete remaining work:** Edit quotation — **half a day** (API and form both exist, just needs wiring). Currency conversion helper — **half a day**. **Quotation PDF generation — 2–3 days** (backend: install `puppeteer` or `pdfkit`, design a branded HTML template, expose `GET /api/v1/quotations/:id/pdf`; frontend: "Download PDF" button). **Email-to-client feature — 3–4 days** (set up Nodemailer/SendGrid service module, wire it to the PDF generator, add "Send to Client" button on the quotation card, auto-log a note on the lead). **Total for this page: 6–8 days**.

---

## 8. Purchase Page ✅

**Business purpose:** Once a deal is won and a vendor is selected (via the quotation process), the purchase team raises a Purchase Order (PO) to actually buy the goods. This page tracks every PO — who the vendor is, what is being ordered, at what price and currency, all the landed cost components (freight, customs duty, clearing charges, insurance, packaging), and the current status of the order from "PO Raised" all the way through production, quality control, dispatch, receipt, and closure.

**What works:** Full paginated list of all POs with search. Add PO form linked to a deal and a vendor, with all cost fields including currency and exchange rate. Status badges showing where each PO is in the fulfilment pipeline. Click a row to go to the full PO detail.

**What is missing:** There is no automatic calculation of total landed cost shown on the list page. There is no way to attach shipping documents or QC reports to a PO. There is no email or notification when a PO moves to "Dispatched" or "Received."

**Estimate to complete remaining work:** Document attachments on POs — **2 days** (multer middleware already exists, just needs wiring to the PO model). Status change notifications — **1–2 days**.

---

## 9. Purchase Detail Page ✅

**Business purpose:** The full view of a single Purchase Order. The purchase team uses this daily to update the PO as it moves through production and delivery. Every cost component can be edited inline. The deal this PO is linked to is shown with a link to jump directly to it. The total landed cost is computed from all the cost fields combined.

**What works:** Full inline editing for all PO fields. Status advancement through the fulfilment pipeline with forward-only controls. Computed total cost display. Delete PO (superadmin only). Link to the parent deal.

**What is missing:** No file/document attachment capability (shipping bills, QC reports, packing lists). No comment/note log on the PO itself.

**Estimate to complete remaining work:** Notes and document attachments — **2 days**.

---

## 10. Vendors Page ✅

**Business purpose:** The vendor directory for SourceUp India's supplier network. Every company from whom goods are sourced — whether from India or China — is stored here. The purchase team uses this to look up supplier contacts, check which categories a vendor covers, and assess their status (Active/Inactive). Vendors are referenced from both Purchase Orders and Quotations, so keeping this list clean is important.

**What works:** Full paginated list with search. Add vendor with company name, contact person, email, phone, country, category (Packaging, Electronics, Apparel, etc.), and status. Inline editing for all fields. Delete vendor. Rating field per vendor. Country and category badges for quick visual scanning.

**What is missing:** There is no vendor performance history (e.g. how many POs placed, on-time delivery rate). There is no import of vendors from Excel. There is no way to view all quotations or POs linked to a specific vendor from within the vendor record.

**Estimate to complete remaining work:** Vendor performance summary panel — **2–3 days**. Linked quotations/POs view — **1 day**.

---

## 11. Dashboard Page ✅

**Business purpose:** The management summary page — a bird's-eye view of the business for managers and the superadmin. At a glance, leadership can see total deals closed, total revenue generated, average deal value, total commission owed, lead volume by status, and a 12-month sales trend chart. This page refreshes its numbers live every time you open it.

**What works:** Four KPI cards — Total Deals, Total Revenue (₹), Average Deal Value (₹), Total Commission (₹). Lead status breakdown with horizontal progress bars showing how many leads are at each stage. Monthly sales bar chart for the last 12 months using pure CSS (no charting library). Deals-by-stage summary table.

**What is missing:** There is no revenue target or budget line to compare actuals against. There is no breakdown by sales rep or by service type on the dashboard itself (that lives in Reports). There are no real-time updates — the page must be manually refreshed to see new data. There are no quick-action shortcuts (e.g. "3 deals need follow-up").

**Estimate to complete remaining work:** Sales rep breakdown widget — **1 day**. Target vs actual comparison — **1–2 days** (requires a target-setting feature to be built first). Auto-refresh — **half a day**.

---

## 12. Reports Page ✅

**Business purpose:** Deeper analysis for managers — beyond the summary on the dashboard. The Reports page lets you pull filtered data sets to answer specific business questions: "How much revenue did we close in Q3?" or "How many Sourcing leads came in this month?" Two tabs are available: Sales Report (deal-level analysis) and Leads Report (lead funnel analysis). Both support date-range filtering.

**What works:** Sales Report tab — filter by date range and service type, get KPI summary (total deals, revenue, commission) plus a full table of every individual deal in that range. Leads Report tab — filter by date range, status, and service type, get lead count statistics plus a table of every individual lead. Both tabs show results instantly after clicking Fetch.

**What is missing:** There is no way to export the report table directly from this page (you must go to the Export page). There is no chart or visual representation of the report results. There is no "compare period" feature (e.g. this month vs last month). The Sales Report does not yet filter by individual sales rep from a dropdown (you would need to type a user ID).

**Estimate to complete remaining work:** Export button on reports table — **half a day**. Bar chart per report — **1–2 days**. Sales-rep dropdown filter — **1 day** (requires loading the users list into the filter).

---

## 13. Commission Page ✅

**Business purpose:** Tracks how much commission each sales representative has earned across all their deals. The finance team or management uses this at month-end or quarter-end to calculate payouts. You can filter by date range to see commissions for a specific period, and optionally filter to a single sales rep. The page shows a ranked table — highest earner at the top — with total deals count, total revenue generated, and commission amount. A grand total of all commission payable is shown at the bottom.

**What works:** Date range filter. Optional single-rep filter (by user ID). Full ranked commission table with totals. Grand total sum footer. Numbers formatted in Indian number format with ₹ symbol.

**What is missing:** The sales rep filter currently requires you to enter a database ID — there is no dropdown to pick a rep by name. There is no "Mark as Paid" button to record that a commission has been settled. There is no history of past commission payouts.

**Estimate to complete remaining work:** Sales rep name dropdown — **1 day**. Mark-as-paid functionality — **2–3 days** (requires a CommissionPayout model to track payment records).

---

## 14. Users Page ✅

**Business purpose:** The account management page for the superadmin. This is where all team member accounts are created and viewed. Since registration is locked after the first superadmin account, every new hire — sales rep, purchase officer, or manager — must be added here. The superadmin sets the username, email, password, and role. The new user can then log in immediately.

**What works:** View all existing users in a table. Create new user with username, email, password (with validation), and role selection. Success/error feedback on creation.

**What is missing:** There is no ability to edit or deactivate an existing user from this page. There is no password reset for another user. There is no role change after creation. A superadmin cannot see when a user last logged in.

**Estimate to complete remaining work:** Edit user (role change, deactivate/reactivate) — **1 day**. Last-login tracking — **half a day** (just storing a lastLoginAt timestamp on the User model).

---

## 15. Settings Page (Service Prefixes) ✅

**Business purpose:** Controls how deal ID numbers are formatted. SourceUp India offers multiple service types (Sourcing, Packaging, Web & IT, Social Media, etc.), and each type gets its own prefix in deal numbers so they are instantly recognizable — e.g. SUI-D-SRC-2026-0001 for Sourcing, SUI-D-PKG for Packaging. This page lets the superadmin view all configured prefixes, rename them, toggle them on or off, and add custom ones for any new service lines added in the future.

**What works:** Full list of all service prefixes. Toggle active/inactive (when inactive, deals for that service type fall back to a generic ID). Rename any prefix. Add a completely new prefix (2–6 uppercase letters, custom name). Delete custom prefixes. The 7 built-in defaults (SRC, PKG, WEB, SMM, LEG, INV, CON) are protected and cannot be deleted.

**What is missing:** Nothing critical. A possible future enhancement would be letting the superadmin set a description for each prefix so newer team members know which business service it maps to.

**Estimate to complete remaining work:** Description field enhancement — **half a day**.

---

## 16. Export Page ✅

**Business purpose:** A data backup and reporting tool exclusively for the superadmin. At any time, SourceUp India's data can be downloaded as a spreadsheet (CSV) or a structured data file (JSON) for external analysis, handover to an accountant, or archival. Four data sets can be exported: Leads, Deals, Vendors, and Quotations. A date range filter lets you export only a specific period's data rather than everything at once.

**What works:** Entity selector (Leads / Deals / Vendors / Quotations). Format selector (CSV / JSON). Optional date range filter. Download triggers instantly as a browser file download — the file lands in your Downloads folder automatically. The exported CSV is compatible with Excel and Google Sheets. Sensitive data (passwords, refresh tokens) is never included in any export.

**What is missing:** Purchase Orders cannot currently be exported — only Leads, Deals, Vendors, and Quotations are supported. There is no scheduled/automated export (e.g. email a report every Monday). The file is not compressed (for very large data sets a .zip might be preferred).

**Estimate to complete remaining work:** Add Purchase Orders to the export — **half a day** (a simple addition to the backend controller). Scheduled exports — **3–5 days** (requires a cron job and email delivery service).

---

## Overall Summary

| Page | Status | Remaining Effort |
|------|--------|-----------------|
| Login | ✅ Complete | 1–2 days (forgot password) |
| Register | ✅ Complete | None |
| Leads List | ✅ Complete | 2–3 days (bulk actions, duplicate detection) |
| Lead Detail | ✅ Complete | 3–5 days (notifications, reminders) |
| Deals List | ✅ Complete | 1 day (filter enhancements) |
| Deal Detail | ✅ Complete | 2–3 days (PI/PDF generation) |
| Quotations | ✅ Complete | 6–8 days (edit quote, currency helper, **PDF generation**, **email-to-client**) |
| Purchase List | ✅ Complete | 2–3 days (document attachments) |
| Purchase Detail | ✅ Complete | 2 days (notes, attachments) |
| Vendors | ✅ Complete | 2–3 days (performance history) |
| Dashboard | ✅ Complete | 1–2 days (rep breakdown, auto-refresh) |
| Reports | ✅ Complete | 2–3 days (charts, rep dropdown, export button) |
| Commission | ✅ Complete | 2–3 days (name dropdown, mark-paid flow) |
| Users | ✅ Complete | 1–2 days (edit/deactivate users) |
| Settings | ✅ Complete | 0.5 days (description field, optional) |
| Export | ✅ Complete | 0.5–1 day (add POs to export) |

**Total estimated remaining work for all enhancements: approximately 33–52 developer days**, most of which are optional quality-of-life improvements. The core business workflow — lead intake → quotation → deal → purchase order — is fully functional end-to-end today.

The two highest-priority missing features are:
1. **Quotation PDF generation + email-to-client (6–8 days)** — business-critical for the purchase team's daily workflow. The client's email is already stored on the Lead; the sending infrastructure (Nodemailer/SendGrid) just needs to be built. Once done, the same email service can power all other notifications in the system.
2. **Forgot password / reset (1–2 days)** — currently a superadmin must delete and recreate accounts for locked-out users.

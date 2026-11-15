# SourceUp India – Product Sourcing CRM: Software Requirements Specification

2026-09-19 · prepared with @Someone

---

## 1. Introduction

**Software Name:** SourceUp CRM (working title — to be finalized)

**Purpose:** This document defines what the Product Sourcing CRM must do for SourceUp India — a system that manages the full business flow from lead intake through vendor sourcing to deal closure, plus a live dashboard and a database utility.

**Business Goal:** Digitize and streamline SourceUp India's sourcing workflow so leads → purchase quotations → sales closure can all be tracked in one system, replacing manual/spreadsheet tracking.

**Scope — what it WILL do:**
* Track leads, verify client authenticity, and monitor deal closure
* Track cost-per-lead (SourceUp India always pays for leads)
* Manage the Sales Department with unique deal numbering by service type
* Manage the Purchase Department (vendors, importers, quotations)
* Provide a Live Dashboard with sales records, reference numbers, and commission tracking
* Provide a DB linking/dumping utility for data integration

**Scope — what it will NOT do (v1):** No accounting/tax module, no HR/payroll module. (Confirm any others.)

**Product Perspective:** Brand new system — no existing system being replaced, no legacy data to migrate.

---

## 2. Definitions & User Roles

### Definitions

| Term | Meaning |
| :--- | :--- |
| **Lead** | A potential client's sourcing inquiry |
| **Deal** | A confirmed transaction with a unique reference number |
| **Vendor** | A supplier or manufacturer |
| **Importer** | A vendor who imports goods from other countries |
| **Quotation** | A price quote from a vendor/importer |
| **Commission** | % of profit margin earned by a salesperson on a closed deal |
| **Service Prefix** | Short code in a deal number showing which of the 7 services it belongs to |
| **Lead Buyer** | The salesperson assigned to (and who paid for) a lead |

### User Roles

| Role | Access | Skill Level Needed |
| :--- | :--- | :--- |
| **Super Admin** | Full access — all modules, users, settings, DB tool | Moderate |
| **Sales Team Member** | Own assigned leads, own deals, own commission | Low–Moderate |
| **Purchase Team Member** | Vendors/importers, quotations | Low–Moderate |
| **Manager/Owner** | Dashboard, all reports, commission summaries | Low |

* **Platform:** Web browser first (Chrome, Firefox, Edge, Safari). Mobile app and desktop app are phase 2/3 — not part of this build.
* **Users at launch:** 15+ people, so role-based permissions must be solid from day one — sales staff should only see their own leads/deals, purchase staff only vendors/quotations.

---

## 3. Business Workflow

```mermaid
flowchart TD
    A[Lead comes in<br/>website / phone / referral] --> B[Entered into system<br/>cost-per-lead recorded]
    B --> C[Client authenticity verified]
    C --> D[Assigned to a salesperson]
    D --> E[Purchase team contacts<br/>vendors/importers]
    E --> F[Quotations requested<br/>& uploaded]
    F --> G[Best quotation selected]
    G --> H[Deal Number generated<br/>with service prefix]
    H --> I[Sales team negotiates<br/>& closes deal]
    I --> J[Commission calculated<br/>% of profit margin]
    J --> K[Live Dashboard]
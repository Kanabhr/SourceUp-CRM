# Sprint 1 — Leads Module

## Goal
Team can replace their leads spreadsheet. Full lead lifecycle from intake to closure.

## What Gets Built

### Backend
- Lead CRUD (create, read, update, delete)
- Duplicate detection on phone and email — warning response
- Status flow enforcement: Open → In Progress → Quotation Sent → Closed Won / Closed Lost
- Block "Closed Won" if no dealId linked
- Cost-per-lead required field enforcement
- Client verification: Verified / Unverified / Fraud + remarks
- Notes: add note to lead (text, timestamp, userId)
- Audit trail: every status change written to AuditLog
- Search + filter: date range, status, salesperson, product, client name
- Sales staff scoped to their own leads via userId filter
- Manager/SuperAdmin see all leads

### Frontend
- LeadsPage — table with search, filter, pagination
- Add Lead modal/form — all required fields
- Lead detail page — status tracker, notes, audit history
- Assign to salesperson dropdown
- Verification status badge (color coded)
- Duplicate warning before save

## API Endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | /api/v1/leads | Yes | sales, manager, superadmin |
| POST | /api/v1/leads | Yes | sales, superadmin |
| GET | /api/v1/leads/:id | Yes | sales (own), manager, superadmin |
| PATCH | /api/v1/leads/:id | Yes | sales (own), superadmin |
| DELETE | /api/v1/leads/:id | Yes | superadmin |
| POST | /api/v1/leads/:id/notes | Yes | sales, manager, superadmin |
| GET | /api/v1/leads/:id/history | Yes | manager, superadmin |

## MongoDB Schema
```js
Lead: {
  clientName, company, contactPerson, email, phone,
  productNeeded, source, date,
  status: enum[Open, In Progress, Quotation Sent, Closed Won, Closed Lost],
  verificationStatus: enum[Unverified, Verified, Fraud],
  verificationRemarks, verificationDocs,
  assignedTo: ref(User), costPerLead,
  dealId: ref(Deal), // required for Closed Won
  notes: [{ text, addedBy, addedAt }],
  statusHistory: [{ status, changedBy, changedAt }]
}

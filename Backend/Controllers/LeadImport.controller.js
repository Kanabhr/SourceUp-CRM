import ExcelJS from "exceljs";
import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { Lead } from "../MongoDB/Models/Lead.schema.js";
import { AuditLog } from "../MongoDB/Models/AuditLog.schema.js";
import { verifyLeadsWithGemini } from "../Utils/GeminiApi.js";

// ─── Column header map ───────────────────────────────────────────────────────
// Covers every reasonable variation a non-technical user might write.
// All keys are lowercase + single-spaced (normaliseHeader output).

const HEADER_MAP = {
  // ── Company / Brand Name ──────────────────────────────────────────────────
  "company / brand name": "company",
  "company/brand name": "company",
  "company/ brand name": "company",
  "company /brand name": "company",
  "brand name": "company",
  "brand / company": "company",
  "brand/company": "company",
  "company name": "company",
  "company name / brand": "company",
  "organization": "company",
  "organisation": "company",
  "org name": "company",
  "business name": "company",
  "business": "company",
  "firm name": "company",
  "firm": "company",
  "client name": "company",
  "client": "company",
  "account name": "company",
  "account": "company",
  "name of company": "company",
  "name of business": "company",
  "company": "company",
  "brand": "company",

  // ── Contact Person ────────────────────────────────────────────────────────
  "contact person": "contactPerson",
  "contact person name": "contactPerson",
  "contact name": "contactPerson",
  "contact": "contactPerson",
  "person name": "contactPerson",
  "person": "contactPerson",
  "name": "contactPerson",
  "full name": "contactPerson",
  "poc": "contactPerson",
  "point of contact": "contactPerson",
  "spoc": "contactPerson",
  "key contact": "contactPerson",
  "contact person / name": "contactPerson",
  "rep name": "contactPerson",
  "representative": "contactPerson",
  "owner": "contactPerson",
  "owner name": "contactPerson",
  "founder": "contactPerson",
  "founder name": "contactPerson",

  // ── Designation ───────────────────────────────────────────────────────────
  "designation of contact person": "designation",
  "designation": "designation",
  "designation / title": "designation",
  "job title": "designation",
  "job role": "designation",
  "title": "designation",
  "position": "designation",
  "role": "designation",
  "post": "designation",
  "department": "designation",
  "profile": "designation",
  "contact designation": "designation",
  "contact title": "designation",

  // ── Phone / WhatsApp ──────────────────────────────────────────────────────
  "phone / whatsapp": "phone",
  "phone/whatsapp": "phone",
  "phone / whatsapp no": "phone",
  "phone / whatsapp number": "phone",
  "whatsapp / phone": "phone",
  "whatsapp/phone": "phone",
  "phone": "phone",
  "phone number": "phone",
  "phone no": "phone",
  "mobile": "phone",
  "mobile number": "phone",
  "mobile no": "phone",
  "contact number": "phone",
  "contact no": "phone",
  "whatsapp": "phone",
  "whatsapp number": "phone",
  "whatsapp no": "phone",
  "tel": "phone",
  "telephone": "phone",
  "cell": "phone",
  "cell number": "phone",
  "number": "phone",
  "ph": "phone",
  "ph no": "phone",
  "ph number": "phone",
  "mob": "phone",

  // ── Email ─────────────────────────────────────────────────────────────────
  "email": "email",
  "email address": "email",
  "email id": "email",
  "email i d": "email",
  "e-mail": "email",
  "e mail": "email",
  "e-mail address": "email",
  "mail": "email",
  "mail id": "email",
  "mail address": "email",
  "contact email": "email",
  "business email": "email",
  "official email": "email",
  "work email": "email",

  // ── City / State ──────────────────────────────────────────────────────────
  "city / state": "location",
  "city/state": "location",
  "city, state": "location",
  "city & state": "location",
  "city": "location",
  "state": "location",
  "location": "location",
  "city / state / country": "location",
  "city/state/country": "location",
  "address": "location",
  "area": "location",
  "region": "location",
  "place": "location",
  "based in": "location",
  "based at": "location",
  "located at": "location",
  "located in": "location",
  "geography": "location",
  "geo": "location",
  "district": "location",
  "pin code": "location",
  "pincode": "location",
  "zip": "location",
  "zip code": "location",

  // ── Website / Instagram ───────────────────────────────────────────────────
  "website / instagram handle": "websiteUrl",
  "website/instagram handle": "websiteUrl",
  "website / instagram": "websiteUrl",
  "website/instagram": "websiteUrl",
  "instagram / website": "websiteUrl",
  "instagram/website": "websiteUrl",
  "website": "websiteUrl",
  "website url": "websiteUrl",
  "website link": "websiteUrl",
  "web": "websiteUrl",
  "web url": "websiteUrl",
  "web link": "websiteUrl",
  "url": "websiteUrl",
  "link": "websiteUrl",
  "instagram": "websiteUrl",
  "instagram handle": "websiteUrl",
  "instagram id": "websiteUrl",
  "insta": "websiteUrl",
  "insta handle": "websiteUrl",
  "insta id": "websiteUrl",
  "social media": "websiteUrl",
  "social media handle": "websiteUrl",
  "social": "websiteUrl",
  "ig": "websiteUrl",
  "ig handle": "websiteUrl",
  "online presence": "websiteUrl",
  "web/instagram": "websiteUrl",
};

// ─── Fuzzy fallback matcher ───────────────────────────────────────────────────
// If exact map lookup fails, try keyword-based matching.
// Returns the field name or null.

function fuzzyMatchHeader(normalised) {
  // Company keywords
  if (/(company|brand|business|firm|client|account|org|organisation|organization)/.test(normalised) &&
      !/(contact|person|email|phone|mobile|city|state|location|web|instagram|design|title|role)/.test(normalised)) {
    return "company";
  }
  // Contact person keywords (must not match email/phone)
  if (/(contact.*(person|name)|person.*name|point.of.contact|poc|spoc|rep.*name|owner.*name|founder)/.test(normalised) &&
      !/(email|phone|mobile|number|whatsapp)/.test(normalised)) {
    return "contactPerson";
  }
  // Designation keywords
  if (/(designation|job.*title|job.*role|position|post|profile)/.test(normalised)) {
    return "designation";
  }
  // Phone keywords
  if (/(phone|mobile|whatsapp|contact.*no|contact.*num|cell|tel|mob|number)/.test(normalised) &&
      !/(email|web|site|insta)/.test(normalised)) {
    return "phone";
  }
  // Email keywords
  if (/(email|e.mail|mail)/.test(normalised)) {
    return "email";
  }
  // Location keywords
  if (/(city|state|location|address|region|area|place|geo|district|pin|zip)/.test(normalised)) {
    return "location";
  }
  // Website / social keywords
  if (/(website|web|url|link|instagram|insta|social|online|ig)/.test(normalised)) {
    return "websiteUrl";
  }
  return null;
}

function mapHeader(raw) {
  const normalised = normaliseHeader(raw);
  return HEADER_MAP[normalised] || fuzzyMatchHeader(normalised) || null;
}

function normaliseHeader(raw) {
  return (raw || "").toString().toLowerCase().trim().replace(/\s+/g, " ");
}

// ─── Parse Excel buffer ───────────────────────────────────────────────────────

async function parseExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new ApiError(400, "Excel file has no worksheets");

  const rows = [];
  let headers = [];
  let headerRowFound = false;

  worksheet.eachRow((row, rowNumber) => {
    // ExcelJS row.values is 1-indexed sparse array — index 0 is always null
    // Convert to a clean 0-indexed array
    const values = [];
    for (let i = 1; i <= row.cellCount; i++) {
      const cell = row.getCell(i);
      // Unwrap all possible ExcelJS cell value types
      let val = cell.value;
      if (val === null || val === undefined) {
        values.push("");
      } else if (typeof val === "object" && val.richText) {
        // Rich text
        values.push(val.richText.map((r) => r.text).join("").trim());
      } else if (typeof val === "object" && val.text) {
        // Hyperlink or formula result
        values.push(val.text.toString().trim());
      } else if (typeof val === "object" && val.result !== undefined) {
        // Formula — use computed result
        values.push(val.result != null ? val.result.toString().trim() : "");
      } else if (val instanceof Date) {
        values.push(val.toISOString());
      } else {
        values.push(val.toString().trim());
      }
    }

    // First non-empty row is the header row
    if (!headerRowFound) {
      const hasText = values.some((v) => v !== "");
      if (!hasText) return; // skip truly blank leading rows
      headers = values.map((v) => mapHeader(v));
      headerRowFound = true;
      console.log("[parseExcel] raw headers:", values);
      console.log("[parseExcel] mapped headers:", headers);
      return;
    }

    // Skip completely empty data rows
    const hasData = values.some((v) => v !== "");
    if (!hasData) return;

    const entry = {};
    headers.forEach((field, i) => {
      // headers array now contains mapped field names (or null for unmapped columns)
      if (field && values[i] !== undefined && values[i] !== "") {
        // Don't overwrite a field already set by an earlier column
        if (!entry[field]) entry[field] = values[i];
      }
    });

    // Only add rows that mapped at least one field
    if (Object.keys(entry).length > 0) {
      rows.push(entry);
    }
  });

  if (rows.length === 0) {
    throw new ApiError(400, "No data rows found in the Excel file. Check that row 1 contains the column headers.");
  }

  console.log("[parseExcel] headers detected:", headers);
  console.log("[parseExcel] first row parsed:", rows[0]);
  console.log("[parseExcel] total rows:", rows.length);

  return rows;
}

// ─── Preview endpoint ─────────────────────────────────────────────────────────
// POST /api/v1/leads/import/preview
// Accepts the .xlsx file, parses it, runs AI verification, returns preview.
// No DB writes at this stage — mirrors BMS chromePreview pattern.

export const importPreview = AsyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No Excel file uploaded");

  const rows = await parseExcel(req.file.buffer);

  if (rows.length > 200) {
    throw new ApiError(400, `File has ${rows.length} rows. Maximum allowed is 200 per import.`);
  }

  // Check for duplicates already in DB (phone or email match)
  const phones = rows.map((r) => r.phone).filter(Boolean);
  const emails = rows.map((r) => r.email?.toLowerCase()).filter(Boolean);

  const existingLeads = await Lead.find({
    $or: [
      { phone: { $in: phones } },
      { email: { $in: emails } },
    ],
  })
    .select("phone email clientName")
    .lean();

  const existingPhones = new Set(existingLeads.map((l) => l.phone).filter(Boolean));
  const existingEmails = new Set(existingLeads.map((l) => l.email?.toLowerCase()).filter(Boolean));

  // Mark duplicates before sending to AI
  const markedRows = rows.map((row) => ({
    ...row,
    isDuplicate:
      (row.phone && existingPhones.has(row.phone)) ||
      (row.email && existingEmails.has(row.email?.toLowerCase())),
  }));

  // Run AI verification only on non-duplicate rows that have a websiteUrl
  // to avoid wasting API calls
  const toVerify = markedRows.filter((r) => !r.isDuplicate && r.websiteUrl);
  const skipVerify = markedRows.filter((r) => r.isDuplicate || !r.websiteUrl);

  let verified = toVerify;
  if (toVerify.length > 0) {
    verified = await verifyLeadsWithGemini(toVerify);
  }

  // Rows without a websiteUrl get Unverified by default
  const unverified = skipVerify.map((r) => ({
    ...r,
    verificationStatus: r.verificationStatus || "Unverified",
    verificationRemarks: r.isDuplicate
      ? "Duplicate — already exists in database"
      : "No website or Instagram handle provided",
  }));

  // Merge back in original order
  const preview = markedRows.map((row) => {
    const verifiedRow = verified.find(
      (v) => v.phone === row.phone && v.email === row.email,
    );
    const unverifiedRow = unverified.find(
      (u) => u.phone === row.phone && u.email === row.email,
    );
    return verifiedRow || unverifiedRow || row;
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        total: preview.length,
        duplicates: preview.filter((r) => r.isDuplicate).length,
        aiVerified: verified.length,
        preview,
      },
      "Preview ready",
    ),
  );
});

// ─── Confirm endpoint ─────────────────────────────────────────────────────────
// POST /api/v1/leads/import/confirm
// Accepts the confirmed preview rows, bulk-inserts into DB.
// Skips rows the user marked as isDuplicate or chose to exclude.

export const importConfirm = AsyncHandler(async (req, res) => {
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ApiError(400, "No rows provided for import");
  }

  // Only insert rows user confirmed (isDuplicate === false or not set)
  const toInsert = rows.filter((r) => !r.isDuplicate);

  if (toInsert.length === 0) {
    throw new ApiError(400, "All rows are duplicates — nothing to import");
  }

  // Build full Lead documents
  const leadDocs = toInsert.map((row) => ({
    // clientName = Company / Brand Name (primary identifier)
    clientName: row.company || row.clientName || "Unknown",
    company: row.company || "",
    contactPerson: row.contactPerson || "",
    designation: row.designation || "",
    email: row.email?.toLowerCase() || "",
    phone: row.phone || "",
    location: row.location || "",
    websiteUrl: row.websiteUrl || "",
    productNeeded: "To be determined", // Not in Excel — filled later by sales
    source: "Other",
    costPerLead: 0.01, // Placeholder — updated manually after import
    verificationStatus: row.verificationStatus || "Unverified",
    verificationRemarks: row.verificationRemarks || "",
    assignedTo: req.user._id,
    createdBy: req.user._id,
    statusHistory: [
      {
        status: "Open",
        changedBy: req.user._id,
        changedAt: new Date(),
        remark: "Imported from Excel",
      },
    ],
  }));

  // ordered: false — skip individual duplicate errors, continue inserting rest
  let inserted = 0;
  let skipped = 0;

  try {
    const result = await Lead.insertMany(leadDocs, { ordered: false });
    inserted = result.length;
  } catch (err) {
    // insertMany with ordered:false throws but still inserts valid docs
    if (err.name === "BulkWriteError" || err.writeErrors) {
      inserted = err.insertedDocs?.length ?? (leadDocs.length - (err.writeErrors?.length ?? 0));
      skipped = err.writeErrors?.length ?? 0;
    } else {
      throw err;
    }
  }

  // Audit log for the bulk import
  await AuditLog.create({
    userId: req.user._id,
    action: "BULK_IMPORT_LEADS",
    entity: "Lead",
    entityId: null,
    newValue: { inserted, skipped, total: toInsert.length },
  });

  res.status(201).json(
    new ApiResponse(
      201,
      { inserted, skipped, total: toInsert.length },
      `Import complete — ${inserted} leads created, ${skipped} skipped`,
    ),
  );
});

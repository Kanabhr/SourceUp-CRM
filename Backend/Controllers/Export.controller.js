import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { Lead } from "../MongoDB/Models/Lead.schema.js";
import { Deal } from "../MongoDB/Models/Deal.schema.js";
import { Vendor } from "../MongoDB/Models/Vendor.schema.js";
import { Quotation } from "../MongoDB/Models/Quotation.schema.js";
import { Purchase } from "../MongoDB/Models/Purchase.schema.js";

// â”€â”€â”€ Supported entities and formats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SUPPORTED_ENTITIES = ["leads", "deals", "vendors", "quotations", "purchases"];
const SUPPORTED_FORMATS = ["csv", "json"];

// â”€â”€â”€ CSV helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Escape a single CSV value: wrap in quotes if the value contains a comma,
 * newline, or double-quote; double any internal double-quotes.
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Need quoting if contains comma, newline (\n or \r), or double-quote
  if (/[,"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of plain JS objects to a CSV string.
 * Headers are taken from the keys of the first document.
 */
function toCsv(docs) {
  if (!docs || docs.length === 0) return "";
  const headers = Object.keys(docs[0]);
  const headerRow = headers.map(escapeCsvValue).join(",");
  const rows = docs.map((doc) =>
    headers.map((h) => escapeCsvValue(doc[h])).join(","),
  );
  return [headerRow, ...rows].join("\n");
}

// â”€â”€â”€ Date helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** YYYYMMDD from a Date object */
function yyyymmdd(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// â”€â”€â”€ Flatten a lean doc so populated refs become readable scalars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function flattenDoc(doc) {
  const flat = { ...doc };
  // Populated refs arrive as objects { _id, username } â€” reduce to the string
  for (const key of Object.keys(flat)) {
    const v = flat[key];
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      // Keep Date objects; collapse populated ref objects to username or _id string
      if (v.username) {
        flat[key] = v.username;
      } else if (v._id) {
        flat[key] = String(v._id);
      }
    }
    if (flat[key] instanceof Date) {
      flat[key] = flat[key].toISOString();
    }
  }
  return flat;
}

// â”€â”€â”€ Controller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * GET /api/v1/export
 * Query params:
 *   entity    leads | deals | vendors | quotations  (default: leads)
 *   format    csv | json                             (default: csv)
 *   startDate ISO date string (optional)
 *   endDate   ISO date string (optional)
 *
 * Requires superadmin role (enforced in route).
 */
const exportData = AsyncHandler(async (req, res) => {
  const entity = (req.query.entity || "leads").toLowerCase();
  const format = (req.query.format || "csv").toLowerCase();
  const { startDate, endDate } = req.query;

  if (!SUPPORTED_ENTITIES.includes(entity)) {
    throw new ApiError(
      400,
      `Unsupported entity "${entity}". Valid options: ${SUPPORTED_ENTITIES.join(", ")}`,
    );
  }

  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new ApiError(
      400,
      `Unsupported format "${format}". Valid options: ${SUPPORTED_FORMATS.join(", ")}`,
    );
  }

  // â”€â”€ Build date filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const buildDateFilter = (field) => {
    const f = {};
    if (startDate || endDate) {
      f[field] = {};
      if (startDate) f[field].$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        f[field].$lte = end;
      }
    }
    return f;
  };

  // â”€â”€ Fetch docs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let docs = [];

  if (entity === "leads") {
    const filter = buildDateFilter("createdAt");
    docs = await Lead.find(filter)
      .select(
        "leadId clientName company status serviceType source assignedTo expectedOrderValue createdAt",
      )
      .populate("assignedTo", "username")
      .lean();
  } else if (entity === "deals") {
    const filter = buildDateFilter("orderConfirmDate");
    docs = await Deal.find(filter)
      .select(
        "dealId leadId salesRep sellingPricePerUnit qty commissionPct orderConfirmDate serviceType",
      )
      .populate("salesRep", "username")
      .lean();
  } else if (entity === "vendors") {
    const filter = buildDateFilter("createdAt");
    docs = await Vendor.find(filter)
      .select(
        "vendorId companyName contactPerson email phone serviceType createdAt",
      )
      .lean();
  } else if (entity === "quotations") {
    const filter = buildDateFilter("createdAt");
    docs = await Quotation.find(filter)
      .select(
        "quotationId leadId vendorName product price currency exchangeRate validity isSelected createdAt",
      )
      .lean();
  } else if (entity === "purchases") {
    const filter = buildDateFilter("createdAt");
    docs = await Purchase.find(filter)
      .select(
        "poId dealId vendorName vendorCountry product qty unitCost currency totalLandedCost status createdAt",
      )
      .lean();
  }

  // â”€â”€ Flatten all docs for serialisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const flatDocs = docs.map(flattenDoc);

  // â”€â”€ Build filename â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const dateStamp = yyyymmdd();
  const filename = `export-${entity}-${dateStamp}.${format}`;

  // â”€â”€ Respond â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    return res.send(toCsv(flatDocs));
  }

  // JSON
  res.setHeader("Content-Type", "application/json");
  return res.send(JSON.stringify(flatDocs, null, 2));
});

export { exportData };


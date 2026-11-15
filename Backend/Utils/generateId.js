import { Counter } from "../MongoDB/Models/Counter.schema.js";
import { ServicePrefix } from "../MongoDB/Models/ServicePrefix.schema.js";

/**
 * Atomically generate a readable ID in the pattern:
 *   [PREFIX]-[YEAR]-[SEQUENCE padded to 4 digits]
 *
 * Example: generateId("lead", "SUI-L") → "SUI-L-2026-0001"
 *
 * Uses findOneAndUpdate with $inc to guarantee no duplicates
 * even under concurrent writes. Sequences reset per year.
 */
export async function generateId(entity, prefix) {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { entity, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `${prefix}-${year}-${String(counter.seq).padStart(4, "0")}`;
}

/** Generate a Lead ID: SUI-L-YYYY-XXXX */
export const generateLeadId = () => generateId("lead", "SUI-L");

/**
 * Default mapping from a lead's serviceType to a ServicePrefix code.
 * Used as a fallback when no active ServicePrefix entry matches the
 * serviceType by name or code. Codes mirror the seeded prefixes.
 */
const SERVICE_TYPE_PREFIX_MAP = {
  Sourcing: "SRC",
  Packaging: "PKG",
  "Website & IT": "WEB",
  "Social Media": "SMM",
  Legal: "LEG",
  Investment: "INV",
  Consultancy: "CON",
};

/** Escape a string for safe use inside a MongoDB $regex. */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Resolve a ServicePrefix code for a lead's serviceType.
 *
 * 1. Look for an active ServicePrefix whose `name` or `code` matches the
 *    serviceType (case-insensitive) — this honours admin customisations (R7).
 * 2. If none, fall back to the default SERVICE_TYPE_PREFIX_MAP. The mapped
 *    code is used when its ServicePrefix entry is active in the DB (so toggling
 *    a prefix inactive excludes it — R7 AC2), or when no entry exists for that
 *    code at all (unseeded / deleted), in which case the default map is the
 *    source of the code.
 *
 * Returns the resolved code (e.g. "SRC") or null when nothing matches.
 */
async function resolveServicePrefixCode(serviceType) {
  if (!serviceType) return null;
  const normalized = String(serviceType).trim();
  if (!normalized) return null;

  // 1. Active DB entry matching by name or code.
  const entry = await ServicePrefix.findOne({
    isActive: true,
    $or: [
      { name: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" } },
      { code: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" } },
    ],
  }).lean();
  if (entry) return entry.code;

  // 2. Default fallback map.
  const mappedCode = SERVICE_TYPE_PREFIX_MAP[normalized];
  if (!mappedCode) return null;

  // Confirm the mapped code against the DB so inactive prefixes are excluded.
  const codeUpper = mappedCode.toUpperCase();
  const byCode = await ServicePrefix.findOne({ code: codeUpper }).lean();
  if (!byCode) {
    // No DB entry for this code (unseeded or deleted): the map is the default.
    return codeUpper;
  }
  if (!byCode.isActive) {
    // Prefix exists but is inactive — do not offer it (R7 AC2).
    return null;
  }
  return codeUpper;
}

/**
 * Generate a Deal ID embedding the ServicePrefix code for the lead's
 * serviceType, e.g. SUI-D-SRC-2026-0001.
 *
 * Falls back to the legacy SUI-D-YYYY-XXXX scheme (and logs a warning) when
 * the serviceType has no matching active prefix. Never throws.
 *
 * The Counter is keyed per prefix+year (entity = "deal-<CODE>") so each
 * prefix has its own incrementing sequence that never collides with the
 * legacy "deal" counter key used by the fallback.
 */
export async function generateDealId(serviceType) {
  try {
    const code = await resolveServicePrefixCode(serviceType);
    if (code) {
      return await generateId(`deal-${code}`, `SUI-D-${code}`);
    }
  } catch (err) {
    console.warn(
      `generateDealId: error resolving service prefix for "${serviceType}": ${err.message}`,
    );
  }
  console.warn(
    `generateDealId: no active ServicePrefix for serviceType "${serviceType}"; falling back to SUI-D`,
  );
  return generateId("deal", "SUI-D");
}

/** Generate a Quotation ID: SUI-Q-YYYY-XXXX */
export const generateQuotationId = () => generateId("quotation", "SUI-Q");

/** Generate a Purchase Order ID: SUI-P-YYYY-XXXX */
export const generatePoId = () => generateId("purchase", "SUI-P");

/** Generate a Vendor ID: SUI-V-YYYY-XXXX */
export const generateVendorId = () => generateId("vendor", "SUI-V");

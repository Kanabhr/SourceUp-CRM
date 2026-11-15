import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { AuditLog } from "../MongoDB/Models/AuditLog.schema.js";
import { ServicePrefix } from "../MongoDB/Models/ServicePrefix.schema.js";

// Seeded default codes — protected from deletion
const SEEDED_CODES = ["SRC", "PKG", "WEB", "SMM", "LEG", "INV", "CON"];

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/service-prefixes?active=true|false
 * Returns all prefixes sorted by code ASC.
 * Optional ?active=true|false filter.
 */
const listPrefixes = AsyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.active !== undefined) {
    filter.isActive = req.query.active === "true";
  }
  const prefixes = await ServicePrefix.find(filter).sort({ code: 1 }).lean();
  res.status(200).json(new ApiResponse(200, { prefixes }, "Prefixes fetched"));
});

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/service-prefixes
 * Body: { code, name?, isActive? }
 */
const createPrefix = AsyncHandler(async (req, res) => {
  const { code, name, isActive } = req.body;

  if (!code) throw new ApiError(400, "code is required");

  // Validate: 2-6 uppercase letters only
  const cleanCode = String(code).trim().toUpperCase();
  if (!/^[A-Z]{2,6}$/.test(cleanCode)) {
    throw new ApiError(400, "code must be 2-6 uppercase letters (A-Z only)");
  }

  // Attempt to create; let mongoose throw on duplicate key
  let prefix;
  try {
    prefix = await ServicePrefix.create({
      code: cleanCode,
      name: name?.trim() || cleanCode,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, `A prefix with code "${cleanCode}" already exists`);
    }
    throw err;
  }

  await AuditLog.create({
    userId: req.user._id,
    action: "CREATE_SERVICE_PREFIX",
    entity: "ServicePrefix",
    entityId: prefix._id,
    newValue: { code: prefix.code, name: prefix.name, isActive: prefix.isActive },
  });

  res.status(201).json(new ApiResponse(201, prefix, "Prefix created"));
});

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/service-prefixes/:id
 * Body: { name?, isActive? }  — code is immutable
 */
const updatePrefix = AsyncHandler(async (req, res) => {
  const prefix = await ServicePrefix.findById(req.params.id);
  if (!prefix) throw new ApiError(404, "Prefix not found");

  const { name, isActive } = req.body;
  const old = { name: prefix.name, isActive: prefix.isActive };

  if (name !== undefined) prefix.name = name.trim();
  if (isActive !== undefined) prefix.isActive = Boolean(isActive);

  await prefix.save();

  await AuditLog.create({
    userId: req.user._id,
    action: "UPDATE_SERVICE_PREFIX",
    entity: "ServicePrefix",
    entityId: prefix._id,
    oldValue: old,
    newValue: { name: prefix.name, isActive: prefix.isActive },
  });

  res.status(200).json(new ApiResponse(200, prefix, "Prefix updated"));
});

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/service-prefixes/:id
 * Seeded defaults (SRC/PKG/WEB/SMM/LEG/INV/CON) cannot be deleted.
 */
const deletePrefix = AsyncHandler(async (req, res) => {
  const prefix = await ServicePrefix.findById(req.params.id);
  if (!prefix) throw new ApiError(404, "Prefix not found");

  if (SEEDED_CODES.includes(prefix.code)) {
    throw new ApiError(403, "Default prefixes cannot be deleted");
  }

  await AuditLog.create({
    userId: req.user._id,
    action: "DELETE_SERVICE_PREFIX",
    entity: "ServicePrefix",
    entityId: prefix._id,
    oldValue: { code: prefix.code, name: prefix.name },
  });

  await ServicePrefix.findByIdAndDelete(req.params.id);

  res.status(200).json(new ApiResponse(200, {}, "Prefix deleted"));
});

// ─── Toggle ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/service-prefixes/:id/toggle
 * Flips isActive between true and false.
 */
const togglePrefix = AsyncHandler(async (req, res) => {
  const prefix = await ServicePrefix.findById(req.params.id);
  if (!prefix) throw new ApiError(404, "Prefix not found");

  const oldActive = prefix.isActive;
  prefix.isActive = !prefix.isActive;
  await prefix.save();

  await AuditLog.create({
    userId: req.user._id,
    action: "TOGGLE_SERVICE_PREFIX",
    entity: "ServicePrefix",
    entityId: prefix._id,
    oldValue: { isActive: oldActive },
    newValue: { isActive: prefix.isActive },
  });

  res.status(200).json(new ApiResponse(200, prefix, `Prefix ${prefix.isActive ? "activated" : "deactivated"}`));
});

export { listPrefixes, createPrefix, updatePrefix, deletePrefix, togglePrefix };

import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { AuditLog } from "../MongoDB/Models/AuditLog.schema.js";
import { Lead, STATUS_TRANSITIONS } from "../MongoDB/Models/Lead.schema.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Scope filter: sales users only see their own leads.
 * Manager / superadmin see all.
 */
const scopeFilter = (user) =>
  user.role === "sales" ? { assignedTo: user._id } : {};

/**
 * Build a MongoDB query from request query params.
 * Supports: status, assignedTo, source, verificationStatus,
 *           dateFrom, dateTo, search (text on clientName/company/productNeeded)
 */
const buildFilter = (query, user) => {
  const filter = scopeFilter(user);

  if (query.status) filter.status = query.status;
  if (query.source) filter.source = query.source;
  if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;

  // Manager/superadmin can filter by salesperson; sales users are already scoped
  if (query.assignedTo && user.role !== "sales") filter.assignedTo = query.assignedTo;

  if (query.dateFrom || query.dateTo) {
    filter.date = {};
    if (query.dateFrom) filter.date.$gte = new Date(query.dateFrom);
    if (query.dateTo) filter.date.$lte = new Date(query.dateTo);
  }

  if (query.search) {
    filter.$text = { $search: query.search };
  }

  return filter;
};

// ─── Controllers ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/leads
 * Paginated list with optional filters.
 */
const getLeads = AsyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = buildFilter(req.query, req.user);

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .populate("assignedTo", "username role")
      .populate("createdBy", "username")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, "Leads fetched"),
  );
});

/**
 * POST /api/v1/leads
 * Create a new lead. Duplicate phone/email shows warning but still allows save.
 */
const createLead = AsyncHandler(async (req, res) => {
  const {
    clientName, company, contactPerson, email, phone,
    productNeeded, source, date, costPerLead,
    assignedTo, verificationStatus, verificationRemarks,
  } = req.body;

  // Required field checks
  if (!clientName?.trim()) throw new ApiError(400, "Client name is required");
  if (!productNeeded?.trim()) throw new ApiError(400, "Product needed is required");
  if (!costPerLead || isNaN(Number(costPerLead)) || Number(costPerLead) <= 0) {
    throw new ApiError(400, "Cost per lead is required and must be greater than 0");
  }

  // Duplicate detection — warn but don't block
  let duplicateWarning = null;
  if (email || phone) {
    const orClauses = [];
    if (email?.trim()) orClauses.push({ email: email.trim().toLowerCase() });
    if (phone?.trim()) orClauses.push({ phone: phone.trim() });

    const duplicate = await Lead.findOne({ $or: orClauses })
      .select("clientName email phone _id")
      .lean();

    if (duplicate) {
      duplicateWarning = `A lead with the same ${duplicate.email === email?.toLowerCase() ? "email" : "phone"} already exists (${duplicate.clientName}).`;
    }
  }

  // Sales users are automatically assigned to themselves unless overridden by superadmin
  const resolvedAssignedTo =
    req.user.role === "sales"
      ? req.user._id
      : assignedTo || req.user._id;

  const lead = await Lead.create({
    clientName: clientName.trim(),
    company: company?.trim() || "",
    contactPerson: contactPerson?.trim() || "",
    email: email?.trim().toLowerCase() || "",
    phone: phone?.trim() || "",
    productNeeded: productNeeded.trim(),
    source: source || "Other",
    date: date ? new Date(date) : new Date(),
    costPerLead: Number(costPerLead),
    assignedTo: resolvedAssignedTo,
    verificationStatus: verificationStatus || "Unverified",
    verificationRemarks: verificationRemarks?.trim() || "",
    createdBy: req.user._id,
    statusHistory: [{
      status: "Open",
      changedBy: req.user._id,
      changedAt: new Date(),
      remark: "Lead created",
    }],
  });

  const populated = await Lead.findById(lead._id)
    .populate("assignedTo", "username role")
    .populate("createdBy", "username")
    .lean();

  await AuditLog.create({
    userId: req.user._id,
    action: "CREATE_LEAD",
    entity: "Lead",
    entityId: lead._id,
    newValue: { clientName: lead.clientName, status: lead.status },
  });

  res.status(201).json(
    new ApiResponse(201, { lead: populated, duplicateWarning }, "Lead created"),
  );
});

/**
 * GET /api/v1/leads/:id
 * Single lead — sales only see own, manager/superadmin see all.
 */
const getLeadById = AsyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...scopeFilter(req.user) };

  const lead = await Lead.findOne(filter)
    .populate("assignedTo", "username role")
    .populate("createdBy", "username")
    .populate("notes.addedBy", "username")
    .populate("statusHistory.changedBy", "username")
    .lean();

  if (!lead) throw new ApiError(404, "Lead not found");

  res.status(200).json(new ApiResponse(200, lead, "Lead fetched"));
});

/**
 * PATCH /api/v1/leads/:id
 * Update lead fields. Status transitions are validated.
 * Closing as Won requires a dealId.
 */
const updateLead = AsyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...scopeFilter(req.user) };
  const lead = await Lead.findOne(filter);
  if (!lead) throw new ApiError(404, "Lead not found");

  const {
    clientName, company, contactPerson, email, phone,
    productNeeded, source, date, costPerLead,
    assignedTo, verificationStatus, verificationRemarks,
    status, dealId,
  } = req.body;

  // ── Status transition validation ──────────────────────────────────────────
  if (status && status !== lead.status) {
    const allowed = STATUS_TRANSITIONS[lead.status];
    if (!allowed || !allowed.includes(status)) {
      throw new ApiError(
        400,
        `Cannot move from "${lead.status}" to "${status}". Allowed: ${allowed?.join(", ") || "none"}`,
      );
    }

    // Closed Won requires a linked deal
    if (status === "Closed Won" && !dealId && !lead.dealId) {
      throw new ApiError(400, "Cannot close as Won without a linked deal");
    }

    const oldStatus = lead.status;
    lead.status = status;
    lead.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      remark: req.body.statusRemark?.trim() || "",
    });

    await AuditLog.create({
      userId: req.user._id,
      action: "LEAD_STATUS_CHANGE",
      entity: "Lead",
      entityId: lead._id,
      oldValue: { status: oldStatus },
      newValue: { status },
    });
  }

  // ── Field updates ─────────────────────────────────────────────────────────
  if (clientName?.trim()) lead.clientName = clientName.trim();
  if (company !== undefined) lead.company = company?.trim() || "";
  if (contactPerson !== undefined) lead.contactPerson = contactPerson?.trim() || "";
  if (email !== undefined) lead.email = email?.trim().toLowerCase() || "";
  if (phone !== undefined) lead.phone = phone?.trim() || "";
  if (productNeeded?.trim()) lead.productNeeded = productNeeded.trim();
  if (source) lead.source = source;
  if (date) lead.date = new Date(date);
  if (costPerLead !== undefined) {
    if (isNaN(Number(costPerLead)) || Number(costPerLead) <= 0) {
      throw new ApiError(400, "Cost per lead must be greater than 0");
    }
    lead.costPerLead = Number(costPerLead);
  }
  // Only superadmin can reassign leads
  if (assignedTo && req.user.role === "superadmin") lead.assignedTo = assignedTo;
  if (verificationStatus) lead.verificationStatus = verificationStatus;
  if (verificationRemarks !== undefined) lead.verificationRemarks = verificationRemarks?.trim() || "";
  if (dealId) lead.dealId = dealId;

  await lead.save();

  const updated = await Lead.findById(lead._id)
    .populate("assignedTo", "username role")
    .populate("createdBy", "username")
    .populate("notes.addedBy", "username")
    .populate("statusHistory.changedBy", "username")
    .lean();

  res.status(200).json(new ApiResponse(200, updated, "Lead updated"));
});

/**
 * DELETE /api/v1/leads/:id
 * Superadmin only.
 */
const deleteLead = AsyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id);
  if (!lead) throw new ApiError(404, "Lead not found");

  await AuditLog.create({
    userId: req.user._id,
    action: "DELETE_LEAD",
    entity: "Lead",
    entityId: lead._id,
    oldValue: { clientName: lead.clientName, status: lead.status },
  });

  res.status(200).json(new ApiResponse(200, {}, "Lead deleted"));
});

/**
 * POST /api/v1/leads/:id/notes
 * Add a note to a lead.
 */
const addNote = AsyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) throw new ApiError(400, "Note text is required");

  const filter = { _id: req.params.id, ...scopeFilter(req.user) };
  const lead = await Lead.findOne(filter);
  if (!lead) throw new ApiError(404, "Lead not found");

  lead.notes.push({
    text: text.trim(),
    addedBy: req.user._id,
    addedAt: new Date(),
  });

  await lead.save();

  const updated = await Lead.findById(lead._id)
    .populate("notes.addedBy", "username")
    .lean();

  res.status(201).json(new ApiResponse(201, updated.notes, "Note added"));
});

/**
 * GET /api/v1/leads/:id/history
 * Status history + AuditLog entries for this lead.
 * Manager / superadmin only.
 */
const getLeadHistory = AsyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id)
    .populate("statusHistory.changedBy", "username")
    .select("statusHistory clientName status")
    .lean();

  if (!lead) throw new ApiError(404, "Lead not found");

  const auditEntries = await AuditLog.find({ entity: "Lead", entityId: req.params.id })
    .populate("userId", "username")
    .sort({ timestamp: -1 })
    .lean();

  res.status(200).json(
    new ApiResponse(200, { statusHistory: lead.statusHistory, auditLog: auditEntries }, "History fetched"),
  );
});

export { getLeads, createLead, getLeadById, updateLead, deleteLead, addNote, getLeadHistory };

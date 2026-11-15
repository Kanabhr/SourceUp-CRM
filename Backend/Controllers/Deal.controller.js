import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { AuditLog } from "../MongoDB/Models/AuditLog.schema.js";
import { Deal, DEAL_STAGE_TRANSITIONS } from "../MongoDB/Models/Deal.schema.js";
import { Lead } from "../MongoDB/Models/Lead.schema.js";
import { generateDealId } from "../Utils/generateId.js";
import { generateProformaInvoicePdf } from "../Utils/dealPdf.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Scope filter: sales users only see their own deals.
 * Manager / superadmin see all.
 */
const scopeFilter = (user) =>
  user.role === "sales" ? { salesRep: user._id } : {};

/**
 * Recalculate orderValue, grossProfit, grossProfitPct, commissionAmount
 * from the current deal fields.
 */
const recalcFinancials = (deal) => {
  deal.orderValue = (deal.sellingPricePerUnit || 0) * (deal.qty || 0);
  const costPerUnit = deal.landedCost || deal.buyingCost || 0;
  const totalLandedCost = costPerUnit * (deal.qty || 0);
  deal.grossProfit = deal.orderValue - totalLandedCost;
  deal.grossProfitPct = deal.orderValue > 0
    ? Math.round((deal.grossProfit / deal.orderValue) * 10000) / 100
    : 0;
  deal.commissionAmount = deal.grossProfit > 0
    ? Math.round(deal.grossProfit * (deal.commissionPct || 0)) / 100
    : 0;
};

/**
 * Build a MongoDB filter from query params.
 */
const buildFilter = (query, user) => {
  const filter = scopeFilter(user);
  if (query.stage) filter.stage = query.stage;
  if (query.salesRep && user.role !== "sales") filter.salesRep = query.salesRep;
  if (query.leadId) filter.leadId = query.leadId;
  if (query.search) {
    filter.$or = [
      { dealId: { $regex: query.search, $options: "i" } },
      { customerName: { $regex: query.search, $options: "i" } },
    ];
  }
  return filter;
};

const POPULATE_DEAL = [
  { path: "leadId", select: "clientName company leadId phone email" },
  { path: "salesRep", select: "username role" },
  { path: "createdBy", select: "username" },
  { path: "stageHistory.changedBy", select: "username" },
];

// ─── Controllers ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/deals
 */
const createDeal = AsyncHandler(async (req, res) => {
  const {
    leadId, customerName, salesRep, quotationNo, quotationDate,
    piNo, invoiceNo, sellingPricePerUnit, qty,
    commissionPct, sample, advance, balance,
    orderConfirmDate, expectedDelivery,
  } = req.body;

  if (!leadId) throw new ApiError(400, "Lead reference is required");

  // Verify lead exists
  const lead = await Lead.findById(leadId).lean();
  if (!lead) throw new ApiError(404, "Referenced lead not found");

  const dealIdStr = await generateDealId(lead.serviceType);

  // Resolve salesRep: sales user defaults to self
  const resolvedSalesRep =
    req.user.role === "sales"
      ? req.user._id
      : salesRep || req.user._id;

  const deal = new Deal({
    dealId: dealIdStr,
    leadId,
    customerName: customerName?.trim() || lead.clientName || "",
    salesRep: resolvedSalesRep,
    quotationNo: quotationNo?.trim() || "",
    quotationDate: quotationDate ? new Date(quotationDate) : null,
    piNo: piNo?.trim() || "",
    invoiceNo: invoiceNo?.trim() || "",
    sellingPricePerUnit: Number(sellingPricePerUnit) || 0,
    qty: Number(qty) || 0,
    commissionPct: commissionPct !== undefined ? Number(commissionPct) : 20,
    sample: {
      required: sample?.required || false,
      sentDate: sample?.sentDate ? new Date(sample.sentDate) : null,
      approved: sample?.approved || false,
    },
    advance: {
      amount: Number(advance?.amount) || 0,
      receivedDate: advance?.receivedDate ? new Date(advance.receivedDate) : null,
    },
    balance: {
      amount: Number(balance?.amount) || 0,
      dueTrigger: balance?.dueTrigger || "",
      receivedDate: balance?.receivedDate ? new Date(balance.receivedDate) : null,
    },
    orderConfirmDate: orderConfirmDate ? new Date(orderConfirmDate) : null,
    expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
    stage: "Quotation Sent",
    createdBy: req.user._id,
    stageHistory: [{
      stage: "Quotation Sent",
      changedBy: req.user._id,
      changedAt: new Date(),
      remark: "Deal created",
    }],
  });

  recalcFinancials(deal);
  await deal.save();

  const populated = await Deal.findById(deal._id).populate(POPULATE_DEAL).lean();

  await AuditLog.create({
    userId: req.user._id,
    action: "CREATE_DEAL",
    entity: "Deal",
    entityId: deal._id,
    newValue: { dealId: deal.dealId, customerName: deal.customerName, stage: deal.stage },
  });

  res.status(201).json(
    new ApiResponse(201, populated, "Deal created"),
  );
});

/**
 * GET /api/v1/deals
 */
const getDeals = AsyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = buildFilter(req.query, req.user);

  const [deals, total] = await Promise.all([
    Deal.find(filter)
      .populate(POPULATE_DEAL)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Deal.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      deals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, "Deals fetched"),
  );
});

/**
 * GET /api/v1/deals/:id
 */
const getDealById = AsyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...scopeFilter(req.user) };

  const deal = await Deal.findOne(filter).populate(POPULATE_DEAL).lean();
  if (!deal) throw new ApiError(404, "Deal not found");

  res.status(200).json(new ApiResponse(200, deal, "Deal fetched"));
});

/**
 * PATCH /api/v1/deals/:id
 */
const updateDeal = AsyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...scopeFilter(req.user) };
  const deal = await Deal.findOne(filter);
  if (!deal) throw new ApiError(404, "Deal not found");

  const {
    customerName, quotationNo, quotationDate, piNo, invoiceNo,
    sellingPricePerUnit, qty, commissionPct, commissionStatus,
    sample, advance, balance,
    orderConfirmDate, expectedDelivery, actualDelivery,
    stage, stageRemark,
  } = req.body;

  // ── Stage transition validation ──────────────────────────────────────────
  if (stage && stage !== deal.stage) {
    const allowed = DEAL_STAGE_TRANSITIONS[deal.stage];
    if (!allowed || !allowed.includes(stage)) {
      throw new ApiError(
        400,
        `Cannot move from "${deal.stage}" to "${stage}". Allowed: ${allowed?.join(", ") || "none"}`,
      );
    }

    const oldStage = deal.stage;
    deal.stage = stage;
    deal.stageHistory.push({
      stage,
      changedBy: req.user._id,
      changedAt: new Date(),
      remark: stageRemark?.trim() || "",
    });

    await AuditLog.create({
      userId: req.user._id,
      action: "DEAL_STAGE_CHANGE",
      entity: "Deal",
      entityId: deal._id,
      oldValue: { stage: oldStage },
      newValue: { stage },
    });
  }

  // ── Field updates ─────────────────────────────────────────────────────────
  if (req.user.role !== "sales" && req.body.salesRep !== undefined) {
    deal.salesRep = req.body.salesRep || null;
  }
  if (req.body.buyingCost !== undefined) deal.buyingCost = Number(req.body.buyingCost) || 0;
  if (req.body.landedCost !== undefined) deal.landedCost = Number(req.body.landedCost) || 0;
  if (customerName !== undefined) deal.customerName = customerName?.trim() || "";
  if (quotationNo !== undefined) deal.quotationNo = quotationNo?.trim() || "";
  if (quotationDate !== undefined) deal.quotationDate = quotationDate ? new Date(quotationDate) : null;
  if (piNo !== undefined) deal.piNo = piNo?.trim() || "";
  if (invoiceNo !== undefined) deal.invoiceNo = invoiceNo?.trim() || "";
  if (sellingPricePerUnit !== undefined) deal.sellingPricePerUnit = Number(sellingPricePerUnit) || 0;
  if (qty !== undefined) deal.qty = Number(qty) || 0;
  if (commissionPct !== undefined) deal.commissionPct = Number(commissionPct);
  if (commissionStatus) deal.commissionStatus = commissionStatus;
  if (orderConfirmDate !== undefined) deal.orderConfirmDate = orderConfirmDate ? new Date(orderConfirmDate) : null;
  if (expectedDelivery !== undefined) deal.expectedDelivery = expectedDelivery ? new Date(expectedDelivery) : null;
  if (actualDelivery !== undefined) deal.actualDelivery = actualDelivery ? new Date(actualDelivery) : null;

  // Sample sub-document
  if (sample) {
    if (sample.required !== undefined) deal.sample.required = sample.required;
    if (sample.sentDate !== undefined) deal.sample.sentDate = sample.sentDate ? new Date(sample.sentDate) : null;
    if (sample.approved !== undefined) deal.sample.approved = sample.approved;
  }

  // Payment sub-documents
  if (advance) {
    if (advance.amount !== undefined) deal.advance.amount = Number(advance.amount) || 0;
    if (advance.receivedDate !== undefined) deal.advance.receivedDate = advance.receivedDate ? new Date(advance.receivedDate) : null;
  }
  if (balance) {
    if (balance.amount !== undefined) deal.balance.amount = Number(balance.amount) || 0;
    if (balance.dueTrigger !== undefined) deal.balance.dueTrigger = balance.dueTrigger || "";
    if (balance.receivedDate !== undefined) deal.balance.receivedDate = balance.receivedDate ? new Date(balance.receivedDate) : null;
  }

  // Recalculate financials
  recalcFinancials(deal);

  await deal.save();

  const updated = await Deal.findById(deal._id).populate(POPULATE_DEAL).lean();

  res.status(200).json(new ApiResponse(200, updated, "Deal updated"));
});

/**
 * DELETE /api/v1/deals/:id — superadmin only
 */
const deleteDeal = AsyncHandler(async (req, res) => {
  const deal = await Deal.findByIdAndDelete(req.params.id);
  if (!deal) throw new ApiError(404, "Deal not found");

  await AuditLog.create({
    userId: req.user._id,
    action: "DELETE_DEAL",
    entity: "Deal",
    entityId: deal._id,
    oldValue: { dealId: deal.dealId, customerName: deal.customerName, stage: deal.stage },
  });

  res.status(200).json(new ApiResponse(200, {}, "Deal deleted"));
});

/**
 * GET /api/v1/deals/:id/pdf — download Proforma Invoice PDF
 */
const downloadProformaPdf = AsyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...scopeFilter(req.user) };
  const deal = await Deal.findOne(filter).populate(POPULATE_DEAL).lean();
  if (!deal) throw new ApiError(404, "Deal not found");

  // Fetch the linked lead for client details
  const lead = deal.leadId
    ? await Lead.findById(deal.leadId._id).select("clientName company email phone productNeeded serviceType").lean()
    : null;

  const pdfBuffer = await generateProformaInvoicePdf(deal, lead);

  const filename = `PI-${deal.dealId || deal._id}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(pdfBuffer);
});

export { createDeal, getDeals, getDealById, updateDeal, deleteDeal, downloadProformaPdf };

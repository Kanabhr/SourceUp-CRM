import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { AuditLog } from "../MongoDB/Models/AuditLog.schema.js";
import { Purchase, PO_STATUS_TRANSITIONS } from "../MongoDB/Models/Purchase.schema.js";
import { Deal } from "../MongoDB/Models/Deal.schema.js";
import { generatePoId } from "../Utils/generateId.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Calculate landed cost per unit using the Sprint 2 formula.
 */
const calcLandedCost = (po) => {
  const q = po.qty || 1; // avoid divide-by-zero
  const baseCost = (po.unitCost || 0) * (po.exchangeRate || 1);
  const pkgPerUnit = (po.packagingCost || 0) / q;
  const chinaCosts = po.vendorCountry === "China"
    ? ((po.freight || 0) + (po.customsDuty || 0) + (po.clearingCharges || 0) + (po.insurance || 0)) / q
    : 0;
  po.landedCostPerUnit = Math.round((baseCost + pkgPerUnit + chinaCosts) * 100) / 100;
  po.totalLandedCost = Math.round(po.landedCostPerUnit * q * 100) / 100;
};

/**
 * Push buying/landed cost back to the linked Deal and recalculate GP.
 */
const syncToDeal = async (po) => {
  const deal = await Deal.findById(po.dealId);
  if (!deal) return;

  deal.buyingCost = po.unitCost || 0;
  deal.landedCost = po.landedCostPerUnit || 0;

  // Recalculate GP
  deal.orderValue = (deal.sellingPricePerUnit || 0) * (deal.qty || 0);
  const totalLandedCost = deal.landedCost * (deal.qty || 0);
  deal.grossProfit = deal.orderValue - totalLandedCost;
  deal.grossProfitPct = deal.orderValue > 0
    ? Math.round((deal.grossProfit / deal.orderValue) * 10000) / 100
    : 0;
  deal.commissionAmount = deal.grossProfit > 0
    ? Math.round(deal.grossProfit * (deal.commissionPct || 0)) / 100
    : 0;

  await deal.save();
};

/**
 * Build a MongoDB filter from query params.
 */
const buildFilter = (query) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.dealId) filter.dealId = query.dealId;
  if (query.vendorCountry) filter.vendorCountry = query.vendorCountry;
  if (query.search) {
    filter.$or = [
      { poId: { $regex: query.search, $options: "i" } },
      { vendorName: { $regex: query.search, $options: "i" } },
      { product: { $regex: query.search, $options: "i" } },
    ];
  }
  return filter;
};

const POPULATE_PO = [
  { path: "dealId", select: "dealId customerName stage" },
  { path: "vendorRef", select: "vendorId companyName contactPerson phone email country category" },
  { path: "assignedTo", select: "username role" },
  { path: "createdBy", select: "username" },
  { path: "statusHistory.changedBy", select: "username" },
];

// ─── Controllers ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/purchase
 */
const createPO = AsyncHandler(async (req, res) => {
  const {
    dealId, vendorRef, vendorName, vendorCountry, vendorContact,
    product, specs, qty, unitCost, currency, exchangeRate,
    packagingCost, freight, customsDuty, clearingCharges, insurance,
    vendorPaymentTerms, advancePaid, balancePaid,
    productionStart, readyDate, dispatchDate, etaIndia,
    blNo, trackingNo, assignedTo,
  } = req.body;

  if (!dealId) throw new ApiError(400, "Deal reference is required");

  // Verify deal exists
  const deal = await Deal.findById(dealId).lean();
  if (!deal) throw new ApiError(404, "Referenced deal not found");

  const poIdStr = await generatePoId();

  const po = new Purchase({
    poId: poIdStr,
    dealId,
    vendorRef: vendorRef || null,
    vendorName: vendorName?.trim() || "",
    vendorCountry: vendorCountry || "India",
    vendorContact: vendorContact?.trim() || "",
    product: product?.trim() || "",
    specs: specs?.trim() || "",
    qty: Number(qty) || 0,
    unitCost: Number(unitCost) || 0,
    currency: currency || "INR",
    exchangeRate: Number(exchangeRate) || 1,
    packagingCost: Number(packagingCost) || 0,
    freight: Number(freight) || 0,
    customsDuty: Number(customsDuty) || 0,
    clearingCharges: Number(clearingCharges) || 0,
    insurance: Number(insurance) || 0,
    vendorPaymentTerms: vendorPaymentTerms?.trim() || "",
    advancePaid: {
      amount: Number(advancePaid?.amount) || 0,
      date: advancePaid?.date ? new Date(advancePaid.date) : null,
    },
    balancePaid: {
      amount: Number(balancePaid?.amount) || 0,
      date: balancePaid?.date ? new Date(balancePaid.date) : null,
    },
    productionStart: productionStart ? new Date(productionStart) : null,
    readyDate: readyDate ? new Date(readyDate) : null,
    dispatchDate: dispatchDate ? new Date(dispatchDate) : null,
    etaIndia: etaIndia ? new Date(etaIndia) : null,
    blNo: blNo?.trim() || "",
    trackingNo: trackingNo?.trim() || "",
    assignedTo: assignedTo || null,
    status: "PO Raised",
    createdBy: req.user._id,
    statusHistory: [{
      status: "PO Raised",
      changedBy: req.user._id,
      changedAt: new Date(),
      remark: "Purchase Order created",
    }],
  });

  calcLandedCost(po);
  await po.save();

  // Push landed cost to deal
  await syncToDeal(po);

  const populated = await Purchase.findById(po._id).populate(POPULATE_PO).lean();

  await AuditLog.create({
    userId: req.user._id,
    action: "CREATE_PO",
    entity: "Purchase",
    entityId: po._id,
    newValue: { poId: po.poId, vendorName: po.vendorName, status: po.status },
  });

  res.status(201).json(
    new ApiResponse(201, populated, "Purchase Order created"),
  );
});

/**
 * GET /api/v1/purchase
 */
const getPOs = AsyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = buildFilter(req.query);

  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .populate(POPULATE_PO)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Purchase.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      purchases,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, "Purchase Orders fetched"),
  );
});

/**
 * GET /api/v1/purchase/:id
 */
const getPOById = AsyncHandler(async (req, res) => {
  const po = await Purchase.findById(req.params.id).populate(POPULATE_PO).lean();
  if (!po) throw new ApiError(404, "Purchase Order not found");

  res.status(200).json(new ApiResponse(200, po, "Purchase Order fetched"));
});

/**
 * PATCH /api/v1/purchase/:id
 */
const updatePO = AsyncHandler(async (req, res) => {
  const po = await Purchase.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");

  const {
    vendorName, vendorCountry, vendorContact,
    product, specs, qty, unitCost, currency, exchangeRate,
    packagingCost, freight, customsDuty, clearingCharges, insurance,
    vendorPaymentTerms, advancePaid, balancePaid,
    productionStart, readyDate, dispatchDate, etaIndia, receivedDate,
    blNo, trackingNo, qcStatus, qcRemarks, assignedTo,
    status, statusRemark,
  } = req.body;

  // ── Status transition validation ──────────────────────────────────────────
  if (status && status !== po.status) {
    const allowed = PO_STATUS_TRANSITIONS[po.status];
    if (!allowed || !allowed.includes(status)) {
      throw new ApiError(
        400,
        `Cannot move from "${po.status}" to "${status}". Allowed: ${allowed?.join(", ") || "none"}`,
      );
    }

    const oldStatus = po.status;
    po.status = status;
    po.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      remark: statusRemark?.trim() || "",
    });

    await AuditLog.create({
      userId: req.user._id,
      action: "PO_STATUS_CHANGE",
      entity: "Purchase",
      entityId: po._id,
      oldValue: { status: oldStatus },
      newValue: { status },
    });
  }

  // ── Field updates ─────────────────────────────────────────────────────────
  if (req.body.vendorRef !== undefined) po.vendorRef = req.body.vendorRef || null;
  if (vendorName !== undefined) po.vendorName = vendorName?.trim() || "";
  if (vendorCountry !== undefined) po.vendorCountry = vendorCountry;
  if (vendorContact !== undefined) po.vendorContact = vendorContact?.trim() || "";
  if (product !== undefined) po.product = product?.trim() || "";
  if (specs !== undefined) po.specs = specs?.trim() || "";
  if (qty !== undefined) po.qty = Number(qty) || 0;
  if (unitCost !== undefined) po.unitCost = Number(unitCost) || 0;
  if (currency !== undefined) po.currency = currency;
  if (exchangeRate !== undefined) po.exchangeRate = Number(exchangeRate) || 1;
  if (packagingCost !== undefined) po.packagingCost = Number(packagingCost) || 0;
  if (freight !== undefined) po.freight = Number(freight) || 0;
  if (customsDuty !== undefined) po.customsDuty = Number(customsDuty) || 0;
  if (clearingCharges !== undefined) po.clearingCharges = Number(clearingCharges) || 0;
  if (insurance !== undefined) po.insurance = Number(insurance) || 0;
  if (vendorPaymentTerms !== undefined) po.vendorPaymentTerms = vendorPaymentTerms?.trim() || "";
  if (blNo !== undefined) po.blNo = blNo?.trim() || "";
  if (trackingNo !== undefined) po.trackingNo = trackingNo?.trim() || "";
  if (qcStatus !== undefined) po.qcStatus = qcStatus;
  if (qcRemarks !== undefined) po.qcRemarks = qcRemarks?.trim() || "";
  if (assignedTo !== undefined) po.assignedTo = assignedTo || null;

  // Date fields
  if (productionStart !== undefined) po.productionStart = productionStart ? new Date(productionStart) : null;
  if (readyDate !== undefined) po.readyDate = readyDate ? new Date(readyDate) : null;
  if (dispatchDate !== undefined) po.dispatchDate = dispatchDate ? new Date(dispatchDate) : null;
  if (etaIndia !== undefined) po.etaIndia = etaIndia ? new Date(etaIndia) : null;
  if (receivedDate !== undefined) po.receivedDate = receivedDate ? new Date(receivedDate) : null;

  // Payment sub-documents
  if (advancePaid) {
    if (advancePaid.amount !== undefined) po.advancePaid.amount = Number(advancePaid.amount) || 0;
    if (advancePaid.date !== undefined) po.advancePaid.date = advancePaid.date ? new Date(advancePaid.date) : null;
  }
  if (balancePaid) {
    if (balancePaid.amount !== undefined) po.balancePaid.amount = Number(balancePaid.amount) || 0;
    if (balancePaid.date !== undefined) po.balancePaid.date = balancePaid.date ? new Date(balancePaid.date) : null;
  }

  // Recalculate landed cost
  calcLandedCost(po);
  await po.save();

  // Push landed cost to deal
  await syncToDeal(po);

  const updated = await Purchase.findById(po._id).populate(POPULATE_PO).lean();

  res.status(200).json(new ApiResponse(200, updated, "Purchase Order updated"));
});

/**
 * DELETE /api/v1/purchase/:id — superadmin only
 */
const deletePO = AsyncHandler(async (req, res) => {
  const po = await Purchase.findByIdAndDelete(req.params.id);
  if (!po) throw new ApiError(404, "Purchase Order not found");

  await AuditLog.create({
    userId: req.user._id,
    action: "DELETE_PO",
    entity: "Purchase",
    entityId: po._id,
    oldValue: { poId: po.poId, vendorName: po.vendorName, status: po.status },
  });

  res.status(200).json(new ApiResponse(200, {}, "Purchase Order deleted"));
});

export { createPO, getPOs, getPOById, updatePO, deletePO };

import mongoose from "mongoose";
import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { computeDealKPIs, computeLeadStats } from "../Utils/aggregations.js";
import { Deal } from "../MongoDB/Models/Deal.schema.js";
import { Lead } from "../MongoDB/Models/Lead.schema.js";
import { User } from "../MongoDB/Models/User.schema.js";

// ─── Sales Report ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/sales
 * Query params:
 *   startDate   ISO date string — lower bound on orderConfirmDate
 *   endDate     ISO date string — upper bound on orderConfirmDate
 *   salesRep    User ObjectId string
 *   serviceType string (matched via the referenced Lead's serviceType)
 *
 * Returns: { kpis, deals }
 */
const getSalesReport = AsyncHandler(async (req, res) => {
  const { startDate, endDate, salesRep, serviceType } = req.query;

  // Build the deal filter
  const filter = {};

  if (startDate || endDate) {
    filter.orderConfirmDate = {};
    if (startDate) filter.orderConfirmDate.$gte = new Date(startDate);
    if (endDate) {
      // Include the entire end day
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      filter.orderConfirmDate.$lte = end;
    }
  }

  if (salesRep) {
    if (mongoose.Types.ObjectId.isValid(salesRep)) {
      filter.salesRep = new mongoose.Types.ObjectId(salesRep);
    }
  }

  // serviceType lives on the Lead, not the Deal — handled via aggregation lookup
  // For the KPI aggregation we pass the filter as-is (serviceType filtering is
  // post-lookup in computeDealKPIs already).  For the deal list we use a
  // separate pipeline when serviceType is provided.
  let dealDocs;

  if (serviceType) {
    // Need a lookup to filter by lead.serviceType
    dealDocs = await Deal.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "leads",
          localField: "leadId",
          foreignField: "_id",
          as: "leadDoc",
        },
      },
      { $unwind: { path: "$leadDoc", preserveNullAndEmptyArrays: true } },
      { $match: { "leadDoc.serviceType": serviceType } },
      {
        $lookup: {
          from: "users",
          localField: "salesRep",
          foreignField: "_id",
          as: "salesRepDoc",
        },
      },
      { $unwind: { path: "$salesRepDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          dealId: 1,
          leadId: 1,
          salesRep: { $ifNull: ["$salesRepDoc.username", null] },
          salesRepId: "$salesRep",
          sellingPricePerUnit: 1,
          qty: 1,
          commissionPct: 1,
          orderConfirmDate: 1,
          serviceType: "$leadDoc.serviceType",
        },
      },
      { $sort: { orderConfirmDate: -1 } },
    ]);
  } else {
    dealDocs = await Deal.find(filter)
      .select(
        "dealId leadId salesRep sellingPricePerUnit qty commissionPct orderConfirmDate",
      )
      .populate("salesRep", "username")
      .sort({ orderConfirmDate: -1 })
      .lean();
  }

  // For KPIs: if serviceType is provided, build a restricted _id set
  let kpiFilter = { ...filter };

  if (serviceType) {
    // Collect matching deal _ids from the aggregation result above
    const matchingIds = dealDocs.map((d) => d._id);
    kpiFilter = { _id: { $in: matchingIds } };
  }

  const kpis = await computeDealKPIs(kpiFilter);

  res.status(200).json(
    new ApiResponse(200, { kpis, deals: dealDocs }, "Sales report fetched"),
  );
});

// ─── Leads Report ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/leads
 * Query params:
 *   startDate   ISO date string — lower bound on createdAt
 *   endDate     ISO date string — upper bound on createdAt
 *   assignedTo  User ObjectId string
 *   status      string (Lead status enum)
 *   serviceType string
 *
 * Returns: { stats, leads }
 */
const getLeadsReport = AsyncHandler(async (req, res) => {
  const { startDate, endDate, assignedTo, status, serviceType } = req.query;

  const filter = {};

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
    filter.assignedTo = new mongoose.Types.ObjectId(assignedTo);
  }

  if (status) filter.status = status;
  if (serviceType) filter.serviceType = serviceType;

  const [stats, leads] = await Promise.all([
    computeLeadStats(filter),
    Lead.find(filter)
      .select("leadId clientName company status serviceType assignedTo createdAt")
      .populate("assignedTo", "username")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  res.status(200).json(
    new ApiResponse(200, { stats, leads }, "Leads report fetched"),
  );
});

// ─── Commission Report ───────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/commission
 * Query params:
 *   startDate  ISO date string — lower bound on orderConfirmDate
 *   endDate    ISO date string — upper bound on orderConfirmDate
 *   salesRep   User ObjectId string (optional — filter to a single rep)
 *
 * Returns: { commissions: [{ salesRepId, username, totalDeals, totalRevenue, totalCommission }] }
 * Sorted by totalCommission DESC.
 * Requires: manager or superadmin role (enforced in route).
 */
const getCommissionReport = AsyncHandler(async (req, res) => {
  const { startDate, endDate, salesRep } = req.query;

  const matchFilter = {};

  if (startDate || endDate) {
    matchFilter.orderConfirmDate = {};
    if (startDate) matchFilter.orderConfirmDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      matchFilter.orderConfirmDate.$lte = end;
    }
  }

  if (salesRep && mongoose.Types.ObjectId.isValid(salesRep)) {
    matchFilter.salesRep = new mongoose.Types.ObjectId(salesRep);
  }

  const commissions = await Deal.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: "$salesRep",
        totalDeals: { $sum: 1 },
        totalRevenue: {
          $sum: { $multiply: ["$sellingPricePerUnit", "$qty"] },
        },
        totalCommission: {
          $sum: {
            $multiply: [
              { $multiply: ["$sellingPricePerUnit", "$qty"] },
              { $divide: ["$commissionPct", 100] },
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userDoc",
      },
    },
    { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        salesRepId: "$_id",
        username: { $ifNull: ["$userDoc.username", "Unknown"] },
        totalDeals: 1,
        totalRevenue: 1,
        totalCommission: 1,
      },
    },
    { $sort: { totalCommission: -1 } },
  ]);

  res.status(200).json(
    new ApiResponse(200, { commissions }, "Commission report fetched"),
  );
});

export { getSalesReport, getLeadsReport, getCommissionReport };

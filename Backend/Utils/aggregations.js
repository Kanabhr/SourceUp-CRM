import { Deal } from "../MongoDB/Models/Deal.schema.js";
import { Lead } from "../MongoDB/Models/Lead.schema.js";

/**
 * Compute deal-based KPIs from the deals collection.
 *
 * @param {object} filter - Mongoose-compatible pre-filter for deals.
 * @returns {Promise<{
 *   totalDeals: number,
 *   totalRevenue: number,
 *   totalCommission: number,
 *   avgDealValue: number,
 *   dealsByStatus: Record<string, number>,
 *   dealsByService: Record<string, number>,
 *   monthlySales: Array<{ month: string, revenue: number, count: number }>
 * }>}
 */
const computeDealKPIs = async (filter = {}) => {
  // Twelve months ago from now (start of that month, UTC)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11);
  twelveMonthsAgo.setUTCDate(1);
  twelveMonthsAgo.setUTCHours(0, 0, 0, 0);

  const [summaryResult, byStatusResult, byServiceResult, monthlyResult] =
    await Promise.all([
      // ── Overall totals ───────────────────────────────────────────────────
      Deal.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
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
      ]),

      // ── Count by stage (used as "status") ───────────────────────────────
      Deal.aggregate([
        { $match: filter },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ]),

      // ── Count by serviceType (via Lead lookup) ───────────────────────────
      Deal.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "leads",
            localField: "leadId",
            foreignField: "_id",
            as: "lead",
          },
        },
        { $unwind: { path: "$lead", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$lead.serviceType", "Unknown"] },
            count: { $sum: 1 },
          },
        },
      ]),

      // ── Monthly sales (last 12 months, by orderConfirmDate) ───────────────
      Deal.aggregate([
        {
          $match: {
            ...filter,
            orderConfirmDate: { $gte: twelveMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$orderConfirmDate" },
              month: { $month: "$orderConfirmDate" },
            },
            revenue: {
              $sum: { $multiply: ["$sellingPricePerUnit", "$qty"] },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

  const summary = summaryResult[0] || {
    totalDeals: 0,
    totalRevenue: 0,
    totalCommission: 0,
  };

  const totalDeals = summary.totalDeals;
  const totalRevenue = summary.totalRevenue;
  const totalCommission = summary.totalCommission;
  const avgDealValue = totalDeals > 0 ? totalRevenue / totalDeals : 0;

  const dealsByStatus = byStatusResult.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const dealsByService = byServiceResult.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const monthlySales = monthlyResult.map((item) => ({
    month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
    revenue: item.revenue,
    count: item.count,
  }));

  return {
    totalDeals,
    totalRevenue,
    totalCommission,
    avgDealValue,
    dealsByStatus,
    dealsByService,
    monthlySales,
  };
};

/**
 * Compute lead-based statistics from the leads collection.
 *
 * @param {object} filter - Mongoose-compatible pre-filter for leads.
 * @returns {Promise<{
 *   totalLeads: number,
 *   leadsByStatus: Record<string, number>,
 *   leadsByService: Record<string, number>,
 *   leadsBySource: Record<string, number>
 * }>}
 */
const computeLeadStats = async (filter = {}) => {
  const [totalResult, byStatusResult, byServiceResult, bySourceResult] =
    await Promise.all([
      Lead.aggregate([
        { $match: filter },
        { $count: "total" },
      ]),

      Lead.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      Lead.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ["$serviceType", "Unknown"] },
            count: { $sum: 1 },
          },
        },
      ]),

      Lead.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ["$source", "Unknown"] },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  const totalLeads = totalResult[0]?.total ?? 0;

  const leadsByStatus = byStatusResult.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const leadsByService = byServiceResult.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const leadsBySource = bySourceResult.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  return { totalLeads, leadsByStatus, leadsByService, leadsBySource };
};

export { computeDealKPIs, computeLeadStats };

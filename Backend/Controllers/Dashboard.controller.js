import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { computeDealKPIs, computeLeadStats } from "../Utils/aggregations.js";

/**
 * GET /api/v1/dashboard
 * Accessible to: manager, superadmin (enforced in routes).
 *
 * Returns a combined snapshot of deal KPIs and lead statistics
 * across the entire dataset (no scope filter applied here — managers
 * and superadmins see everything).
 */
const getDashboard = AsyncHandler(async (req, res) => {
  const [deals, leads] = await Promise.all([
    computeDealKPIs({}),
    computeLeadStats({}),
  ]);

  res.status(200).json(
    new ApiResponse(200, { deals, leads }, "Dashboard data fetched"),
  );
});

export { getDashboard };

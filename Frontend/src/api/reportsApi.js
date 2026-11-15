import axiosService from "./axios.js";

/**
 * Build a query string from a params object, omitting empty/null/blank values.
 */
const toQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
  });
  const str = q.toString();
  return str ? `?${str}` : "";
};

/**
 * GET /reports/sales
 * @param {{ startDate?, endDate?, salesRep?, serviceType? }} params
 */
const getSalesReport = (params = {}) =>
  axiosService.get(`/reports/sales${toQuery(params)}`);

/**
 * GET /reports/leads
 * @param {{ startDate?, endDate?, assignedTo?, status?, serviceType? }} params
 */
const getLeadsReport = (params = {}) =>
  axiosService.get(`/reports/leads${toQuery(params)}`);

/**
 * GET /reports/commission
 * @param {{ startDate?, endDate?, salesRep? }} params
 */
const getCommissionReport = (params = {}) =>
  axiosService.get(`/reports/commission${toQuery(params)}`);

export { getSalesReport, getLeadsReport, getCommissionReport };

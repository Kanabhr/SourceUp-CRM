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

// ─── Deals ──────────────────────────────────────────────────────────────────

/** GET /deals — paginated, filtered list */
const getDeals = (params = {}) => axiosService.get(`/deals${toQuery(params)}`);

/** GET /deals/:id — single deal with refs populated */
const getDealById = (id) => axiosService.get(`/deals/${id}`);

/** POST /deals — create a new deal */
const createDeal = (data) => axiosService.post("/deals", data);

/** PATCH /deals/:id — update fields or advance stage */
const updateDeal = (id, data) => axiosService.patch(`/deals/${id}`, data);

/** DELETE /deals/:id — superadmin only */
const deleteDeal = (id) => axiosService.delete(`/deals/${id}`);

/** GET /deals/:id/pdf — download Proforma Invoice PDF (blob) */
const downloadProformaPdf = (id) =>
  axiosService.get(`/deals/${id}/pdf`, { responseType: "blob", timeout: 30000 });

export { getDeals, getDealById, createDeal, updateDeal, deleteDeal, downloadProformaPdf };

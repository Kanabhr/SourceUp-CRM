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

// ─── Purchase Orders ────────────────────────────────────────────────────────

/** GET /purchase — paginated, filtered list */
const getPOs = (params = {}) => axiosService.get(`/purchase${toQuery(params)}`);

/** GET /purchase/:id — single PO with refs populated */
const getPOById = (id) => axiosService.get(`/purchase/${id}`);

/** POST /purchase — create a new PO */
const createPO = (data) => axiosService.post("/purchase", data);

/** PATCH /purchase/:id — update fields or advance status */
const updatePO = (id, data) => axiosService.patch(`/purchase/${id}`, data);

/** DELETE /purchase/:id — superadmin only */
const deletePO = (id) => axiosService.delete(`/purchase/${id}`);

export { getPOs, getPOById, createPO, updatePO, deletePO };

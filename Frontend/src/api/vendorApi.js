import axiosService from "./axios.js";

const toQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
  });
  const str = q.toString();
  return str ? `?${str}` : "";
};

/** GET /vendors — paginated, filtered list */
export const getVendors = (params = {}) => axiosService.get(`/vendors${toQuery(params)}`);

/** GET /vendors/search?q= — autocomplete for POs */
export const searchVendors = (q = "") => axiosService.get(`/vendors/search${toQuery({ q })}`);

/** GET /vendors/:id — single vendor */
export const getVendorById = (id) => axiosService.get(`/vendors/${id}`);

/** POST /vendors — create new vendor */
export const createVendor = (data) => axiosService.post("/vendors", data);

/** PATCH /vendors/:id — update vendor */
export const updateVendor = (id, data) => axiosService.patch(`/vendors/${id}`, data);

/** DELETE /vendors/:id — delete vendor (superadmin only) */
export const deleteVendor = (id) => axiosService.delete(`/vendors/${id}`);

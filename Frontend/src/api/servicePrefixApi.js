import axiosService from "./axios.js";

/**
 * GET /service-prefixes?active=true|false
 * @param {boolean|undefined} active  pass true/false to filter, or omit for all
 */
const listPrefixes = (active) => {
  const params = {};
  if (active !== undefined && active !== null) params.active = active;
  return axiosService.get("/service-prefixes", { params });
};

/** POST /service-prefixes  —  { code, name?, isActive? } */
const createPrefix = (data) => axiosService.post("/service-prefixes", data);

/** PATCH /service-prefixes/:id  —  { name?, isActive? } */
const updatePrefix = (id, data) => axiosService.patch(`/service-prefixes/${id}`, data);

/** DELETE /service-prefixes/:id */
const deletePrefix = (id) => axiosService.delete(`/service-prefixes/${id}`);

/** POST /service-prefixes/:id/toggle  —  flips isActive */
const togglePrefix = (id) => axiosService.post(`/service-prefixes/${id}/toggle`);

export { listPrefixes, createPrefix, updatePrefix, deletePrefix, togglePrefix };

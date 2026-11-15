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

// âââ Leads âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

/** GET /leads â paginated, filtered list */
const getLeads = (params = {}) => axiosService.get(`/leads${toQuery(params)}`);

/** GET /leads/:id â single lead with notes + statusHistory populated */
const getLeadById = (id) => axiosService.get(`/leads/${id}`);

/** POST /leads â create a new lead */
const createLead = (data) => axiosService.post("/leads", data);

/** PATCH /leads/:id â update fields or advance status */
const updateLead = (id, data) => axiosService.patch(`/leads/${id}`, data);

/** DELETE /leads/:id â superadmin only */
const deleteLead = (id) => axiosService.delete(`/leads/${id}`);

// âââ Notes âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

/** POST /leads/:id/notes â add a note */
const addNote = (id, text) => axiosService.post(`/leads/${id}/notes`, { text });

// âââ History âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

/** GET /leads/:id/history â status history + audit log (manager/superadmin) */
const getLeadHistory = (id) => axiosService.get(`/leads/${id}/history`);

// âââ Users (for assignee dropdowns â superadmin + manager only) ââââââââââââââ

/**
 * Returns all users with role "sales" for use in assignee dropdowns.
 * Requires superadmin or manager role (backend enforces this).
 */
const getSalesUsers = () =>
  axiosService.get("/users").then((res) => {
    const all = res.data?.data ?? [];
    return all.filter((u) => u.role === "sales");
  });

// âââ Excel Import âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

/**
 * POST /leads/import/preview â upload .xlsx, get AI-verified preview back
 * @param {File} file â the .xlsx File object from the file input
 */
const importLeadsPreview = (file) => {
  const formData = new FormData();
  formData.append("leadsImport", file);
  // Do NOT set Content-Type manually - axios must auto-set multipart/form-data
  // with the correct boundary, otherwise multer cannot parse the file on the backend.
  // Use a 60s timeout to allow for Gemini AI verification on large sheets.
  return axiosService.post("/leads/import/preview", formData, {
    headers: { "Content-Type": undefined },
    timeout: 60000,
  });
};

/**
 * POST /leads/import/confirm â commit the confirmed rows to DB
 * @param {Array} rows â the preview rows the user approved
 */
const importLeadsConfirm = (rows) =>
  axiosService.post("/leads/import/confirm", { rows });

// ──── Reference photos (R1) ──────────────────────────────────────────────────
// NOTE: createLead/updateLead are pass-through — they forward every key in the
// supplied data object, so the four enrichment fields (packingDetails, moq,
// cbp, targetPrice) are included in the create/update payloads automatically
// whenever the caller provides them. No explicit field list is needed here.

/**
 * POST /leads/:id/photos — upload a single reference photo.
 * Multipart form-data, field name "photo" (jpg/jpeg/png/webp, <=5MB).
 * @param {string} id — lead id
 * @param {File} file — the image File from the file input
 * @returns {Promise} response with data.photos ([String] of stored filenames)
 */
const uploadLeadPhoto = (id, file) => {
  const formData = new FormData();
  formData.append("photo", file);
  // Do NOT set Content-Type manually — axios must auto-set multipart/form-data
  // with the correct boundary so multer can parse the file on the backend.
  return axiosService.post(`/leads/${id}/photos`, formData, {
    headers: { "Content-Type": undefined },
  });
};

/**
 * DELETE /leads/:id/photos/:index — remove a reference photo by its
 * zero-based index in lead.photos. Deletes the file on disk and the entry.
 */
const removeLeadPhoto = (id, index) =>
  axiosService.delete(`/leads/${id}/photos/${index}`);

export {
  getLeads, getLeadById, createLead, updateLead, deleteLead,
  addNote, getLeadHistory, getSalesUsers,
  importLeadsPreview, importLeadsConfirm,
  uploadLeadPhoto, removeLeadPhoto,
};


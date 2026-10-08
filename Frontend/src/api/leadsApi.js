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

// ─── Leads ───────────────────────────────────────────────────────────────────

/** GET /leads — paginated, filtered list */
const getLeads = (params = {}) => axiosService.get(`/leads${toQuery(params)}`);

/** GET /leads/:id — single lead with notes + statusHistory populated */
const getLeadById = (id) => axiosService.get(`/leads/${id}`);

/** POST /leads — create a new lead */
const createLead = (data) => axiosService.post("/leads", data);

/** PATCH /leads/:id — update fields or advance status */
const updateLead = (id, data) => axiosService.patch(`/leads/${id}`, data);

/** DELETE /leads/:id — superadmin only */
const deleteLead = (id) => axiosService.delete(`/leads/${id}`);

// ─── Notes ───────────────────────────────────────────────────────────────────

/** POST /leads/:id/notes — add a note */
const addNote = (id, text) => axiosService.post(`/leads/${id}/notes`, { text });

// ─── History ─────────────────────────────────────────────────────────────────

/** GET /leads/:id/history — status history + audit log (manager/superadmin) */
const getLeadHistory = (id) => axiosService.get(`/leads/${id}/history`);

// ─── Users (for assignee dropdowns — superadmin + manager only) ──────────────

/**
 * Returns all users with role "sales" for use in assignee dropdowns.
 * Requires superadmin or manager role (backend enforces this).
 */
const getSalesUsers = () =>
  axiosService.get("/users").then((res) => {
    const all = res.data?.data ?? [];
    return all.filter((u) => u.role === "sales");
  });

// ─── Excel Import ─────────────────────────────────────────────────────────────

/**
 * POST /leads/import/preview — upload .xlsx, get AI-verified preview back
 * @param {File} file — the .xlsx File object from the file input
 */
const importLeadsPreview = (file) => {
  const formData = new FormData();
  formData.append("leadsImport", file);
  // Do NOT set Content-Type manually � axios must auto-set multipart/form-data
  // with the correct boundary, otherwise multer cannot parse the file on the backend.
  // Use a 60s timeout to allow for Gemini AI verification on large sheets.
  return axiosService.post("/leads/import/preview", formData, {
    headers: { "Content-Type": undefined },
    timeout: 60000,
  });
};

/**
 * POST /leads/import/confirm — commit the confirmed rows to DB
 * @param {Array} rows — the preview rows the user approved
 */
const importLeadsConfirm = (rows) =>
  axiosService.post("/leads/import/confirm", { rows });

export {
  getLeads, getLeadById, createLead, updateLead, deleteLead,
  addNote, getLeadHistory, getSalesUsers,
  importLeadsPreview, importLeadsConfirm,
};


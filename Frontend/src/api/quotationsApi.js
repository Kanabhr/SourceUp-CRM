import axiosService from "./axios.js";

// ──── Quotations (R3) ─────────────────────────────────────────────────────────

/**
 * GET /quotations?leadId=<id>  — list quotations for a lead
 * @param {string} leadId
 * @param {string} [dealId]
 */
const getQuotations = (leadId, dealId) => {
  const params = {};
  if (leadId) params.leadId = leadId;
  if (dealId) params.dealId = dealId;
  return axiosService.get("/quotations", { params });
};

/** GET /quotations/:id — single quotation */
const getQuotationById = (id) => axiosService.get(`/quotations/${id}`);

/**
 * POST /quotations — create a new quotation (multipart, file optional)
 * @param {FormData} formData
 */
const createQuotation = (formData) =>
  axiosService.post("/quotations", formData, {
    headers: { "Content-Type": undefined },
  });

/**
 * PATCH /quotations/:id — update a quotation (multipart, file optional)
 * @param {string} id
 * @param {FormData} formData
 */
const updateQuotation = (id, formData) =>
  axiosService.patch(`/quotations/${id}`, formData, {
    headers: { "Content-Type": undefined },
  });

/** POST /quotations/:id/select — mark this quotation as selected */
const selectQuotation = (id) => axiosService.post(`/quotations/${id}/select`);

/** DELETE /quotations/:id — remove a quotation */
const deleteQuotation = (id) => axiosService.delete(`/quotations/${id}`);

/** GET /quotations/:id/pdf — download branded quotation PDF (blob) */
const downloadQuotationPdf = (id) =>
  axiosService.get(`/quotations/${id}/pdf`, { responseType: "blob", timeout: 30000 });

/** POST /quotations/:id/email — email the quotation PDF to the client */
const emailQuotationToClient = (id) =>
  axiosService.post(`/quotations/${id}/email`);

export {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  selectQuotation,
  deleteQuotation,
  downloadQuotationPdf,
  emailQuotationToClient,
};

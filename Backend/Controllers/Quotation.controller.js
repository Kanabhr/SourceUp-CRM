import fs from "fs";
import path from "path";
import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { AuditLog } from "../MongoDB/Models/AuditLog.schema.js";
import { Quotation } from "../MongoDB/Models/Quotation.schema.js";
import { generateQuotationId } from "../Utils/generateId.js";
import { generateQuotationPdf } from "../Utils/quotationPdf.js";
import { sendMail, isMailConfigured } from "../Utils/mailService.js";
import { Lead } from "../MongoDB/Models/Lead.schema.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive the path on disk for a stored fileUrl
 * e.g. "/uploads/quotations/abc.pdf" → "public/uploads/quotations/abc.pdf"
 */
const diskPath = (fileUrl) => {
  if (!fileUrl) return null;
  // fileUrl is stored as "/uploads/quotations/<filename>"
  // public/ is the static root, so prepend "public"
  return path.join("public", fileUrl);
};

/**
 * Delete a file from disk, silently ignore errors (file already gone, etc.).
 */
const removeFile = (fileUrl) => {
  if (!fileUrl) return;
  const fp = diskPath(fileUrl);
  if (!fp) return;
  try {
    fs.unlinkSync(fp);
  } catch (_err) {
    // silent — file may have been deleted already
  }
};

const POPULATE_QUOTATION = [
  { path: "vendorRef", select: "companyName" },
  { path: "createdBy", select: "username" },
];

// ─── Controllers ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/quotations
 * Creates a new quotation, optionally with an uploaded file.
 */
const createQuotation = AsyncHandler(async (req, res) => {
  const {
    leadId, dealId, vendorRef, vendorName,
    product, price, currency, exchangeRate,
    validity, terms,
  } = req.body;

  if (!leadId) throw new ApiError(400, "leadId is required");

  const quotationId = await generateQuotationId();

  const fileUrl = req.file ? `/uploads/quotations/${req.file.filename}` : "";

  const quotation = new Quotation({
    quotationId,
    leadId,
    dealId: dealId || null,
    vendorRef: vendorRef || null,
    vendorName: vendorName?.trim() || "",
    product: product?.trim() || "",
    price: Number(price) || 0,
    currency: currency || "INR",
    exchangeRate: Number(exchangeRate) || 1,
    validity: validity ? new Date(validity) : null,
    terms: terms?.trim() || "",
    fileUrl,
    isSelected: false,
    createdBy: req.user._id,
  });

  await quotation.save();

  const populated = await Quotation.findById(quotation._id)
    .populate(POPULATE_QUOTATION)
    .lean();

  await AuditLog.create({
    userId: req.user._id,
    action: "CREATE_QUOTATION",
    entity: "Quotation",
    entityId: quotation._id,
    newValue: { quotationId, leadId, price: quotation.price },
  });

  res.status(201).json(new ApiResponse(201, populated, "Quotation created"));
});

/**
 * GET /api/v1/quotations?leadId=...&dealId=...
 * List quotations for a lead (required), optionally filtered by dealId.
 */
const getQuotations = AsyncHandler(async (req, res) => {
  const { leadId, dealId } = req.query;
  if (!leadId) throw new ApiError(400, "leadId query parameter is required");

  const filter = { leadId };
  if (dealId) filter.dealId = dealId;

  const quotations = await Quotation.find(filter)
    .populate(POPULATE_QUOTATION)
    .sort({ price: 1 })
    .lean();

  res.status(200).json(new ApiResponse(200, { quotations }, "Quotations fetched"));
});

/**
 * GET /api/v1/quotations/:id
 * Fetch a single quotation by its MongoDB _id.
 */
const getQuotationById = AsyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id)
    .populate(POPULATE_QUOTATION)
    .lean();

  if (!quotation) throw new ApiError(404, "Quotation not found");

  res.status(200).json(new ApiResponse(200, quotation, "Quotation fetched"));
});

/**
 * PATCH /api/v1/quotations/:id
 * Update text fields and/or replace the uploaded file.
 */
const updateQuotation = AsyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw new ApiError(404, "Quotation not found");

  const {
    vendorRef, vendorName, product, price, currency,
    exchangeRate, validity, terms,
  } = req.body;

  // If a new file was uploaded, remove the old one from disk
  if (req.file) {
    removeFile(quotation.fileUrl);
    quotation.fileUrl = `/uploads/quotations/${req.file.filename}`;
  }

  if (vendorRef !== undefined) quotation.vendorRef = vendorRef || null;
  if (vendorName !== undefined) quotation.vendorName = vendorName?.trim() || "";
  if (product !== undefined) quotation.product = product?.trim() || "";
  if (price !== undefined) quotation.price = Number(price) || 0;
  if (currency !== undefined) quotation.currency = currency;
  if (exchangeRate !== undefined) quotation.exchangeRate = Number(exchangeRate) || 1;
  if (validity !== undefined) quotation.validity = validity ? new Date(validity) : null;
  if (terms !== undefined) quotation.terms = terms?.trim() || "";

  await quotation.save();

  const updated = await Quotation.findById(quotation._id)
    .populate(POPULATE_QUOTATION)
    .lean();

  await AuditLog.create({
    userId: req.user._id,
    action: "UPDATE_QUOTATION",
    entity: "Quotation",
    entityId: quotation._id,
    newValue: { quotationId: quotation.quotationId },
  });

  res.status(200).json(new ApiResponse(200, updated, "Quotation updated"));
});

/**
 * POST /api/v1/quotations/:id/select
 * Mark this quotation as selected; deselect all others for the same leadId.
 * Does NOT modify Deal.buyingCost (manual for v1).
 */
const selectQuotation = AsyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw new ApiError(404, "Quotation not found");

  // Deselect all other quotations for this lead first
  await Quotation.updateMany(
    { leadId: quotation.leadId, _id: { $ne: quotation._id } },
    { $set: { isSelected: false } },
  );

  // Select this one
  quotation.isSelected = true;
  await quotation.save();

  const updated = await Quotation.findById(quotation._id)
    .populate(POPULATE_QUOTATION)
    .lean();

  await AuditLog.create({
    userId: req.user._id,
    action: "SELECT_QUOTATION",
    entity: "Quotation",
    entityId: quotation._id,
    newValue: { quotationId: quotation.quotationId, leadId: quotation.leadId },
  });

  res.status(200).json(new ApiResponse(200, updated, "Quotation selected"));
});

/**
 * DELETE /api/v1/quotations/:id
 * Delete the quotation record and its file from disk (if any).
 */
const deleteQuotation = AsyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw new ApiError(404, "Quotation not found");

  // Remove the associated file from disk before deleting the record
  removeFile(quotation.fileUrl);

  await AuditLog.create({
    userId: req.user._id,
    action: "DELETE_QUOTATION",
    entity: "Quotation",
    entityId: quotation._id,
    oldValue: { quotationId: quotation.quotationId, leadId: quotation.leadId },
  });

  await Quotation.findByIdAndDelete(req.params.id);

  res.status(200).json(new ApiResponse(200, {}, "Quotation deleted"));
});

// ─── PDF Download ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/quotations/:id/pdf
 * Generates a branded PDF quotation and streams it as a download.
 */
const downloadQuotationPdf = AsyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id)
    .populate([{ path: "vendorRef", select: "companyName" }, { path: "leadId", select: "clientName company email phone productNeeded serviceType" }])
    .lean();
  if (!quotation) throw new ApiError(404, "Quotation not found");

  const lead = quotation.leadId;
  const pdfBuffer = await generateQuotationPdf(quotation, lead);

  const filename = `${quotation.quotationId || "quotation"}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(pdfBuffer);
});

// ─── Email Quotation to Client ──────────────────────────────────────────────

/**
 * POST /api/v1/quotations/:id/email
 * Generates a PDF, emails it to the client (lead.email), and logs a note.
 */
const emailQuotationToClient = AsyncHandler(async (req, res) => {
  if (!isMailConfigured()) {
    throw new ApiError(503, "Email sending is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.local");
  }

  const quotation = await Quotation.findById(req.params.id)
    .populate([{ path: "vendorRef", select: "companyName" }, { path: "leadId", select: "clientName company email phone productNeeded serviceType" }])
    .lean();
  if (!quotation) throw new ApiError(404, "Quotation not found");

  const lead = quotation.leadId;
  if (!lead) throw new ApiError(404, "Linked lead not found");
  if (!lead.email) throw new ApiError(400, "This lead has no client email address. Add an email to the lead first.");

  // Generate the PDF
  const pdfBuffer = await generateQuotationPdf(quotation, lead);
  const filename = `${quotation.quotationId || "quotation"}.pdf`;

  // Compose the email
  const subject = `Quotation ${quotation.quotationId || ""} from SourceUp India`;
  const text = [
    `Dear ${lead.clientName || "Client"},`,
    ``,
    `Please find attached the quotation from ${quotation.vendorName || quotation.vendorRef?.companyName || "our vendor"}.`,
    ``,
    `Quotation ID: ${quotation.quotationId || ""}`,
    `Product: ${quotation.product || ""}`,
    `Price: ${quotation.price} ${quotation.currency}`,
    `Valid Until: ${quotation.validity ? new Date(quotation.validity).toLocaleDateString("en-IN") : "—"}`,
    ``,
    `If you have any questions, please don't hesitate to reach out.`,
    ``,
    `Best regards,`,
    `SourceUp India Team`,
  ].join("\n");

  await sendMail({
    to: lead.email,
    subject,
    text,
    attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
  });

  // Log a note on the lead for audit trail
  const noteText = `Quotation ${quotation.quotationId || ""} sent to ${lead.email} on ${new Date().toLocaleString("en-IN")}`;
  await Lead.updateOne(
    { _id: lead._id },
    { $push: { notes: { text: noteText, addedBy: req.user._id } } },
  );

  // Audit log
  await AuditLog.create({
    userId: req.user._id,
    action: "EMAIL_QUOTATION",
    entity: "Quotation",
    entityId: quotation._id,
    newValue: { quotationId: quotation.quotationId, to: lead.email },
  });

  res.status(200).json(new ApiResponse(200, { sentTo: lead.email }, `Quotation emailed to ${lead.email}`));
});

export {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  selectQuotation,
  deleteQuotation,
  downloadQuotationPdf,
  emailQuotationToClient,
};

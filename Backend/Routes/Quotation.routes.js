import { Router } from "express";
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  selectQuotation,
  deleteQuotation,
  downloadQuotationPdf,
  emailQuotationToClient,
} from "../Controllers/Quotation.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";
import { uploadQuotationFile } from "../Middleware/MulterImages.middleware.js";

const router = Router();

// All quotation routes require authentication
router.use(VerifyJWT);

// Read-only routes — accessible by sales, purchase, manager, superadmin
router
  .route("/")
  .get(requireRole("sales", "purchase", "manager", "superadmin"), getQuotations)
  .post(
    requireRole("purchase", "manager", "superadmin"),
    uploadQuotationFile,
    createQuotation,
  );

// POST /:id/select must be declared before /:id to avoid route shadowing
router.post(
  "/:id/select",
  requireRole("purchase", "manager", "superadmin"),
  selectQuotation,
);

// GET /:id/pdf — download branded quotation PDF (all authenticated roles)
router.get(
  "/:id/pdf",
  requireRole("sales", "purchase", "manager", "superadmin"),
  downloadQuotationPdf,
);

// POST /:id/email — email the quotation PDF to the client (all authenticated roles)
router.post(
  "/:id/email",
  requireRole("sales", "purchase", "manager", "superadmin"),
  emailQuotationToClient,
);

router
  .route("/:id")
  .get(requireRole("sales", "purchase", "manager", "superadmin"), getQuotationById)
  .patch(
    requireRole("purchase", "manager", "superadmin"),
    uploadQuotationFile,
    updateQuotation,
  )
  .delete(requireRole("purchase", "manager", "superadmin"), deleteQuotation);

export default router;

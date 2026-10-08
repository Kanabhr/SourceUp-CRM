import { Router } from "express";
import { importPreview, importConfirm } from "../Controllers/LeadImport.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";
import { uploadExcel } from "../Middleware/Multer.middleware.js";

const router = Router();

// Both endpoints require authentication
// Only sales and superadmin can import leads
router.use(VerifyJWT);

// Step 1 — Upload Excel, get AI-verified preview (no DB write)
router.post(
  "/preview",
  requireRole("sales", "superadmin"),
  uploadExcel,
  importPreview,
);

// Step 2 — Confirm and bulk-insert into DB
router.post(
  "/confirm",
  requireRole("sales", "superadmin"),
  importConfirm,
);

export default router;

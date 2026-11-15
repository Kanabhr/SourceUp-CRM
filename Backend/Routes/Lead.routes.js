import { Router } from "express";
import {
  getLeads,
  createLead,
  getLeadById,
  updateLead,
  deleteLead,
  addNote,
  getLeadHistory,
  uploadLeadPhoto,
  removeLeadPhoto,
} from "../Controllers/Lead.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";
import { uploadLeadPhoto as uploadLeadPhotoMiddleware } from "../Middleware/MulterImages.middleware.js";

const router = Router();

// All lead routes require authentication
router.use(VerifyJWT);

router
  .route("/")
  .get(requireRole("sales", "manager", "superadmin"), getLeads)
  .post(requireRole("sales", "manager", "superadmin"), createLead);

router
  .route("/:id")
  .get(requireRole("sales", "manager", "superadmin"), getLeadById)
  .patch(requireRole("sales", "manager", "superadmin"), updateLead)
  .delete(requireRole("superadmin"), deleteLead);

router
  .route("/:id/notes")
  .post(requireRole("sales", "manager", "superadmin"), addNote);

// Reference photo upload / removal (R1)
router
  .route("/:id/photos")
  .post(requireRole("sales", "manager", "superadmin"), uploadLeadPhotoMiddleware, uploadLeadPhoto);

router
  .route("/:id/photos/:index")
  .delete(requireRole("sales", "manager", "superadmin"), removeLeadPhoto);

router
  .route("/:id/history")
  .get(requireRole("manager", "superadmin"), getLeadHistory);

export default router;


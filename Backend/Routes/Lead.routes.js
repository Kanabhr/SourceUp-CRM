import { Router } from "express";
import {
  getLeads,
  createLead,
  getLeadById,
  updateLead,
  deleteLead,
  addNote,
  getLeadHistory,
} from "../Controllers/Lead.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

// All lead routes require authentication
router.use(VerifyJWT);

router
  .route("/")
  .get(requireRole("sales", "manager", "superadmin"), getLeads)
  .post(requireRole("sales", "superadmin"), createLead);

router
  .route("/:id")
  .get(requireRole("sales", "manager", "superadmin"), getLeadById)
  .patch(requireRole("sales", "superadmin"), updateLead)
  .delete(requireRole("superadmin"), deleteLead);

router
  .route("/:id/notes")
  .post(requireRole("sales", "manager", "superadmin"), addNote);

router
  .route("/:id/history")
  .get(requireRole("manager", "superadmin"), getLeadHistory);

export default router;

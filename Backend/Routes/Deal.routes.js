import { Router } from "express";
import {
  createDeal,
  getDeals,
  getDealById,
  updateDeal,
  deleteDeal,
  downloadProformaPdf,
} from "../Controllers/Deal.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

// All deal routes require authentication
router.use(VerifyJWT);

router
  .route("/")
  .get(requireRole("sales", "manager", "superadmin"), getDeals)
  .post(requireRole("sales", "manager", "superadmin"), createDeal);

// GET /:id/pdf — download Proforma Invoice (must be before /:id)
router.get("/:id/pdf", requireRole("sales", "manager", "superadmin"), downloadProformaPdf);

router
  .route("/:id")
  .get(requireRole("sales", "manager", "superadmin"), getDealById)
  .patch(requireRole("sales", "manager", "superadmin"), updateDeal)
  .delete(requireRole("superadmin"), deleteDeal);

export default router;

import { Router } from "express";
import {
  createPO,
  getPOs,
  getPOById,
  updatePO,
  deletePO,
} from "../Controllers/Purchase.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

// All purchase routes require authentication
router.use(VerifyJWT);

router
  .route("/")
  .get(requireRole("sales", "manager", "superadmin", "purchase"), getPOs)
  .post(requireRole("superadmin", "manager"), createPO);

router
  .route("/:id")
  .get(requireRole("sales", "manager", "superadmin", "purchase"), getPOById)
  .patch(requireRole("superadmin", "manager"), updatePO)
  .delete(requireRole("superadmin"), deletePO);

export default router;

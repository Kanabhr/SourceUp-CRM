import { Router } from "express";
import { getSalesReport, getLeadsReport, getCommissionReport } from "../Controllers/Reports.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

router.get(
  "/sales",
  VerifyJWT,
  requireRole("manager", "superadmin"),
  getSalesReport,
);

router.get(
  "/leads",
  VerifyJWT,
  requireRole("manager", "superadmin"),
  getLeadsReport,
);

router.get(
  "/commission",
  VerifyJWT,
  requireRole("manager", "superadmin"),
  getCommissionReport,
);

export default router;

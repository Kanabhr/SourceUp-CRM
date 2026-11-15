import { Router } from "express";
import { getDashboard } from "../Controllers/Dashboard.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

router.get(
  "/",
  VerifyJWT,
  requireRole("manager", "superadmin"),
  getDashboard,
);

export default router;

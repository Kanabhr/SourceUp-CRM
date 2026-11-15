import { Router } from "express";
import { exportData } from "../Controllers/Export.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

// GET /api/v1/export  — superadmin only
router.get("/", VerifyJWT, requireRole("superadmin"), exportData);

export default router;

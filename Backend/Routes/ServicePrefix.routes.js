import { Router } from "express";
import {
  listPrefixes,
  createPrefix,
  updatePrefix,
  deletePrefix,
  togglePrefix,
} from "../Controllers/ServicePrefix.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

// All routes require authentication and superadmin role
router.use(VerifyJWT, requireRole("superadmin"));

// POST /:id/toggle must be declared before /:id to prevent route shadowing
router.post("/:id/toggle", togglePrefix);

router.route("/").get(listPrefixes).post(createPrefix);

router.route("/:id").patch(updatePrefix).delete(deletePrefix);

export default router;

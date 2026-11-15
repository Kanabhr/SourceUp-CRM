import { Router } from "express";
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  searchVendors,
} from "../Controllers/Vendor.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

// Protect all vendor routes with JWT auth
router.use(VerifyJWT);

router.get("/search", requireRole("sales", "manager", "superadmin"), searchVendors);

router
  .route("/")
  .get(requireRole("sales", "manager", "superadmin"), getVendors)
  .post(requireRole("sales", "manager", "superadmin"), createVendor);

router
  .route("/:id")
  .get(requireRole("sales", "manager", "superadmin"), getVendorById)
  .patch(requireRole("manager", "superadmin"), updateVendor)
  .delete(requireRole("superadmin"), deleteVendor);

export default router;

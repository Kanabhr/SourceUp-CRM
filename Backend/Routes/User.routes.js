import { Router } from "express";
import { createUser, getUsers } from "../Controllers/User.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

router
  .route("/")
  .post(VerifyJWT, requireRole("superadmin"), createUser)
  .get(VerifyJWT, requireRole("superadmin", "manager"), getUsers);

export default router;

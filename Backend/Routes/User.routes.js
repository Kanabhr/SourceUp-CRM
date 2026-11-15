import { Router } from "express";
import { createUser, getUsers, updateUser } from "../Controllers/User.controller.js";
import { VerifyJWT, requireRole } from "../Middleware/Auth.middleware.js";

const router = Router();

router
  .route("/")
  .post(VerifyJWT, requireRole("superadmin"), createUser)
  .get(VerifyJWT, requireRole("superadmin", "manager"), getUsers);

router
  .route("/:id")
  .patch(VerifyJWT, requireRole("superadmin"), updateUser);

export default router;

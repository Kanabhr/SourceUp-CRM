import { Router } from "express";
import { register, login, logout, getCurrentUser } from "../Controllers/Auth.controller.js";
import { VerifyJWT } from "../Middleware/Auth.middleware.js";

const router = Router();

router.route("/register").post(register);
router.route("/login").post(login);
router.route("/logout").post(VerifyJWT, logout);
router.route("/me").get(VerifyJWT, getCurrentUser);

export default router;

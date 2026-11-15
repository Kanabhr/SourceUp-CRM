import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, logout, getCurrentUser, refreshAccessToken } from "../Controllers/Auth.controller.js";
import { VerifyJWT } from "../Middleware/Auth.middleware.js";

const router = Router();

// 10 attempts per IP per 15 minutes on login and register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again in 15 minutes." },
});

router.route("/register").post(authLimiter, register);
router.route("/login").post(authLimiter, login);
router.route("/refresh").post(refreshAccessToken);
router.route("/logout").post(VerifyJWT, logout);
router.route("/me").get(VerifyJWT, getCurrentUser);

export default router;

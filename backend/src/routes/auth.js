import { Router } from "express";
import {
  register,
  login,
  getMe,
  requestOtp,
  verifyOtp,
  setPassword,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import {
  validateRegister,
  validateLogin,
  validateRequestOtp,
  validateVerifyOtp,
  validateSetPassword,
} from "../middleware/validate.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.post("/register", rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }), validateRegister, register);
router.post("/login", rateLimit({ max: 10, windowMs: 15 * 60 * 1000 }), validateLogin, login);
router.get("/me", authenticate, getMe);

// Account activation / set password (admin-created offline students)
router.post(
  "/request-otp",
  rateLimit({ max: 3, windowMs: 15 * 60 * 1000 }),
  validateRequestOtp,
  requestOtp
);
router.post(
  "/verify-otp",
  rateLimit({ max: 10, windowMs: 15 * 60 * 1000 }),
  validateVerifyOtp,
  verifyOtp
);
router.post(
  "/set-password",
  rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }),
  validateSetPassword,
  setPassword
);

export default router;

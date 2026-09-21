import { Router } from "express";
import { register, login, getMe } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { validateRegister, validateLogin } from "../middleware/validate.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.post("/register", rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }), validateRegister, register);
router.post("/login", rateLimit({ max: 10, windowMs: 15 * 60 * 1000 }), validateLogin, login);
router.get("/me", authenticate, getMe);

export default router;

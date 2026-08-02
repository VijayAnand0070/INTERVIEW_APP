import { Router } from "express";
import { login, register } from "../controllers/auth.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody } from "../middleware/validation.js";
import { registerSchema, loginSchema } from "../schemas/schemas.js";

const router = Router();

router.post("/register", validateBody(registerSchema), asyncHandler(register));
router.post("/login", validateBody(loginSchema), asyncHandler(login));

export default router;

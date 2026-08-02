import { Router } from "express";
import { getLatestAtsScore, scoreResume } from "../controllers/ats.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody, validateParams } from "../middleware/validation.js";
import { scoreResumeSchema, atsScoreParamsSchema } from "../schemas/schemas.js";

const router = Router();

router.post("/score", requireAuth, validateBody(scoreResumeSchema), asyncHandler(scoreResume));
router.get("/score/:resumeId", requireAuth, validateParams(atsScoreParamsSchema), asyncHandler(getLatestAtsScore));

export default router;

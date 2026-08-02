import { Router } from "express";
import {
  answerQuestion,
  answerQuestionText,
  getInterviewResult,
  getInterviewSession,
  joinInterviewSession,
  startInterview,
  transcribePreview,
} from "../controllers/interview.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { audioUpload } from "../middleware/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody, validateParams } from "../middleware/validation.js";
import {
  startInterviewSchema,
  answerQuestionSchema,
  textAnswerSchema,
  sessionParamsSchema,
} from "../schemas/schemas.js";

const router = Router();

router.post("/start", requireAuth, validateBody(startInterviewSchema), asyncHandler(startInterview));
router.post("/transcribe-preview", requireAuth, audioUpload, asyncHandler(transcribePreview));
router.post("/answer", requireAuth, audioUpload, validateBody(answerQuestionSchema), asyncHandler(answerQuestion));
router.post("/text-answer", requireAuth, validateBody(textAnswerSchema), asyncHandler(answerQuestionText));
router.get("/session/:id", requireAuth, validateParams(sessionParamsSchema), asyncHandler(getInterviewSession));
router.post("/session/:id/join", requireAuth, validateParams(sessionParamsSchema), asyncHandler(joinInterviewSession));
router.get("/result/:id", requireAuth, validateParams(sessionParamsSchema), asyncHandler(getInterviewResult));

export default router;

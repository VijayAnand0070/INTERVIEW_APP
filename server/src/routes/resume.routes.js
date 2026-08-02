import { Router } from "express";
import { listResumes, uploadResume } from "../controllers/resume.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { resumeUpload } from "../middleware/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(listResumes));
// Resume upload validates via multer; jobRole and jobDescription are validated in the controller
router.post("/upload", requireAuth, resumeUpload, asyncHandler(uploadResume));

export default router;

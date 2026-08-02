import { Router } from "express";
import { aiService } from "../services/ai.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/readiness",
  asyncHandler(async (_req, res) => {
    const readiness = await aiService.readiness();
    res.json(readiness);
  })
);

router.get(
  "/models",
  asyncHandler(async (_req, res) => {
    const models = await aiService.models();
    res.json(models);
  })
);

export default router;

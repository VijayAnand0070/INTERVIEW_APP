/**
 * Zod validation schemas for all API endpoints.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Common refinements                                                 */
/* ------------------------------------------------------------------ */
const uuid = z.string().uuid("Must be a valid UUID");

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */
export const registerSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
  fullName: z.string().max(120).optional().default(""),
});

export const loginSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required").max(128),
});

/* ------------------------------------------------------------------ */
/*  Resume                                                             */
/* ------------------------------------------------------------------ */
export const uploadResumeSchema = z.object({
  jobRole: z.string().min(1, "Job role is required").max(120),
  jobDescription: z.string().min(1, "Job description is required").max(10000),
});

/* ------------------------------------------------------------------ */
/*  ATS                                                                */
/* ------------------------------------------------------------------ */
export const scoreResumeSchema = z.object({
  resumeId: uuid,
});

export const atsScoreParamsSchema = z.object({
  resumeId: uuid,
});

/* ------------------------------------------------------------------ */
/*  Interview                                                          */
/* ------------------------------------------------------------------ */
export const startInterviewSchema = z.object({
  resumeId: uuid,
  atsScoreId: uuid.optional(),
  interviewRole: z.string().max(120).optional(),
  questionCount: z
    .union([z.number(), z.string().transform(Number)])
    .pipe(z.number().int().min(3).max(12))
    .optional(),
});

export const answerQuestionSchema = z.object({
  sessionId: uuid,
  questionIndex: z
    .union([z.number(), z.string().transform(Number)])
    .pipe(z.number().int().min(0))
    .optional(),
});

export const textAnswerSchema = z.object({
  sessionId: uuid,
  questionIndex: z
    .union([z.number(), z.string().transform(Number)])
    .pipe(z.number().int().min(0))
    .optional(),
  transcription: z
    .string()
    .min(1, "Transcription text is required")
    .max(10000, "Transcription is too long"),
});

export const sessionParamsSchema = z.object({
  id: uuid,
});

/* ------------------------------------------------------------------ */
/*  WebSocket payloads                                                 */
/* ------------------------------------------------------------------ */
export const wsStartSchema = z.object({
  resumeId: uuid,
  atsScoreId: uuid.optional(),
  interviewRole: z.string().max(120).optional(),
  questionCount: z
    .union([z.number(), z.string().transform(Number)])
    .pipe(z.number().int().min(3).max(12))
    .optional(),
});

export const wsTextAnswerSchema = z.object({
  sessionId: uuid,
  questionIndex: z
    .union([z.number(), z.string().transform(Number)])
    .pipe(z.number().int().min(0))
    .optional(),
  transcription: z.string().min(1).max(10000),
});

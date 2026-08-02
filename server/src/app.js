import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { logger, requestLogger } from "./config/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { supabaseAdmin } from "./config/supabase.js";
import aiRoutes from "./routes/ai.routes.js";
import authRoutes from "./routes/auth.routes.js";
import atsRoutes from "./routes/ats.routes.js";
import interviewRoutes from "./routes/interview.routes.js";
import resumeRoutes from "./routes/resume.routes.js";

const app = express();

/* ------------------------------------------------------------------ */
/*  Security headers                                                   */
/* ------------------------------------------------------------------ */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Allow frontend to load resources
  })
);

/* ------------------------------------------------------------------ */
/*  CORS — configurable allowlist                                      */
/* ------------------------------------------------------------------ */
const allowedOrigins = (env.clientUrl || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

/* ------------------------------------------------------------------ */
/*  Rate limiting                                                      */
/* ------------------------------------------------------------------ */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts, please try again later." },
});

const interviewStartLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many interview starts, please try again later." },
});

app.use(generalLimiter);

/* ------------------------------------------------------------------ */
/*  Body parsing                                                       */
/* ------------------------------------------------------------------ */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* ------------------------------------------------------------------ */
/*  Request logging with request ID                                    */
/* ------------------------------------------------------------------ */
app.use(requestLogger);

/* ------------------------------------------------------------------ */
/*  Health check (unprotected)                                         */
/* ------------------------------------------------------------------ */
app.get("/health", async (_req, res) => {
  let supabase = "ok";
  let supabaseError;

  try {
    const { error } = await supabaseAdmin.from("profiles").select("id").limit(1);
    if (error) {
      supabase = "error";
      supabaseError = error.message;
    }
  } catch (error) {
    supabase = "error";
    supabaseError = error.message;
  }

  const healthy = supabase === "ok";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "interview_agent-api",
    supabase,
    ...(supabaseError ? { supabaseError } : {}),
    timestamp: new Date().toISOString(),
  });
});

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/ats", atsRoutes);

// Apply stricter rate limit specifically to interview start before the router handles it.
app.use("/api/interview/start", interviewStartLimiter);
app.use("/api/interview", interviewRoutes);

/* ------------------------------------------------------------------ */
/*  404 and error handler                                              */
/* ------------------------------------------------------------------ */
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

export default app;

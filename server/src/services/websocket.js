/**
 * WebSocket real-time interview engine using Socket.IO.
 */
import { Server } from "socket.io";
import { supabaseAdmin } from "../config/supabase.js";
import { verifyAuthToken } from "../lib/verifyAuthToken.js";
import { logger } from "../config/logger.js";
import { wsStartSchema, wsTextAnswerSchema } from "../schemas/schemas.js";
import {
  getResume,
  getAtsScore,
  getSession,
  createSession,
  candidateNameFromResume,
} from "../services/interviewSession.service.js";
import { normalizeQuestions, clampQuestionCount, generateInterviewQuestions } from "../services/question.service.js";
import { ensureQuestionAudio, prewarmQuestionAudio } from "../services/tts.service.js";
import { jobQueue } from "../services/jobQueue.js";
import { getSessionMetrics } from "./metrics.service.js";
import { processTextAnswer } from "./interviewFlow.service.js";
import { buildJoinPayload } from "./interviewJoin.service.js";

let io = null;

async function buildSessionContext(session, userId, user) {
  const resume = await getResume(session.resume_id, userId);
  const atsScore = await getAtsScore(session.ats_score_id, session.resume_id, userId);
  const candidateName = candidateNameFromResume(resume, user);
  const resumeScore = Math.round(Number(atsScore?.score ?? 0));

  return {
    sessionId: session.id,
    candidateName,
    interviewRole: session.job_role || "Pending",
    resumeScore,
    sessionStatus: session.status,
    questionIndex: session.current_question_index,
    totalQuestions: normalizeQuestions(session.questions_json).length,
    userEmail: user?.email || "",
    userAvatarUrl: user?.user_metadata?.avatar_url || null,
  };
}

function warmQuestionAudioInBackground(socket, session, questionIndex, openingMessage) {
  if (process.env.PREWARM_TTS !== "true") return;

  setImmediate(async () => {
    try {
      const warmed = await ensureQuestionAudio(session, questionIndex, { openingMessage });
      if (warmed.audio.ttsAudioUrl) {
        socket.emit("interview:ttsReady", {
          sessionId: session.id,
          questionIndex,
          ttsAudioUrl: warmed.audio.ttsAudioUrl,
          ttsProvider: warmed.audio.ttsProvider,
        });
      }
      prewarmQuestionAudio(warmed.session, questionIndex + 1);
    } catch (error) {
      logger.warn({
        msg: "Background TTS warm failed",
        sessionId: session.id,
        questionIndex,
        error: error.message,
      });
    }
  });
}

export function createWebSocketServer(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    maxHttpBufferSize: 50 * 1024 * 1024,
    pingTimeout: 120000,
    pingInterval: 25000,
  });

  const interviewNs = io.of("/interview");

  interviewNs.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("Authentication required"));

      const { user, error } = await verifyAuthToken(token);
      if (!user) return next(new Error(error || "Invalid or expired token"));

      socket.user = user;
      socket.userId = user.id;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  interviewNs.on("connection", (socket) => {
    socket.on("interview:start", (payload) => handleStart(socket, payload));
    socket.on("interview:join", (payload) => handleJoin(socket, payload));
    socket.on("interview:audioData", (payload) => handleAudioData(socket, payload));
    socket.on("interview:audioEnd", (payload) => handleAudioEnd(socket, payload));
    socket.on("interview:textAnswer", (payload) => handleTextAnswer(socket, payload));
    socket.on("interview:getMetrics", (payload) => handleGetMetrics(socket, payload));

    socket.on("disconnect", (reason) => {
      logger.info({ msg: "WS disconnected", userId: socket.userId, reason });
    });
  });

  jobQueue.on("job:progress", ({ sessionId, ...progress }) => {
    if (sessionId) {
      interviewNs.to(`session:${sessionId}`).emit("interview:evaluating", progress);
    }
  });

  jobQueue.on("job:completed", ({ jobType, result }) => {
    if (jobType === "generate_report" && result?.session_id) {
      interviewNs.to(`session:${result.session_id}`).emit("interview:reportReady", {
        sessionId: result.session_id,
        reportId: result.id,
        overallScore: result.overall_score,
      });
    }
  });

  logger.info({ msg: "WebSocket server initialized", namespace: "/interview" });
  return io;
}

async function handleStart(socket, payload) {
  try {
    const parsed = wsStartSchema.parse(payload);
    const userId = socket.userId;

    socket.emit("interview:speaking", { status: "preparing", message: "Setting up your interview…" });

    const resume = await getResume(parsed.resumeId, userId);
    const atsScore = await getAtsScore(parsed.atsScoreId, parsed.resumeId, userId);
    const candidateName = candidateNameFromResume(resume, socket.user);
    const selectedCount = clampQuestionCount(parsed.questionCount);

    const interviewRole = resume.job_role || "Software Developer";
    const generatedQuestions = await generateInterviewQuestions({
      parsedResume: resume.parsed_json,
      jobRole: interviewRole,
      jobDescription: resume.job_description,
      atsScore,
      questionCount: selectedCount,
      candidateName,
    });

    const openingMessage =
      `Hi ${candidateName}! I'm Sarah, your AI interviewer today. ` +
      `I've reviewed your resume and prepared a Groq-powered ${interviewRole} interview for you.`;

    const session = await createSession({
      userId,
      resumeId: resume.id,
      atsScoreId: atsScore?.id,
      jobRole: interviewRole,
      questions: generatedQuestions,
    });

    socket.join(`session:${session.id}`);
    socket.sessionId = session.id;

    const questions = normalizeQuestions(session.questions_json);
    socket.emit("interview:sessionContext", await buildSessionContext(session, userId, socket.user));

    socket.emit("interview:question", {
      sessionId: session.id,
      question: questions[0],
      questionIndex: 0,
      totalQuestions: questions.length,
      candidateName,
      interviewRole,
      openingMessage,
      ttsAudioUrl: null,
      ttsProvider: "browser_fallback",
    });
  } catch (error) {
    logger.error({ msg: "WS start error", userId: socket.userId, error: error.message });
    socket.emit("interview:error", { message: error.message || "Failed to start interview" });
  }
}

async function handleAudioData(socket) {
  socket.emit("interview:error", {
    message: "Server speech transcription is disabled. Please submit browser-recognized or typed text.",
  });
}

async function handleAudioEnd(socket) {
  socket.emit("interview:error", {
    message: "Server speech transcription is disabled. Please submit browser-recognized or typed text.",
  });
}

async function handleTextAnswer(socket, payload) {
  try {
    const parsed = wsTextAnswerSchema.parse(payload);
    await processTextAnswer(socket, {
      sessionId: parsed.sessionId,
      userId: socket.userId,
      questionIndex: parsed.questionIndex,
      transcription: parsed.transcription.trim(),
    });
  } catch (error) {
    logger.error({ msg: "WS textAnswer error", userId: socket.userId, error: error.message });
    socket.emit("interview:error", { message: error.message || "Failed to process text answer" });
  }
}

async function handleGetMetrics(socket, { sessionId }) {
  try {
    const metrics = await getSessionMetrics(sessionId, socket.userId);
    socket.emit("interview:metrics", metrics);
  } catch (error) {
    logger.error({ msg: "WS metrics error", userId: socket.userId, error: error.message });
  }
}

async function handleJoin(socket, { sessionId }) {
  try {
    if (!sessionId) {
      socket.emit("interview:error", { message: "Session id is required" });
      return;
    }

    socket.join(`session:${sessionId}`);
    socket.sessionId = sessionId;

    const payload = await buildJoinPayload(sessionId, socket.userId, socket.user);

    if (payload.completed) {
      socket.emit("interview:reportReady", { sessionId });
      return;
    }

    if (payload.evaluating) {
      socket.emit("interview:sessionContext", payload.sessionContext);
      socket.emit("interview:evaluating", {
        status: "started",
        message: payload.message || "Sarah is preparing your final interview evaluation.",
      });
      return;
    }

    socket.emit("interview:sessionContext", payload.sessionContext);
    socket.emit("interview:question", payload.question);

    if (!payload.question.ttsAudioUrl) {
      const session = await getSession(sessionId, socket.userId);
      warmQuestionAudioInBackground(
        socket,
        session,
        payload.question.questionIndex,
        payload.question.openingMessage
      );
    }

    logger.info({
      msg: "WS join complete",
      sessionId,
      userId: socket.userId,
      questionIndex: payload.question.questionIndex,
    });
  } catch (error) {
    logger.error({ msg: "WS join error", userId: socket.userId, error: error.message });
    socket.emit("interview:error", { message: error.message || "Failed to join session" });
  }
}

export { io };

/**
 * Interview Controller — Thin layer delegating to services.
 * Handles HTTP request/response shaping only.
 */
import { ApiError } from "../utils/errors.js";
import { removeLocalFile } from "../services/storage.service.js";
import { normalizeQuestions, clampQuestionCount, generateInterviewQuestions } from "../services/question.service.js";
import {
  getSession,
  getResume,
  getAtsScore,
  getEvaluationContext,
  createSession,
  advanceQuestionIndex,
  candidateNameFromResume,
  buildOpeningMessage,
} from "../services/interviewSession.service.js";
import { ensureQuestionAudio, prewarmQuestionAudio, signedAudioFromQuestion } from "../services/tts.service.js";
import { saveAnswer, processAudioAnswer } from "../services/answer.service.js";
import { aiService } from "../services/ai.service.js";
import { generateFinalReport } from "../services/report.service.js";
import { getSessionAnswers } from "../services/answer.service.js";
import { getReport } from "../services/report.service.js";
import { buildJoinPayload } from "../services/interviewJoin.service.js";
import { processTextAnswer } from "../services/interviewFlow.service.js";
import { notFound } from "../utils/errors.js";

/* ------------------------------------------------------------------ */
/*  Response shaping                                                   */
/* ------------------------------------------------------------------ */
function shapeSessionResponse(session, audio = {}, meta = {}) {
  const questions = normalizeQuestions(session.questions_json);
  const questionIndex = session.current_question_index;
  const candidateName = meta.candidateName || "Candidate";
  const interviewRole = session.job_role || meta.interviewRole || "Software Developer";

  return {
    session,
    question: questions[questionIndex],
    questions,
    questionIndex,
    totalQuestions: questions.length,
    candidateName,
    interviewRole,
    openingMessage:
      meta.openingMessage ||
      buildOpeningMessage({ candidateName, jobRole: interviewRole, questionCount: questions.length }),
    ...audio,
  };
}

/* ------------------------------------------------------------------ */
/*  POST /api/interview/start                                          */
/* ------------------------------------------------------------------ */
export async function startInterview(req, res) {
  const userId = req.user.id;
  const { resumeId, atsScoreId, questionCount } = req.body;

  const resume = await getResume(resumeId, userId);
  const atsScore = await getAtsScore(atsScoreId, resumeId, userId);
  const selectedQuestionCount = clampQuestionCount(questionCount);
  const candidateName = candidateNameFromResume(resume, req.user);

  const interviewRole = resume.job_role || "Software Developer";
  const generatedQuestions = await generateInterviewQuestions({
    parsedResume: resume.parsed_json,
    jobRole: interviewRole,
    jobDescription: resume.job_description,
    atsScore,
    questionCount: selectedQuestionCount,
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

  res.status(201).json(
    shapeSessionResponse(session, {}, {
      candidateName,
      interviewRole,
      openingMessage,
    })
  );
}

/* ------------------------------------------------------------------ */
/*  GET /api/interview/session/:id                                     */
/* ------------------------------------------------------------------ */
export async function getInterviewSession(req, res) {
  const userId = req.user.id;
  const session = await getSession(req.params.id, userId);
  const resume = await getResume(session.resume_id, userId);
  const atsScore = await getAtsScore(session.ats_score_id, session.resume_id, userId);
  const candidateName = candidateNameFromResume(resume, req.user);
  const resumeScore = Math.round(Number(atsScore?.score ?? 0));
  const questions = normalizeQuestions(session.questions_json);
  const openingMessage = buildOpeningMessage({
    candidateName,
    jobRole: session.job_role,
    questionCount: questions.length,
  });

  if (session.status === "completed") {
    res.json({
      session,
      completed: true,
      candidateName,
      interviewRole: session.job_role,
      resumeScore,
    });
    return;
  }

  if (session.status === "evaluating") {
    res.json({
      session,
      completed: false,
      evaluating: true,
      questions,
      questionIndex: Math.max(0, Math.min(session.current_question_index, Math.max(questions.length - 1, 0))),
      totalQuestions: questions.length,
      candidateName,
      interviewRole: session.job_role,
      resumeScore,
      message: "Sarah is preparing your final interview evaluation.",
    });
    return;
  }

  res.json({
    session,
    questions,
    questionIndex: session.current_question_index,
    totalQuestions: questions.length,
    candidateName,
    interviewRole: session.job_role,
    openingMessage,
    resumeScore,
    completed: false,
  });
}

/* ------------------------------------------------------------------ */
/*  POST /api/interview/session/:id/join  (REST fallback for WebSocket)  */
/* ------------------------------------------------------------------ */
export async function joinInterviewSession(req, res) {
  const userId = req.user.id;
  const sessionId = req.params.id;
  const payload = await buildJoinPayload(sessionId, userId, req.user);

  if (payload.completed) {
    res.json({ completed: true, sessionId });
    return;
  }

  res.json(payload);
}

/* ------------------------------------------------------------------ */
/*  POST /api/interview/transcribe-preview                             */
/* ------------------------------------------------------------------ */
export async function transcribePreview(req, res) {
  try {
    throw new ApiError(
      410,
      "Server speech transcription is disabled. The interview uses browser SpeechRecognition and typed text only."
    );
  } finally {
    if (req.file?.path) await removeLocalFile(req.file.path);
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/interview/answer  (audio file upload)                    */
/* ------------------------------------------------------------------ */
export async function answerQuestion(req, res) {
  try {
    throw new ApiError(
      410,
      "Audio answer upload is disabled. Submit browser-recognized or typed text instead."
    );
  } finally {
    if (req.file?.path) await removeLocalFile(req.file.path);
  }
}

export async function legacyAnswerQuestion(req, res) {
  if (!req.file) throw new ApiError(400, "Audio answer is required");

  try {
    const speechResult = await aiService.speechToText(req.file);
    res.json({
      transcription: speechResult.transcription || speechResult.text || speechResult.transcript || "",
      provider: speechResult.provider || "groq",
      model: speechResult.model,
    });
  } finally {
    await removeLocalFile(req.file.path);
  }
}

export async function legacyFullAnswerQuestion(req, res) {
  const userId = req.user.id;
  const { sessionId, questionIndex } = req.body;

  if (!req.file) throw new ApiError(400, "Audio answer is required");

  try {
    const session = await getSession(sessionId, userId);
    if (session.status !== "in_progress") {
      throw new ApiError(400, "Interview session is already completed");
    }

    const questions = normalizeQuestions(session.questions_json);
    const index = Number(questionIndex ?? session.current_question_index);

    if (index !== session.current_question_index) {
      throw new ApiError(409, "Answer does not match the current question");
    }

    // Upload audio + transcribe in parallel
    const { storedAudioPath, transcription } = await processAudioAnswer({
      file: req.file,
      userId,
      sessionId,
      questionIndex: index,
    });

    // Save answer with idempotency
    await saveAnswer({
      sessionId,
      userId,
      questionIndex: index,
      questionObj: questions[index],
      transcription,
      audioPath: storedAudioPath,
    });

    const { resume } = await getEvaluationContext(session, userId);
    const candidateName = candidateNameFromResume(resume, req.user);
    const openingMessage = buildOpeningMessage({
      candidateName,
      jobRole: session.job_role,
      questionCount: questions.length,
    });

    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      // Final answer — trigger report generation
      const finalReport = await generateFinalReport({ session, userId });
      res.json({
        completed: true,
        transcription,
        evaluation: null,
        stored: true,
        finalReport,
        candidateName,
        interviewRole: session.job_role,
      });
      return;
    }

    // Atomically advance to next question
    const updatedSession = await advanceQuestionIndex(sessionId, userId, index);

    const nextQuestions = normalizeQuestions(updatedSession.questions_json);
    const audio = await signedAudioFromQuestion(nextQuestions[nextIndex]);
    if (!audio.ttsAudioUrl) {
      prewarmQuestionAudio(updatedSession, nextIndex);
    }

    res.json({
      ...shapeSessionResponse(updatedSession, audio, {
        candidateName,
        interviewRole: session.job_role,
        openingMessage,
      }),
      transcription,
      evaluation: null,
      stored: true,
      completed: false,
    });
  } finally {
    await removeLocalFile(req.file.path);
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/interview/text-answer                                    */
/* ------------------------------------------------------------------ */
export async function answerQuestionText(req, res) {
  const userId = req.user.id;
  const { sessionId, questionIndex, transcription } = req.body;
  const cleanTranscription = String(transcription).trim();

  const events = [];
  const stubSocket = {
    userId,
    user: req.user,
    emit(event, payload) {
      events.push({ event, payload });
    },
  };

  await processTextAnswer(stubSocket, {
    sessionId,
    userId,
    questionIndex,
    transcription: cleanTranscription,
  });

  const reportReady = events.find((e) => e.event === "interview:reportReady");
  if (reportReady) {
    res.json({
      completed: true,
      transcription: cleanTranscription,
      stored: true,
      finalReport: reportReady.payload.finalReport,
      overallScore: reportReady.payload.overallScore,
    });
    return;
  }

  const err = events.find((e) => e.event === "interview:error");
  if (err) {
    throw new ApiError(400, err.payload.message || "Failed to process answer");
  }

  const question = events.find((e) => e.event === "interview:question");
  const ctx = events.find((e) => e.event === "interview:sessionContext");
  const roleConfirmed = events.find((e) => e.event === "interview:roleConfirmed");
  const answerEvaluated = events.find((e) => e.event === "interview:answerEvaluated");
  const metrics = events.find((e) => e.event === "interview:metrics");

  res.json({
    completed: false,
    transcription: cleanTranscription,
    stored: true,
    evaluation: answerEvaluated?.payload,
    metrics: metrics?.payload,
    sessionContext: ctx?.payload,
    question: question?.payload,
    roleConfirmed: roleConfirmed?.payload?.role,
    preparing: events.some((e) => e.event === "interview:speaking" && e.payload?.status === "preparing"),
  });
}

/* ------------------------------------------------------------------ */
/*  GET /api/interview/result/:id                                      */
/* ------------------------------------------------------------------ */
export async function getInterviewResult(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const [finalReport, answers] = await Promise.all([
    getReport(id, userId),
    getSessionAnswers(id, userId),
  ]);

  if (!finalReport) throw notFound("Final report not found");

  res.json({ finalReport, answers });
}

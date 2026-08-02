/**
 * Answer Service
 * Handles answer persistence, transcription, evaluation, and duplicate protection.
 */
import { supabaseAdmin } from "../config/supabase.js";
import { aiService } from "./ai.service.js";
import { normalizeQuestions, questionText } from "./question.service.js";
import { uploadLocalFile } from "./storage.service.js";
import { logger } from "../config/logger.js";
import { safeFileName } from "../utils/fileNames.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/* ------------------------------------------------------------------ */
/*  Save answer with idempotency                                       */
/* ------------------------------------------------------------------ */
export async function saveAnswer({ sessionId, userId, questionIndex, questionObj, transcription, audioPath }) {
  const record = {
    session_id: sessionId,
    user_id: userId,
    question_index: questionIndex,
    question_text: questionText(questionObj),
    audio_path: audioPath || null,
    transcription: transcription || "",
    evaluation_json: {},
    score: 0,
  };

  const { data, error } = await supabaseAdmin
    .from("interview_answers")
    .upsert(record, { onConflict: "session_id,question_index" })
    .select("*")
    .single();

  if (error) throw error;

  logger.info({
    msg: "Answer saved",
    sessionId,
    questionIndex,
    transcriptionLength: (transcription || "").length,
    hasAudio: !!audioPath,
  });

  return data;
}

/* ------------------------------------------------------------------ */
/*  Upload audio and transcribe in parallel                            */
/* ------------------------------------------------------------------ */
export async function processAudioAnswer({ file, userId, sessionId, questionIndex }) {
  throw Object.assign(
    new Error("Audio answer processing is disabled. Submit browser-recognized or typed text instead."),
    { code: "SERVER_STT_DISABLED" }
  );

  const audioPath = `${userId}/${sessionId}/answer-${questionIndex}-${safeFileName(file.originalname)}`;

  const [storedAudioPath, speechResult] = await Promise.all([
    uploadLocalFile({
      bucket: "user-audio",
      filePath: file.path,
      destination: audioPath,
      contentType: file.mimetype,
    }),
    aiService.speechToText(file),
  ]);

  const transcription =
    speechResult.transcription || speechResult.text || speechResult.transcript || "";

  return { storedAudioPath, transcription };
}

/* ------------------------------------------------------------------ */
/*  Evaluate a single answer                                           */
/* ------------------------------------------------------------------ */
export async function evaluateSingleAnswer({ answer, session, resume, atsScore }) {
  const questions = normalizeQuestions(session.questions_json);
  const question = questions[answer.question_index] || answer.question_text;

  try {
    const evaluation = await aiService.evaluateAnswer({
      question,
      answer: answer.transcription,
      jobRole: session.job_role,
      jobDescription: resume?.job_description || "",
      parsedResume: resume?.parsed_json || {},
      atsScore,
      rubric: [
        "technical correctness",
        "communication clarity",
        "confidence",
        "relevance",
        "problem solving",
        "answer structure",
        "evidence depth",
      ],
    });

    const score = toNumber(evaluation.score ?? evaluation.overall_score);

    const { data, error } = await supabaseAdmin
      .from("interview_answers")
      .update({ evaluation_json: evaluation, score })
      .eq("id", answer.id)
      .eq("user_id", answer.user_id)
      .select("*")
      .single();

    if (error) throw error;

    logger.info({
      msg: "Answer evaluated",
      answerId: answer.id,
      questionIndex: answer.question_index,
      score,
    });

    return data;
  } catch (error) {
    logger.error({ msg: "Answer evaluation failed", answerId: answer.id, error: error.message });
    return answer; // Return unevaluated answer
  }
}

/* ------------------------------------------------------------------ */
/*  Evaluate all answers for a session                                 */
/* ------------------------------------------------------------------ */
export async function evaluateAllAnswers({ session, userId, resume, atsScore }) {
  const { data: answers, error } = await supabaseAdmin
    .from("interview_answers")
    .select("*")
    .eq("session_id", session.id)
    .eq("user_id", userId)
    .order("question_index", { ascending: true });

  if (error) throw error;

  const evaluatedAnswers = [];
  for (const answer of answers) {
    // Skip already-evaluated answers
    const existingEval = answer.evaluation_json || {};
    if (existingEval.score || answer.score > 0) {
      evaluatedAnswers.push(answer);
      continue;
    }

    const evaluated = await evaluateSingleAnswer({ answer, session, resume, atsScore });
    evaluatedAnswers.push(evaluated);
  }

  return evaluatedAnswers;
}

/* ------------------------------------------------------------------ */
/*  Get all answers for a session                                      */
/* ------------------------------------------------------------------ */
export async function getSessionAnswers(sessionId, userId) {
  const { data, error } = await supabaseAdmin
    .from("interview_answers")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("question_index", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Interview Session Service
 * Manages session lifecycle, candidate context, and atomic state transitions.
 */
import { supabaseAdmin } from "../config/supabase.js";
import { logger } from "../config/logger.js";
import { ApiError, notFound } from "../utils/errors.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
export function candidateNameFromResume(resume, user) {
  const parsedName = String(resume?.parsed_json?.name || "").trim();
  if (parsedName) return parsedName.split(/\s+/).slice(0, 1).join(" ");

  const emailName = String(user?.email || "")
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();
  return emailName ? emailName.split(/\s+/)[0] : "Candidate";
}

export function buildOpeningMessage({ candidateName, jobRole, questionCount, resumeHighlight }) {
  const highlight = resumeHighlight
    ? `, especially your work on ${resumeHighlight}`
    : "";
  return (
    `Hi ${candidateName}! I'm Sarah, and I'll be your interviewer today. ` +
    `I've been going through your resume${highlight}, and I'm really excited to chat with you about the ${jobRole} role. ` +
    `We'll have a natural conversation with about ${questionCount} questions covering your technical skills, projects, and experience. ` +
    `Don't worry about being perfect — I just want to understand how you think. Take your time, and let's get started!`
  );
}

/* ------------------------------------------------------------------ */
/*  Data access                                                        */
/* ------------------------------------------------------------------ */
export async function getSession(sessionId, userId) {
  const { data, error } = await supabaseAdmin
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw notFound("Interview session not found");
  return data;
}

export async function getResume(resumeId, userId) {
  const { data, error } = await supabaseAdmin
    .from("resumes")
    .select("*")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw notFound("Resume not found");
  return data;
}

export async function getAtsScore(atsScoreId, resumeId, userId) {
  let query = supabaseAdmin
    .from("ats_scores")
    .select("*")
    .eq("resume_id", resumeId)
    .eq("user_id", userId);

  if (atsScoreId) {
    query = query.eq("id", atsScoreId);
  } else {
    query = query.order("created_at", { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEvaluationContext(session, userId) {
  const [resumeResult, atsResult] = await Promise.all([
    supabaseAdmin
      .from("resumes")
      .select("*")
      .eq("id", session.resume_id)
      .eq("user_id", userId)
      .maybeSingle(),
    session.ats_score_id
      ? supabaseAdmin
          .from("ats_scores")
          .select("*")
          .eq("id", session.ats_score_id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (resumeResult.error) throw resumeResult.error;
  if (atsResult.error) throw atsResult.error;

  return { resume: resumeResult.data, atsScore: atsResult.data };
}

/* ------------------------------------------------------------------ */
/*  Session lifecycle                                                  */
/* ------------------------------------------------------------------ */
export async function createSession({ userId, resumeId, atsScoreId, jobRole, questions }) {
  const { data, error } = await supabaseAdmin
    .from("interview_sessions")
    .insert({
      user_id: userId,
      resume_id: resumeId,
      ats_score_id: atsScoreId ?? null,
      job_role: jobRole,
      questions_json: questions,
      current_question_index: 0,
      status: "in_progress",
    })
    .select("*")
    .single();

  if (error) throw error;
  logger.info({ msg: "Session created", sessionId: data.id, userId, jobRole, questionCount: questions.length });
  return data;
}

/**
 * Atomically advances the question index only if it matches the expected value.
 * Prevents race conditions from duplicate submissions.
 */
export async function advanceQuestionIndex(sessionId, userId, expectedIndex) {
  const { data, error } = await supabaseAdmin
    .from("interview_sessions")
    .update({ current_question_index: expectedIndex + 1 })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("current_question_index", expectedIndex)
    .eq("status", "in_progress")
    .select("*")
    .single();

  if (error) {
    // If no rows matched, it's a race condition or invalid state
    if (error.code === "PGRST116" || error.details?.includes("0 rows")) {
      throw new ApiError(409, "Question already answered or session state changed");
    }
    throw error;
  }
  return data;
}

/**
 * Appends new questions to an existing session's questions array.
 */
export async function appendQuestions(sessionId, userId, newQuestions) {
  const session = await getSession(sessionId, userId);
  const updatedQuestions = [...(session.questions_json || []), ...newQuestions];
  
  const { data, error } = await supabaseAdmin
    .from("interview_sessions")
    .update({ questions_json: updatedQuestions })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Updates the job role for the session.
 */
export async function updateSessionRole(sessionId, userId, jobRole) {
  const { data, error } = await supabaseAdmin
    .from("interview_sessions")
    .update({ job_role: jobRole })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Sets session status to 'evaluating' before final report generation.
 */
export async function markSessionEvaluating(sessionId, userId) {
  const { error } = await supabaseAdmin
    .from("interview_sessions")
    .update({ status: "evaluating" })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "in_progress");

  if (error) logger.warn({ msg: "Could not mark session evaluating", sessionId, error: error.message });
}

/**
 * Completes the session after report generation.
 */
export async function completeSession(sessionId, userId) {
  const { error } = await supabaseAdmin
    .from("interview_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) throw error;
  logger.info({ msg: "Session completed", sessionId, userId });
}

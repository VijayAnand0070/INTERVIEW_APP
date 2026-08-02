/**
 * Shared join payload for WebSocket and REST — fast, no blocking TTS.
 */
import {
  getSession,
  getResume,
  getAtsScore,
  candidateNameFromResume,
} from "./interviewSession.service.js";
import { normalizeQuestions } from "./question.service.js";
import { signedAudioFromQuestion, prewarmQuestionAudio } from "./tts.service.js";

export async function buildJoinPayload(sessionId, userId, user) {
  const session = await getSession(sessionId, userId);
  const resume = await getResume(session.resume_id, userId);
  const atsScore = await getAtsScore(session.ats_score_id, session.resume_id, userId);
  const candidateName = candidateNameFromResume(resume, user);
  const questions = normalizeQuestions(session.questions_json);
  const index = session.current_question_index;

  if (session.status === "evaluating") {
    return {
      completed: false,
      evaluating: true,
      sessionId,
      sessionContext: {
        sessionId,
        candidateName,
        interviewRole: session.job_role || "Pending",
        resumeScore: Math.round(Number(atsScore?.score ?? 0)),
        sessionStatus: session.status,
        questionIndex: Math.max(0, Math.min(index, Math.max(questions.length - 1, 0))),
        totalQuestions: questions.length,
        userEmail: user?.email || "",
        userAvatarUrl: user?.user_metadata?.avatar_url || null,
      },
      message: "Sarah is preparing your final interview evaluation.",
    };
  }

  if (index >= questions.length || session.status === "completed") {
    return { completed: true, sessionId };
  }

  const openingMessage =
    index === 0
      ? `Hi ${candidateName}! I'm Sarah. Please tell me which role you're interviewing for today.`
      : "";

  const cached = await signedAudioFromQuestion(questions[index]);
  prewarmQuestionAudio(session, index + 1);

  return {
    completed: false,
    sessionContext: {
      sessionId,
      candidateName,
      interviewRole: session.job_role || "Pending",
      resumeScore: Math.round(Number(atsScore?.score ?? 0)),
      sessionStatus: session.status,
      questionIndex: index,
      totalQuestions: questions.length,
      userEmail: user?.email || "",
      userAvatarUrl: user?.user_metadata?.avatar_url || null,
    },
    question: {
      sessionId,
      question: questions[index],
      questionIndex: index,
      totalQuestions: questions.length,
      candidateName,
      interviewRole: session.job_role,
      openingMessage,
      ttsAudioUrl: cached.ttsAudioUrl,
      ttsProvider: cached.ttsProvider,
    },
  };
}

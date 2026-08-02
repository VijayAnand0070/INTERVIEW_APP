/**
 * Shared interview answer processing for REST and WebSocket paths.
 */
import {
  getEvaluationContext,
  advanceQuestionIndex,
  appendQuestions,
  updateSessionRole,
  getResume,
  candidateNameFromResume,
} from "./interviewSession.service.js";
import {
  normalizeQuestions,
  generateInterviewQuestions,
} from "./question.service.js";
import { ensureQuestionAudio, prewarmQuestionAudio, signedAudioFromQuestion } from "./tts.service.js";
import { saveAnswer } from "./answer.service.js";
import { generateFinalReport } from "./report.service.js";
import { getSession } from "./interviewSession.service.js";
import {
  extractInterviewRole,
  getPlannedQuestionCount,
  isRoleSelectionQuestion,
} from "../utils/roleSelection.js";
import { logger } from "../config/logger.js";

const answerLocks = new Map();

function answerLockKey(sessionId, questionIndex) {
  return `${sessionId}:${questionIndex}`;
}

export async function maybeGenerateQuestionsAfterRoleAnswer({
  session,
  userId,
  transcription,
  socket,
}) {
  const index = session.current_question_index;
  const questions = normalizeQuestions(session.questions_json);
  if (!isRoleSelectionQuestion(questions[index], index)) {
    return { session, questions, generated: false };
  }

  socket?.emit("interview:speaking", {
    status: "preparing",
    message: "Generating your custom interview questions…",
  });

  const { resume, atsScore } = await getEvaluationContext(session, userId);
  const resolvedRole = extractInterviewRole(transcription);
  const questionCount = getPlannedQuestionCount(session);

  const generatedQuestions = await generateInterviewQuestions({
    parsedResume: resume.parsed_json,
    jobRole: resolvedRole,
    jobDescription: resume.job_description,
    atsScore,
    questionCount,
    candidateName: candidateNameFromResume(resume, { id: userId }),
  });

  await updateSessionRole(session.id, userId, resolvedRole);
  const updatedSession = await appendQuestions(session.id, userId, generatedQuestions);

  logger.info({
    msg: "Dynamic questions generated after role selection",
    sessionId: session.id,
    role: resolvedRole,
    count: generatedQuestions.length,
  });

  return {
    session: updatedSession,
    questions: normalizeQuestions(updatedSession.questions_json),
    generated: true,
    resolvedRole,
  };
}

export async function emitNextQuestion(socket, session, nextIndex, getCandidateName) {
  const nextQuestions = normalizeQuestions(session.questions_json);
  const question = nextQuestions[nextIndex];
  const cached = await signedAudioFromQuestion(question);

  let candidateName = "Candidate";
  if (typeof getCandidateName === "function") {
    try {
      const resume = await getResume(session.resume_id, session.user_id);
      candidateName = getCandidateName(resume, socket.user);
    } catch {
      candidateName = "Candidate";
    }
  }

  socket.emit("interview:question", {
    sessionId: session.id,
    question,
    questionIndex: nextIndex,
    totalQuestions: nextQuestions.length,
    candidateName,
    interviewRole: session.job_role,
    ttsAudioUrl: cached.ttsAudioUrl,
    ttsProvider: cached.ttsProvider,
  });

  if (!cached.ttsAudioUrl) {
    setImmediate(async () => {
      try {
        const warmed = await ensureQuestionAudio(session, nextIndex);
        if (warmed.audio.ttsAudioUrl) {
          socket.emit("interview:ttsReady", {
            sessionId: session.id,
            questionIndex: nextIndex,
            ttsAudioUrl: warmed.audio.ttsAudioUrl,
            ttsProvider: warmed.audio.ttsProvider,
          });
        }
        prewarmQuestionAudio(warmed.session, nextIndex + 1);
      } catch (error) {
        logger.warn({ msg: "Next question TTS failed", error: error.message });
      }
    });
  } else {
    prewarmQuestionAudio(session, nextIndex + 1);
  }
}

export async function completeInterview(socket, session, userId) {
  socket.emit("interview:evaluating", {
    status: "started",
    message: "All answers recorded. Sarah is preparing your full interview evaluation…",
  });

  try {
    const finalReport = await generateFinalReport({ session, userId });
    socket.emit("interview:reportReady", {
      sessionId: session.id,
      reportId: finalReport.id,
      overallScore: finalReport.overall_score,
      finalReport,
    });
  } catch (error) {
    socket.emit("interview:error", { message: `Report generation failed: ${error.message}` });
  }
}

export async function processTextAnswer(socket, { sessionId, userId, questionIndex, transcription }) {
  const session = await getSession(sessionId, userId);

  if (session.status !== "in_progress") {
    throw new Error("Session is not in progress");
  }

  let questions = normalizeQuestions(session.questions_json);
  const index = session.current_question_index;
  if (questionIndex != null && Number(questionIndex) !== index) {
    const submittedIndex = Number(questionIndex);
    if (submittedIndex < index) {
      socket.emit("interview:staleAnswerIgnored", {
        submittedQuestionIndex: submittedIndex,
        currentQuestionIndex: index,
        message: "That answer was already processed. Continuing with the current question.",
      });
      await emitNextQuestion(socket, session, index, candidateNameFromResume);
      return;
    }
    throw new Error("Answer does not match the current question");
  }

  const lockKey = answerLockKey(sessionId, index);
  if (answerLocks.has(lockKey)) {
    socket.emit("interview:answerProcessing", {
      questionIndex: index,
      message: "This answer is already being evaluated.",
    });
    return;
  }

  answerLocks.set(lockKey, Date.now());

  try {
    const savedAnswer = await saveAnswer({
      sessionId,
      userId,
      questionIndex: index,
      questionObj: questions[index],
      transcription,
      audioPath: null,
    });

    socket.emit("interview:answerSaved", { questionIndex: index, transcription });

    // Check if this was a role-selection question and generate dynamic questions
    const roleResult = await maybeGenerateQuestionsAfterRoleAnswer({
      session,
      userId,
      transcription,
      socket,
    });

    let workingSession = roleResult.session;
    questions = roleResult.questions;

    if (roleResult.generated && roleResult.resolvedRole) {
      socket.emit("interview:roleConfirmed", { role: roleResult.resolvedRole });
    }

    socket.emit("interview:answerRecorded", {
      questionIndex: index,
      message: "Answer saved. Evaluation will run after the final question.",
    });

    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      const advancedSession = await advanceQuestionIndex(sessionId, userId, index);
      await completeInterview(socket, advancedSession, userId);
      return;
    }

    const advancedSession = await advanceQuestionIndex(sessionId, userId, index);
    await emitNextQuestion(socket, advancedSession, nextIndex, candidateNameFromResume);
  } finally {
    answerLocks.delete(lockKey);
  }
}

/**
 * TTS Service
 * Manages text-to-speech audio generation, caching, and prewarming for zero-latency delivery.
 */
import { createSignedUrl, uploadBuffer } from "./storage.service.js";
import { aiService } from "./ai.service.js";
import { normalizeQuestions, questionText } from "./question.service.js";
import { logger } from "../config/logger.js";
import { supabaseAdmin } from "../config/supabase.js";

/* ------------------------------------------------------------------ */
/*  Signed URL from cached audio                                       */
/* ------------------------------------------------------------------ */
export async function signedAudioFromQuestion(question) {
  if (!question?.ttsAudioPath) {
    return { ttsAudioPath: null, ttsAudioUrl: null, ttsProvider: null };
  }
  return {
    ttsAudioPath: question.ttsAudioPath,
    ttsAudioUrl: await createSignedUrl("tts-audio", question.ttsAudioPath),
    ttsProvider: question.ttsProvider || "cached",
  };
}

/* ------------------------------------------------------------------ */
/*  Generate TTS audio for a question                                  */
/* ------------------------------------------------------------------ */
export async function createQuestionAudio({ userId, sessionId, questionIndex, text, openingMessage }) {
  try {
    const spokenText =
      questionIndex === 0 && openingMessage ? `${openingMessage} ${text}` : text;

    // Priority order: OpenAI nova > shimmer > ElevenLabs Rachel > female_recruiter
    const tts = await aiService.textToSpeech({
      text: spokenText,
      voice: "nova",             // OpenAI's warmest, most natural female voice
      voice_fallbacks: ["shimmer", "alloy", "female_recruiter"],
      speed: 0.95,               // Slightly slower for natural pacing
      instructions:
        "You are Sarah, a warm, professional engineering manager. " +
        "Speak naturally, conversationally, with friendly enthusiasm. " +
        "Do not sound robotic or overly formal.",
    });

    const audioBase64 = tts.audio_base64 ?? tts.audioBase64;
    if (!audioBase64) {
      return { ttsAudioPath: null, ttsAudioUrl: null, ttsProvider: "browser_fallback" };
    }

    const mimeType = tts.mime_type || "audio/wav";
    const extension = mimeType.includes("mpeg") ? "mp3" : "wav";
    const buffer = Buffer.from(audioBase64, "base64");
    const path = `${userId}/${sessionId}/question-${questionIndex}.${extension}`;

    const ttsAudioPath = await uploadBuffer({
      bucket: "tts-audio",
      buffer,
      destination: path,
      contentType: mimeType,
    });

    const ttsAudioUrl = await createSignedUrl("tts-audio", ttsAudioPath);

    logger.info({
      msg: "TTS audio generated",
      sessionId,
      questionIndex,
      provider: tts.provider || "server_tts",
      voice: tts.voice || "nova",
      sizeBytes: buffer.length,
    });

    return {
      ttsAudioPath,
      ttsAudioUrl,
      ttsProvider: tts.provider || "server_tts",
    };
  } catch (error) {
    logger.warn({
      msg: "TTS generation failed; browser fallback available",
      sessionId,
      questionIndex,
      error: error.message,
    });
    return { ttsAudioPath: null, ttsAudioUrl: null, ttsProvider: "browser_fallback" };
  }
}


/* ------------------------------------------------------------------ */
/*  Persist audio path into session's questions_json                   */
/* ------------------------------------------------------------------ */
export async function persistQuestionAudio(session, questionIndex, audio) {
  if (!audio?.ttsAudioPath) return session;

  const questions = normalizeQuestions(session.questions_json);
  if (!questions[questionIndex]) return session;

  questions[questionIndex] = {
    ...questions[questionIndex],
    ttsAudioPath: audio.ttsAudioPath,
    ttsProvider: audio.ttsProvider,
  };

  const { data, error } = await supabaseAdmin
    .from("interview_sessions")
    .update({ questions_json: questions })
    .eq("id", session.id)
    .eq("user_id", session.user_id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------ */
/*  Ensure audio exists (cached or generate)                           */
/* ------------------------------------------------------------------ */
export async function ensureQuestionAudio(session, questionIndex, options = {}) {
  const questions = normalizeQuestions(session.questions_json);
  const question = questions[questionIndex];
  const cached = await signedAudioFromQuestion(question);

  if (cached.ttsAudioUrl) {
    return { session, audio: cached };
  }

  const audio = await createQuestionAudio({
    userId: session.user_id,
    sessionId: session.id,
    questionIndex,
    text: questionText(question),
    openingMessage: options.openingMessage,
  });

  const updatedSession = await persistQuestionAudio(session, questionIndex, audio);
  return { session: updatedSession, audio };
}

/* ------------------------------------------------------------------ */
/*  Background prewarming for upcoming questions                       */
/* ------------------------------------------------------------------ */
export function prewarmQuestionAudio(session, startIndex = 0) {
  if (process.env.PREWARM_TTS !== "true") return;

  const questions = normalizeQuestions(session.questions_json);

  // Fire-and-forget prewarming of upcoming question audio
  setImmediate(async () => {
    let latestSession = session;
    for (let index = startIndex; index < questions.length; index += 1) {
      try {
        const result = await ensureQuestionAudio(latestSession, index);
        latestSession = result.session;
      } catch (error) {
        logger.warn({ msg: `TTS prewarm failed for question ${index}`, error: error.message });
      }
    }
  });
}

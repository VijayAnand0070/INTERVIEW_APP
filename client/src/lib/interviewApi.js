import api from "./api.js";

/** REST fallback when Socket.IO is unavailable */
export async function joinInterviewSession(sessionId) {
  const { data } = await api.post(`/api/interview/session/${sessionId}/join`);
  return data;
}

export async function submitTextAnswer(sessionId, transcription, questionIndex) {
  const { data } = await api.post("/api/interview/text-answer", {
    sessionId,
    questionIndex,
    transcription,
  });
  return data;
}

export async function fetchInterviewSession(sessionId) {
  const { data } = await api.get(`/api/interview/session/${sessionId}`);
  return data;
}

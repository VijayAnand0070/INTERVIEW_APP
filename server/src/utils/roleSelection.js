/**
 * Canonical interview roles and speech-to-role normalization.
 */

export const INTERVIEW_ROLES = [
  "Software Developer",
  "Frontend Developer",
  "Backend Developer",
  "Advanced Level Coding",
];

export function buildRoleSelectionQuestion(candidateName) {
  const name = candidateName || "there";
  return {
    type: "Setup",
    question:
      `${name}, before we dive into your resume, could you tell me which role you are applying for today? ` +
      `You can choose Software Developer, Frontend Developer, Backend Developer, or Advanced Level Coding.`,
    focus: "Role selection",
    expectedSignals: ["Role choice"],
    isRoleSelection: true,
  };
}

/**
 * Maps free-form speech/text to one of the four supported interview tracks.
 */
export function extractInterviewRole(transcription) {
  const text = String(transcription || "").toLowerCase().trim();
  if (!text) return "Software Developer";

  if (
    /\badvanced\b/.test(text) ||
    /\bsystem\s*design\b/.test(text) ||
    /\bscalab/.test(text) ||
    /\balgorithm/.test(text) ||
    /\bsenior\b.*\b(cod|engineer)/.test(text)
  ) {
    return "Advanced Level Coding";
  }

  if (
    /\bfront[\s-]?end\b/.test(text) ||
    /\bfrontend\b/.test(text) ||
    /\bmern\b/.test(text) ||
    /\breact\b/.test(text) ||
    /\bui\s+(dev|engineer)/.test(text) ||
    /\bweb\s+ui\b/.test(text)
  ) {
    return "Frontend Developer";
  }

  if (
    /\bback[\s-]?end\b/.test(text) ||
    /\bbackend\b/.test(text) ||
    /\bapi\s+(dev|engineer)/.test(text) ||
    /\bserver[\s-]?side\b/.test(text) ||
    (/\bjava\b/.test(text) && !/\bscript\b/.test(text)) ||
    (/\bpython\b/.test(text) && /\bapi|django|flask|fastapi\b/.test(text))
  ) {
    return "Backend Developer";
  }

  if (
    /\bsoftware\s+dev/.test(text) ||
    /\bgeneral\b/.test(text) ||
    /\bfull[\s-]?stack\b/.test(text) ||
    /\bsoftware\s+engineer\b/.test(text)
  ) {
    return "Software Developer";
  }

  for (const role of INTERVIEW_ROLES) {
    if (text.includes(role.toLowerCase())) return role;
  }

  const cleaned = String(transcription || "").trim().slice(0, 120);
  return cleaned || "Software Developer";
}

export function getPlannedQuestionCount(session) {
  const questions = session?.questions_json;
  const list = Array.isArray(questions) ? questions : questions?.questions;
  const setup = list?.[0];
  const planned = setup?.plannedQuestionCount ?? setup?.planned_question_count;
  const numeric = Number(planned);
  if (Number.isFinite(numeric) && numeric >= 4) return Math.min(12, Math.round(numeric));
  return 8;
}

export function isRoleSelectionQuestion(question, index) {
  if (index !== 0) return false;
  if (!question || typeof question !== "object") return false;
  return Boolean(question.isRoleSelection || question.type === "Setup");
}

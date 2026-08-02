/**
 * Question Service
 * Handles question normalization, text extraction, and role-specific template selection.
 * Includes deep resume project extraction and Sarah persona for human-like interviews.
 */
import { selectTemplateQuestions } from "../data/questionTemplates.js";
import { aiService } from "./ai.service.js";
import { logger } from "../config/logger.js";

/* ------------------------------------------------------------------ */
/*  Normalization                                                      */
/* ------------------------------------------------------------------ */
export function normalizeQuestions(payload) {
  const questions = payload?.questions ?? payload;
  const list = Array.isArray(questions) ? questions : [];

  if (list.length === 0) {
    return [
      { type: "HR", question: "To get us started, could you give me a quick intro about yourself and what excites you about this role?" },
      { type: "Technical", question: "Which technical skill from your resume are you most proud of, and can you give me a real example of using it?" },
      { type: "Project", question: "Walk me through one project from your resume — what you built, your exact role, and the impact." },
      { type: "Role", question: "How would you approach the first 30 days in this role? What would you prioritize first?" },
    ];
  }

  return list.map((item, index) => {
    if (typeof item === "string") {
      return { type: index === 0 ? "HR" : "Interview", question: item };
    }
    const rawQuestion = item.question || item.text;
    return {
      type: item.type || item.category || "Interview",
      question: textFrom(rawQuestion, `Interview question ${index + 1}`),
      focus: item.focus || "",
      resumeEvidence: item.resumeEvidence || item.resume_evidence || "",
      expectedSignals: item.expectedSignals || item.expected_signals || [],
      ttsAudioPath: item.ttsAudioPath || item.tts_audio_path || null,
      ttsProvider: item.ttsProvider || item.tts_provider || null,
    };
  });
}

export function questionText(question) {
  if (!question) return "";
  return typeof question === "string" ? question : textFrom(question.question || question.text || question, "");
}

function textFrom(value, fallback = "") {
  if (value == null) return fallback;
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map((item) => textFrom(item)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const preferred =
      value.question ||
      value.text ||
      value.title ||
      value.prompt ||
      value.description ||
      value.summary ||
      value.value;
    if (preferred && preferred !== value) return textFrom(preferred, fallback);
    return Object.entries(value)
      .map(([key, val]) => `${key.replace(/_/g, " ")}: ${textFrom(val)}`)
      .filter(Boolean)
      .join("; ");
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/*  Resume Project Extraction                                          */
/* ------------------------------------------------------------------ */
/**
 * Extracts deep-dive questions from actual resume projects.
 * These feel highly personalized and make the interview more like a real call.
 */
function extractResumeProjectQuestions(parsedResume, jobRole, candidateName) {
  const projects = parsedResume?.projects || [];
  const experience = parsedResume?.experience || [];
  const questions = [];
  const namePrefix = candidateName ? `${candidateName.split(" ")[0]}, ` : "";

  for (const project of projects.slice(0, 3)) {
    let name = "";
    let techStack = "";

    if (typeof project === "string") {
      name = project.slice(0, 70);
    } else if (typeof project === "object" && project) {
      name = project.name || project.title || "";
      const desc = project.description || project.details || "";
      // Try to extract tech stack from description
      const techMatches = desc.match(/\b(React|Node|Express|MongoDB|Python|Java|Spring|Django|FastAPI|PostgreSQL|Redis|AWS|Docker|TypeScript|Next\.js|Vue|Angular|MySQL|GraphQL)\b/gi);
      techStack = techMatches ? [...new Set(techMatches)].slice(0, 3).join(", ") : "";
    }

    if (!name) continue;

    const techHint = techStack ? ` using ${techStack}` : "";

    questions.push({
      type: "Project",
      question: `${namePrefix}I noticed your project "${name}"${techHint}. Can you walk me through the architecture, your specific contribution, and the biggest technical challenge you faced?`,
      focus: "project deep-dive",
      resumeEvidence: name,
      expectedSignals: ["architecture clarity", "personal ownership", "technical challenge", "measurable impact"],
    });

    questions.push({
      type: "Project",
      question: `Still on "${name}" — if you could redesign it from scratch today, what would you do differently and why?`,
      focus: "engineering reflection",
      resumeEvidence: name,
      expectedSignals: ["reflection", "improved design", "lessons learned", "technical maturity"],
    });
  }

  // Experience deep-dive
  for (const exp of experience.slice(0, 2)) {
    let label = "";
    if (typeof exp === "string") {
      label = exp.slice(0, 80);
    } else if (typeof exp === "object" && exp) {
      const company = exp.company || exp.organization || "";
      const role = exp.title || exp.role || exp.position || "";
      label = company && role ? `${role} at ${company}` : role || company || "";
    }
    if (!label) continue;

    questions.push({
      type: "Experience",
      question: `${namePrefix}during your time as ${label}, what was your most significant technical contribution and how did it impact the team or product?`,
      focus: "experience impact",
      resumeEvidence: label,
      expectedSignals: ["ownership", "technical depth", "business impact", "collaboration"],
    });
  }

  return questions;
}

/* ------------------------------------------------------------------ */
/*  Question Generation                                                */
/* ------------------------------------------------------------------ */
export function cleanRole(value, fallback) {
  const role = String(value || "").trim();
  if (!role) return fallback || "Software Developer";
  return role.slice(0, 120);
}

export function clampQuestionCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  return Math.max(4, Math.min(15, Math.round(numeric)));
}

/**
 * Generates a hybrid question set:
 * 1. Resume project deep-dives (personalized)
 * 2. AI-generated resume-specific questions
 * 3. Role-specific technical templates (deep technical)
 *
 * Priority order ensures the interview feels like a real human conversation
 * about the candidate's actual background.
 */
export async function generateInterviewQuestions({
  parsedResume,
  jobRole,
  jobDescription,
  atsScore,
  questionCount,
  candidateName,
}) {
  const selectedRole = cleanRole(jobRole, "Software Developer");
  const selectedCount = clampQuestionCount(questionCount);

  try {
    const generated = await aiService.generateQuestions({
      parsedResume,
      jobRole: selectedRole,
      jobDescription,
      atsScore,
      questionCount: selectedCount,
    });
    const groqQuestions = normalizeQuestions(generated)
      .filter((question) => questionText(question).trim())
      .slice(0, selectedCount);

    if (groqQuestions.length >= Math.min(4, selectedCount)) {
      logger.info({
        msg: "Groq question set generated",
        count: groqQuestions.length,
        role: selectedRole,
      });
      return groqQuestions;
    }

    logger.warn({
      msg: "Groq returned too few questions; using emergency fallback",
      count: groqQuestions.length,
      role: selectedRole,
    });
  } catch (error) {
    logger.warn({ msg: "Groq question generation failed, using emergency fallback", error: error.message });
  }

  const projectQuestions = extractResumeProjectQuestions(parsedResume, selectedRole, candidateName);
  const templateQuestions = selectTemplateQuestions(selectedRole, selectedCount, candidateName);

  const merged = [...projectQuestions];
  const existingTexts = new Set(merged.map((q) => questionText(q).toLowerCase().slice(0, 60)));

  for (const q of templateQuestions) {
    const qText = questionText(q).toLowerCase().slice(0, 60);
    if (!existingTexts.has(qText)) {
      merged.push(q);
      existingTexts.add(qText);
    }
    if (merged.length >= selectedCount) break;
  }

  const finalQuestions = merged.slice(0, selectedCount);

  if (finalQuestions.length === 0) {
    return normalizeQuestions(null);
  }

  logger.info({
    msg: "Final question set assembled",
    total: finalQuestions.length,
    projectBased: projectQuestions.length,
    aiGenerated: 0,
    template: finalQuestions.length,
    role: selectedRole,
  });

  return finalQuestions;
}

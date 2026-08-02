import fs from "node:fs";
import fsp from "node:fs/promises";
import axios from "axios";
import FormData from "form-data";
import { env } from "../config/env.js";
import { logger, logAiCall } from "../config/logger.js";

/* ------------------------------------------------------------------ */
/*  Per-endpoint timeout configuration (milliseconds)                  */
/* ------------------------------------------------------------------ */
const TIMEOUTS = {
  readiness: 10_000,
  models: 10_000,
  parseResume: 60_000,
  atsScore: 60_000,
  generateQuestions: 120_000,
  speechToText: 90_000,
  evaluateAnswer: 120_000,
  textToSpeech: 60_000,
  finalReport: 180_000,
};

/* ------------------------------------------------------------------ */
/*  Retry configuration                                                */
/* ------------------------------------------------------------------ */
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1_000;
const MAX_GROQ_RATE_LIMIT_RETRIES = 2;

function groqEnabled() {
  return Boolean(env.groqApiKey);
}

function extractJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/```(?:json)?\s*([\s\S]*?)```|(\{[\s\S]*\}|\[[\s\S]*\])/i);
    const candidate = match?.[1] || match?.[2];
    if (!candidate) return fallback;
    try {
      return JSON.parse(candidate);
    } catch {
      return fallback;
    }
  }
}

function groqRetryDelayMs(response, errorText) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(30_000, Math.ceil(retryAfter * 1000) + 500);
  }

  const retryInMessage = String(errorText || "").match(/try again in\s+([\d.]+)s/i);
  if (retryInMessage) {
    return Math.min(30_000, Math.ceil(Number(retryInMessage[1]) * 1000) + 500);
  }

  return BASE_DELAY_MS * 2;
}

async function groqChatJson({
  endpointName,
  system,
  prompt,
  fallback,
  timeoutMs = 90_000,
  model = env.groqFastModel,
  temperature = 0.2,
  maxCompletionTokens = 900,
}) {
  const start = performance.now();
  for (let attempt = 0; attempt <= MAX_GROQ_RATE_LIMIT_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature,
          top_p: 0.9,
          max_completion_tokens: maxCompletionTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${system}\nReturn strict valid JSON only.` },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429 && attempt < MAX_GROQ_RATE_LIMIT_RETRIES) {
          const delayMs = groqRetryDelayMs(response, errorText);
          logger.warn({
            msg: `Groq ${endpointName} rate limited; retrying`,
            attempt: attempt + 1,
            delayMs,
          });
          await sleep(delayMs);
          continue;
        }
        throw new Error(`Groq ${endpointName} failed: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || "";
      const parsed = extractJson(content, fallback);
      logAiCall(`groq:${endpointName}:${model}`, performance.now() - start);
      return parsed;
    } catch (error) {
      logAiCall(`groq:${endpointName}:${model}`, performance.now() - start, error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Groq ${endpointName} failed after retries`);
}

async function groqSpeechToText(file) {
  if (!env.enableServerStt) {
    throw Object.assign(
      new Error("Server speech-to-text is disabled. Use browser SpeechRecognition or typed text before submitting."),
      { code: "SERVER_STT_DISABLED" }
    );
  }
  if (!groqEnabled()) return postFileRetry("/speech-to-text", file, "audio", "speechToText");
  const start = performance.now();
  const bytes = await fsp.readFile(file.path);
  const form = new globalThis.FormData();
  const blob = new Blob([bytes], { type: file.mimetype || "audio/webm" });
  form.append("file", blob, file.originalname || "answer.webm");
  form.append("model", "whisper-large-v3-turbo");
  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.groqApiKey}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Groq STT failed: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    logAiCall("groq:speechToText", performance.now() - start);
    return {
      transcription: data.text || data.transcription || "",
      text: data.text,
      provider: "groq",
      model: "whisper-large-v3-turbo",
    };
  } catch (error) {
    logAiCall("groq:speechToText", performance.now() - start, error);
    throw error;
  }
}

function isRetryable(error) {
  if (!error) return false;
  const code = error.code || "";
  const status = error.response?.status;
  // Network errors, timeouts, 502/503/504
  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "ERR_NETWORK" ||
    error.code === "ECONNABORTED" ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/*  Circuit breaker state                                              */
/* ------------------------------------------------------------------ */
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;

function checkCircuit() {
  if (consecutiveFailures >= CIRCUIT_THRESHOLD && Date.now() < circuitOpenUntil) {
    throw Object.assign(new Error("AI service circuit breaker open — too many consecutive failures"), {
      code: "CIRCUIT_OPEN",
    });
  }
}

function recordSuccess() {
  consecutiveFailures = 0;
}

function recordFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    logger.error({
      msg: "AI service circuit breaker OPEN",
      consecutiveFailures,
      cooldownMs: CIRCUIT_COOLDOWN_MS,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Core HTTP helpers with retry + circuit breaker                     */
/* ------------------------------------------------------------------ */
function createClient(timeoutMs) {
  return axios.create({
    baseURL: env.aiServiceUrl,
    timeout: timeoutMs,
  });
}

async function postJsonRetry(path, payload, endpointName) {
  checkCircuit();
  const timeout = TIMEOUTS[endpointName] || 120_000;
  const client = createClient(timeout);
  const start = performance.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await client.post(path, payload);
      const durationMs = performance.now() - start;
      recordSuccess();
      logAiCall(endpointName, durationMs);
      return data;
    } catch (error) {
      const durationMs = performance.now() - start;
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        logger.warn({
          msg: `AI:${endpointName} retry ${attempt + 1}/${MAX_RETRIES}`,
          error: error.message,
          delayMs: delay,
        });
        await sleep(delay);
        continue;
      }
      recordFailure();
      logAiCall(endpointName, durationMs, error);
      throw Object.assign(new Error(`AI service error (${endpointName}): ${error.message}`), {
        originalError: error,
        endpoint: endpointName,
      });
    }
  }
}

async function postFileRetry(path, file, fieldName, endpointName) {
  checkCircuit();
  const timeout = TIMEOUTS[endpointName] || 90_000;
  const client = createClient(timeout);
  const start = performance.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const form = new FormData();
      form.append(fieldName, fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype,
      });
      const { data } = await client.post(path, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
      });
      const durationMs = performance.now() - start;
      recordSuccess();
      logAiCall(endpointName, durationMs);
      return data;
    } catch (error) {
      const durationMs = performance.now() - start;
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        logger.warn({
          msg: `AI:${endpointName} retry ${attempt + 1}/${MAX_RETRIES}`,
          error: error.message,
          delayMs: delay,
        });
        await sleep(delay);
        continue;
      }
      recordFailure();
      logAiCall(endpointName, durationMs, error);
      throw Object.assign(new Error(`AI service error (${endpointName}): ${error.message}`), {
        originalError: error,
        endpoint: endpointName,
      });
    }
  }
}

async function getRetry(path, endpointName) {
  checkCircuit();
  const timeout = TIMEOUTS[endpointName] || 10_000;
  const client = createClient(timeout);
  const start = performance.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await client.get(path);
      const durationMs = performance.now() - start;
      recordSuccess();
      logAiCall(endpointName, durationMs);
      return data;
    } catch (error) {
      const durationMs = performance.now() - start;
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        logger.warn({
          msg: `AI:${endpointName} retry ${attempt + 1}/${MAX_RETRIES}`,
          error: error.message,
          delayMs: delay,
        });
        await sleep(delay);
        continue;
      }
      recordFailure();
      logAiCall(endpointName, durationMs, error);
      throw Object.assign(new Error(`AI service error (${endpointName}): ${error.message}`), {
        originalError: error,
        endpoint: endpointName,
      });
    }
  }
}

function questionFallback(payload) {
  return {
    questions: [
      {
        type: "Project",
        question: "Walk me through one important project from your resume. What did you build, what was your role, and what tradeoff did you make?",
        focus: "project ownership",
        resumeEvidence: "",
        expectedSignals: ["ownership", "architecture", "tradeoffs"],
      },
      {
        type: "Technical",
        question: `Explain one technical decision you would make for a ${payload.jobRole || "software"} role and why.`,
        focus: "technical reasoning",
        resumeEvidence: "",
        expectedSignals: ["reasoning", "role fit", "clarity"],
      },
    ],
  };
}

function groqGenerateQuestions(payload) {
  const fallback = questionFallback(payload);
  return groqChatJson({
    endpointName: "generateQuestions",
    fallback,
    model: env.groqFastModel,
    system: "You are Sarah, a senior engineering manager creating a realistic voice interview from resume evidence.",
    prompt: `
Create exactly ${payload.questionCount || 8} interview questions for this candidate.
Use the resume, job role, job description, and ATS context. Do not ask role-selection questions.
Return JSON: {"questions":[{"type":"HR|Technical|Project|System Design|Debugging|Role","question":"...","focus":"...","resumeEvidence":"...","expectedSignals":["..."]}]}
Rules:
- First question should start the real interview, not ask which role they want.
- At least 2 questions must reference specific resume projects or skills.
- Include technical depth, tradeoffs, debugging, and impact.
- Keep each question under 45 words for voice delivery.
- Do not invent resume facts.
Job role: ${payload.jobRole}
Job description: ${String(payload.jobDescription || "").slice(0, 3000)}
ATS: ${JSON.stringify(payload.atsScore || {}).slice(0, 1500)}
Resume: ${JSON.stringify(payload.parsedResume || {}).slice(0, 5000)}
`,
  });
}

function groqEvaluateAnswer(payload) {
  const fallback = {
    score: 50,
    technical_correctness: 50,
    communication_clarity: 50,
    confidence: 50,
    relevance: 50,
    problem_solving: 50,
    answer_structure: 50,
    evidence_depth: 40,
    strengths: ["Answer was captured and can be improved with more specificity."],
    weak_areas: ["Needs more concrete examples, tradeoffs, and measurable impact."],
    suggestions: ["Use a structured answer: problem, action, result, and lesson learned."],
    how_to_improve: ["Prepare one concrete project example with metrics for each major skill."],
    technical_breakdown: "The answer needs more technical detail to assess depth confidently.",
    ideal_answer_points: ["Direct answer", "Technical reasoning", "Specific example", "Measured outcome"],
    follow_up_probe: "Can you give one concrete example with numbers or impact?",
  };
  return groqChatJson({
    endpointName: "evaluateAnswer",
    fallback,
    model: env.groqEvalModel,
    temperature: 0.1,
    system: "You are a strict senior hiring-panel evaluator. Score fairly and provide actionable feedback.",
    prompt: `
Evaluate this interview answer. Return JSON with score fields and improvement feedback.
Question: ${JSON.stringify(payload.question)}
Answer: ${payload.answer}
Job role: ${payload.jobRole}
Rubric: ${(payload.rubric || []).join(", ")}
Job description: ${String(payload.jobDescription || "").slice(0, 2500)}
Resume: ${JSON.stringify(payload.parsedResume || {}).slice(0, 3000)}
ATS: ${JSON.stringify(payload.atsScore || {}).slice(0, 1500)}
Required JSON keys: score, technical_correctness, communication_clarity, confidence, relevance, problem_solving, answer_structure, evidence_depth, strengths, weak_areas, suggestions, how_to_improve, technical_breakdown, ideal_answer_points, follow_up_probe.
Be strict. Penalize vague answers. Do not invent facts.
`,
  });
}

async function groqFinalReport(payload) {
  const candidateName = payload.candidateName || "Candidate";
  const jobRole = payload.jobRole || "Software Developer";
  const fallback = {
    candidate_name: candidateName,
    job_role: jobRole,
    overall_score: 50,
    technical_score: 50,
    communication_score: 50,
    confidence_score: 50,
    resume_relevance_score: Number(payload.atsScore?.score || 50),
    problem_solving_score: 50,
    evidence_depth_score: 45,
    answer_structure_score: 50,
    strengths: ["Completed the interview."],
    weak_areas: ["Needs more specific evidence and technical depth."],
    areas_of_improvement: [
      { area: "Technical Depth", priority: "High", action: "Practice explaining core concepts with real examples and trade-offs." },
      { area: "Evidence & Impact", priority: "High", action: "Quantify your contributions — include metrics in every answer." },
      { area: "Communication", priority: "Medium", action: "Structure answers: Problem → Approach → Result → Learning." },
    ],
    improvements: ["Practice structured answers with measurable project impact."],
    roadmap: [{ title: "Week 1", description: "Prepare project stories with metrics and tradeoffs." }],
    comparison_percentile: 50,
    technical_reasoning_summary: "The report needs more answer detail for a deeper reasoning summary.",
  };
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.groqReportModel,
        temperature: 0.1,
        top_p: 0.9,
        max_completion_tokens: 1_200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a strict senior interview panel writing a detailed evaluation report for ${candidateName} who applied for ${jobRole}. Return JSON only. No markdown.`,
          },
          {
            role: "user",
            content: `Generate a comprehensive final interview report.

CANDIDATE: ${candidateName}
ROLE: ${jobRole}
Resume: ${JSON.stringify(payload.parsedResume || {}).slice(0, 2200)}
ATS Score: ${JSON.stringify(payload.atsScore || {}).slice(0, 800)}
Answer evaluations: ${JSON.stringify(payload.answers || []).slice(0, 4500)}

Required JSON keys:
- candidate_name, job_role
- overall_score, technical_score, communication_score, confidence_score, resume_relevance_score, problem_solving_score, evidence_depth_score, answer_structure_score
- strengths: list citing ${candidateName}'s specific answers
- weak_areas: list with direct evidence from answers
- areas_of_improvement: [{"area":"...","priority":"High|Medium|Low","action":"concrete step for ${candidateName}"}] — MUST have at least 4 items referencing actual weaknesses observed
- improvements, detailed_improvements, roadmap (4-week concrete plan for ${candidateName})
- comparison_percentile (1-99)
- key_takeaway: one sentence on ${candidateName}'s performance for ${jobRole}
- technical_reasoning_summary: 3-5 sentences on ${candidateName}'s technical depth, patterns, and gaps
- role_category_scores

Be realistic and strict. Score based on actual answer quality, not completion.`,
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Groq finalReport failed: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content, fallback);
    logAiCall(`groq:finalReport:${env.groqReportModel}`, performance.now() - start);
    // Ensure candidate fields always present
    parsed.candidate_name = parsed.candidate_name || candidateName;
    parsed.job_role = parsed.job_role || jobRole;
    return parsed;
  } catch (error) {
    logAiCall(`groq:finalReport:${env.groqReportModel}`, performance.now() - start, error);
    logger.warn({ msg: "High-power finalReport failed, retrying report model through compact prompt", error: error.message });
    try {
      return await groqChatJson({
        endpointName: "finalReport",
        fallback,
        timeoutMs: 120_000,
        model: env.groqReportModel,
        temperature: 0.1,
        maxCompletionTokens: 750,
        system: `You are a senior interview evaluator for ${candidateName} applying for ${jobRole}. Return JSON only.`,
        prompt: `Generate a concise final interview report JSON.
Candidate: ${candidateName}, Role: ${jobRole}
Resume: ${JSON.stringify(payload.parsedResume || {}).slice(0, 1600)}
ATS: ${JSON.stringify(payload.atsScore || {}).slice(0, 600)}
Answers: ${JSON.stringify(payload.answers || []).slice(0, 3000)}
Required keys: candidate_name, job_role, overall_score, technical_score, communication_score, confidence_score, resume_relevance_score, problem_solving_score, evidence_depth_score, answer_structure_score, strengths, weak_areas, areas_of_improvement, improvements, detailed_improvements, roadmap, comparison_percentile, key_takeaway, technical_reasoning_summary, role_category_scores.`,
      });
    } catch (compactError) {
      logger.warn({
        msg: "Groq finalReport remained rate limited; returning the structured fallback report",
        error: compactError.message,
      });
      return fallback;
    }
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/*  Public AI service interface                                        */
/* ------------------------------------------------------------------ */
export const aiService = {
  readiness: () => getRetry("/readiness", "readiness"),
  models: () => getRetry("/models", "models"),
  parseResume: (file) => postFileRetry("/parse-resume", file, "file", "parseResume"),
  atsScore: (payload) => postJsonRetry("/ats-score", payload, "atsScore"),
  generateQuestions: (payload) =>
    groqEnabled() ? groqGenerateQuestions(payload) : postJsonRetry("/generate-questions", payload, "generateQuestions"),
  speechToText: (file) =>
    env.enableServerStt
      ? groqEnabled()
        ? groqSpeechToText(file)
        : postFileRetry("/speech-to-text", file, "audio", "speechToText")
      : Promise.reject(
          Object.assign(
            new Error("Server speech-to-text is disabled. Use browser SpeechRecognition or typed text before submitting."),
            { code: "SERVER_STT_DISABLED" }
          )
        ),
  evaluateAnswer: (payload) =>
    groqEnabled() ? groqEvaluateAnswer(payload) : postJsonRetry("/evaluate-answer", payload, "evaluateAnswer"),
  textToSpeech: (payload) => postJsonRetry("/text-to-speech", payload, "textToSpeech"),
  finalReport: (payload) =>
    groqEnabled() ? groqFinalReport(payload) : postJsonRetry("/final-report", payload, "finalReport"),

  /** Returns circuit breaker diagnostics. */
  diagnostics() {
    return {
      consecutiveFailures,
      circuitOpen: consecutiveFailures >= CIRCUIT_THRESHOLD && Date.now() < circuitOpenUntil,
      circuitOpenUntil: circuitOpenUntil > 0 ? new Date(circuitOpenUntil).toISOString() : null,
    };
  },
};

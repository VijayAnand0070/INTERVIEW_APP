/**
 * Report Service
 * Handles final report generation with chart-ready data structures for frontend visualization.
 */
import { supabaseAdmin } from "../config/supabase.js";
import { aiService } from "./ai.service.js";
import { evaluateAllAnswers } from "./answer.service.js";
import {
  getEvaluationContext,
  markSessionEvaluating,
  completeSession,
  candidateNameFromResume,
} from "./interviewSession.service.js";
import { normalizeQuestions } from "./question.service.js";
import { uploadBuffer } from "./storage.service.js";
import { logger } from "../config/logger.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textFrom(value, fallback = "") {
  if (value == null) return fallback;
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map((item) => textFrom(item)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const preferred =
      value.title ||
      value.area ||
      value.category ||
      value.action ||
      value.description ||
      value.summary ||
      value.text ||
      value.value;
    if (preferred && preferred !== value) return textFrom(preferred);
    return Object.entries(value)
      .map(([key, val]) => `${key.replace(/_/g, " ")}: ${textFrom(val)}`)
      .join("; ");
  }
  return fallback;
}

function textArray(value) {
  return toArray(value).map((item) => textFrom(item)).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  Chart-ready data builder                                           */
/* ------------------------------------------------------------------ */
function buildChartData(evaluatedAnswers, report, session) {
  const questions = normalizeQuestions(session.questions_json);

  // Radar chart: 6-axis technical assessment
  const radarChartData = {
    labels: [
      "Technical Accuracy",
      "Communication",
      "Problem Solving",
      "Confidence",
      "Evidence Depth",
      "Answer Structure",
    ],
    values: [
      toNumber(report.technical_score),
      toNumber(report.communication_score),
      toNumber(report.problem_solving_score || report.technical_score * 0.9),
      toNumber(report.confidence_score),
      toNumber(report.evidence_depth_score || report.technical_score * 0.85),
      toNumber(report.answer_structure_score || report.communication_score * 0.95),
    ],
  };

  // Bar chart: per-question score breakdown
  const barChartData = {
    labels: evaluatedAnswers.map((a, i) => textFrom(questions[i]?.type, `Q${i + 1}`)),
    questions: evaluatedAnswers.map(
      (a, i) => textFrom(questions[i]?.question || a.question_text || "").slice(0, 60)
    ),
    scores: evaluatedAnswers.map((a) => toNumber(a.score)),
    colors: evaluatedAnswers.map((a) => {
      const score = toNumber(a.score);
      if (score >= 80) return "#22c55e"; // green
      if (score >= 60) return "#f59e0b"; // amber
      if (score >= 40) return "#f97316"; // orange
      return "#ef4444"; // red
    }),
  };

  // Trend data: performance trajectory
  const trendData = {
    labels: evaluatedAnswers.map((_, i) => `Q${i + 1}`),
    scores: evaluatedAnswers.map((a) => toNumber(a.score)),
    moving_average: evaluatedAnswers.map((_, i, arr) => {
      const window = arr.slice(Math.max(0, i - 2), i + 1);
      const avg = window.reduce((sum, a) => sum + toNumber(a.score), 0) / window.length;
      return Math.round(avg * 100) / 100;
    }),
  };

  // Category breakdown: grouped by question type
  const categoryMap = {};
  for (let i = 0; i < evaluatedAnswers.length; i++) {
    const type = questions[i]?.type || "General";
    if (!categoryMap[type]) categoryMap[type] = { scores: [], count: 0 };
    categoryMap[type].scores.push(toNumber(evaluatedAnswers[i].score));
    categoryMap[type].count += 1;
  }
  const categoryBreakdown = Object.entries(categoryMap).map(([type, data]) => ({
    category: type,
    average_score: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.count) * 100) / 100,
    question_count: data.count,
    best_score: Math.max(...data.scores),
    worst_score: Math.min(...data.scores),
  }));

  // Per-answer detailed evaluation
  const answerDetails = evaluatedAnswers.map((a, i) => {
    const evalJson = a.evaluation_json || {};
    return {
      questionIndex: i,
      questionType: textFrom(questions[i]?.type, "General"),
      questionText: textFrom(questions[i]?.question || a.question_text || "").slice(0, 120),
      score: toNumber(a.score),
      metrics: {
        technicalCorrectness: toNumber(evalJson.technical_correctness),
        communicationClarity: toNumber(evalJson.communication_clarity),
        confidence: toNumber(evalJson.confidence),
        relevance: toNumber(evalJson.relevance),
        problemSolving: toNumber(evalJson.problem_solving),
        answerStructure: toNumber(evalJson.answer_structure),
        evidenceDepth: toNumber(evalJson.evidence_depth),
      },
      strengths: textArray(evalJson.strengths),
      weakAreas: textArray(evalJson.weak_areas),
      suggestions: textArray(evalJson.suggestions),
      followUpProbe: textFrom(evalJson.follow_up_probe),
    };
  });

  return {
    radarChartData,
    barChartData,
    trendData,
    categoryBreakdown,
    answerDetails,
  };
}

/* ------------------------------------------------------------------ */
/*  Final report generation                                            */
/* ------------------------------------------------------------------ */
export async function generateFinalReport({ session, userId }) {
  // Mark session as evaluating
  await markSessionEvaluating(session.id, userId);

  const { resume, atsScore } = await getEvaluationContext(session, userId);
  const candidateName = candidateNameFromResume(resume, { id: userId });

  logger.info({ msg: "Starting final evaluation", sessionId: session.id, userId, candidateName });

  // Evaluate all answers
  const evaluatedAnswers = await evaluateAllAnswers({
    session,
    userId,
    resume,
    atsScore,
  });

  // Generate AI final report with candidate name for personalized feedback
  const report = await aiService.finalReport({
    candidateName,
    jobRole: session.job_role,
    parsedResume: resume?.parsed_json || {},
    atsScore,
    answers: evaluatedAnswers,
  });

  // Build chart-ready data
  const chartData = buildChartData(evaluatedAnswers, report, session);

  // Upload report JSON to storage (flatten chart keys for frontend)
  const fullReport = {
    ...report,
    chartData,
    radar_chart_data: chartData.radarChartData,
    bar_chart_data: chartData.barChartData,
    trend_data: chartData.trendData,
    category_breakdown: chartData.categoryBreakdown,
    answer_details: chartData.answerDetails,
    problem_solving_score: toNumber(report.problem_solving_score || chartData.radarChartData?.values?.[2]),
    evidence_depth_score: toNumber(report.evidence_depth_score || chartData.radarChartData?.values?.[4]),
    answer_structure_score: toNumber(report.answer_structure_score || chartData.radarChartData?.values?.[5]),
  };
  const reportPath = await uploadBuffer({
    bucket: "reports",
    destination: `${userId}/${session.id}/final-report.json`,
    contentType: "application/json",
    buffer: Buffer.from(JSON.stringify(fullReport, null, 2)),
  });

  // Persist to database
  const record = {
    session_id: session.id,
    user_id: userId,
    overall_score: toNumber(report.overall_score),
    technical_score: toNumber(report.technical_score),
    communication_score: toNumber(report.communication_score),
    confidence_score: toNumber(report.confidence_score),
    resume_relevance_score: toNumber(report.resume_relevance_score),
    strengths: textArray(report.strengths),
    weak_areas: textArray(report.weak_areas),
    improvements: textArray(report.improvements),
    roadmap: report.roadmap ?? [],
    report_json: fullReport,
    report_path: reportPath,
  };

  const { data: finalReport, error: reportError } = await supabaseAdmin
    .from("final_reports")
    .upsert(record, { onConflict: "session_id" })
    .select("*")
    .single();

  if (reportError) throw reportError;

  // Complete the session
  await completeSession(session.id, userId);

  logger.info({
    msg: "Final report generated",
    sessionId: session.id,
    overallScore: finalReport.overall_score,
  });

  return finalReport;
}

/* ------------------------------------------------------------------ */
/*  Fetch existing report                                              */
/* ------------------------------------------------------------------ */
export async function getReport(sessionId, userId) {
  const { data, error } = await supabaseAdmin
    .from("final_reports")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

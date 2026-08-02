import { supabaseAdmin } from "../config/supabase.js";
import { logger } from "../config/logger.js";

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Computes average scores per category for a session.
 * Reads from interview_answers which stores evaluation_json with rubric scores.
 */
export async function getSessionMetrics(sessionId, userId) {
  try {
    const { data: answers, error } = await supabaseAdmin
      .from("interview_answers")
      .select("score, evaluation_json, question_index")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("question_index", { ascending: true });

    if (error) throw error;
    if (!answers || answers.length === 0) {
      return {
        averageScore: 0,
        categories: {},
        answeredCount: 0,
        evaluatedCount: 0,
        trendHistory: [],
        confidenceTrend: [],
        sentimentTrend: [],
        skillBreakdown: {},
      };
    }

    // Only look at evaluated answers (score > 0)
    const evaluated = answers.filter((a) => (a.score || 0) > 0);
    if (evaluated.length === 0) {
      return {
        averageScore: 0,
        categories: {},
        answeredCount: answers.length,
        evaluatedCount: 0,
        trendHistory: [],
        confidenceTrend: [],
        sentimentTrend: [],
        skillBreakdown: {},
      };
    }

    let totalScore = 0;
    const trendHistory = [];
    const confidenceTrend = [];
    const sentimentTrend = [];

    // 5 radar chart categories aggregated from evaluation_json rubric fields
    const categoryAgg = {
      Technical: { sum: 0, count: 0 },
      Communication: { sum: 0, count: 0 },
      "Problem Solving": { sum: 0, count: 0 },
      "Project Depth": { sum: 0, count: 0 },
      "Role Fit": { sum: 0, count: 0 },
    };

    for (const ans of evaluated) {
      const answerScore = toNumber(ans.score);
      totalScore += answerScore;
      const ev = ans.evaluation_json || {};
      const idx = ans.question_index ?? trendHistory.length;

      trendHistory.push({
        questionIndex: idx,
        score: Math.round(answerScore),
      });

      const confidence =
        ev.confidence ?? ev.confidence_score ?? ev.communication_clarity ?? answerScore;
      const sentiment =
        ev.sentiment_score ??
        ev.sentiment ??
        ev.relevance ??
        answerScore;

      const confidenceValue = toNumber(confidence, NaN);
      const sentimentValue = toNumber(sentiment, NaN);
      if (Number.isFinite(confidenceValue)) {
        confidenceTrend.push({ questionIndex: idx, value: Math.round(confidenceValue) });
      }
      if (Number.isFinite(sentimentValue)) {
        sentimentTrend.push({ questionIndex: idx, value: Math.round(sentimentValue) });
      }

      // Map evaluation rubric keys → chart categories
      // (AI service stores these in evaluation_json)
      const techScore =
        ev.technical_correctness ?? ev.technical_score ?? ev.technical ?? answerScore;
      const commScore =
        ev.communication_clarity ?? ev.communication_score ?? ev.communication ?? answerScore;
      const probScore =
        ev.problem_solving ?? ev.problem_solving_score ?? answerScore;
      const projScore =
        ev.evidence_depth ?? ev.project_experience_score ?? answerScore;
      const roleScore =
        ev.relevance ?? ev.role_fit_score ?? answerScore;

      const add = (cat, val) => {
        const numeric = toNumber(val, NaN);
        if (Number.isFinite(numeric)) {
          categoryAgg[cat].sum += numeric;
          categoryAgg[cat].count += 1;
        }
      };

      add("Technical", techScore);
      add("Communication", commScore);
      add("Problem Solving", probScore);
      add("Project Depth", projScore);
      add("Role Fit", roleScore);
    }

    const averageScore = Math.round(totalScore / evaluated.length);
    const categories = {};
    for (const [key, val] of Object.entries(categoryAgg)) {
      categories[key] = val.count > 0 ? Math.round(val.sum / val.count) : 0;
    }

    const skillBreakdown = { ...categories };

    return {
      averageScore,
      categories,
      skillBreakdown,
      answeredCount: answers.length,
      evaluatedCount: evaluated.length,
      trendHistory,
      confidenceTrend,
      sentimentTrend,
    };
  } catch (error) {
    logger.error({ msg: "Error computing session metrics", sessionId, error: error.message });
    return {
      averageScore: 0,
      categories: {},
      skillBreakdown: {},
      answeredCount: 0,
      evaluatedCount: 0,
      trendHistory: [],
      confidenceTrend: [],
      sentimentTrend: [],
    };
  }
}

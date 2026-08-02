import { supabaseAdmin } from "../config/supabase.js";
import { aiService } from "../services/ai.service.js";
import { ApiError, notFound } from "../utils/errors.js";

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function getResume(resumeId, userId) {
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

export async function scoreResume(req, res) {
  const userId = req.user.id;
  const { resumeId } = req.body;

  if (!resumeId) {
    throw new ApiError(400, "resumeId is required");
  }

  const resume = await getResume(resumeId, userId);
  const result = await aiService.atsScore({
    parsedResume: resume.parsed_json,
    jobRole: resume.job_role,
    jobDescription: resume.job_description,
  });

  const record = {
    user_id: userId,
    resume_id: resume.id,
    score: numberOrZero(result.ats_score ?? result.score),
    matched_skills: toArray(result.matched_skills ?? result.matchedSkills),
    missing_skills: toArray(result.missing_skills ?? result.missingSkills),
    suggestions: toArray(result.suggestions ?? result.improvement_suggestions),
    strengths: toArray(result.strengths),
    breakdown: result.breakdown ?? {},
  };

  const { data, error } = await supabaseAdmin
    .from("ats_scores")
    .insert(record)
    .select("*")
    .single();

  if (error) throw error;

  res.status(201).json({
    resume,
    atsScore: data,
  });
}

export async function getLatestAtsScore(req, res) {
  const userId = req.user.id;
  const { resumeId } = req.params;

  const resume = await getResume(resumeId, userId);
  const { data, error } = await supabaseAdmin
    .from("ats_scores")
    .select("*")
    .eq("resume_id", resumeId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw notFound("ATS score not found. Run scoring first.");

  res.json({ resume, atsScore: data });
}


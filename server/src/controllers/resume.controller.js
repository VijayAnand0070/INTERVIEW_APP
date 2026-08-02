import { aiService } from "../services/ai.service.js";
import {
  removeLocalFile,
  uploadLocalFile,
} from "../services/storage.service.js";
import { supabaseAdmin } from "../config/supabase.js";
import { ApiError } from "../utils/errors.js";
import { storagePath } from "../utils/fileNames.js";

export async function listResumes(req, res) {
  const userId = req.user.id;

  const [{ data: resumes, error: resumesError }, { data: reports, error: reportsError }] =
    await Promise.all([
      supabaseAdmin
        .from("resumes")
        .select("*")
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false }),
      supabaseAdmin
        .from("final_reports")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

  if (resumesError) throw resumesError;
  if (reportsError) throw reportsError;

  res.json({ resumes, reports });
}

export async function uploadResume(req, res) {
  const userId = req.user.id;
  const { jobRole, jobDescription } = req.body;

  if (!req.file) {
    throw new ApiError(400, "Resume file is required");
  }
  if (!jobRole || !jobDescription) {
    await removeLocalFile(req.file.path);
    throw new ApiError(400, "Job role and job description are required");
  }

  try {
    const filePath = storagePath(userId, req.file.originalname);

    const [storedPath, parsedResume] = await Promise.all([
      uploadLocalFile({
        bucket: "resumes",
        filePath: req.file.path,
        destination: filePath,
        contentType: req.file.mimetype,
      }),
      aiService.parseResume(req.file),
    ]);

    const { data, error } = await supabaseAdmin
      .from("resumes")
      .insert({
        user_id: userId,
        file_name: req.file.originalname,
        file_path: storedPath,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        job_role: jobRole,
        job_description: jobDescription,
        parsed_json: parsedResume,
      })
      .select("*")
      .single();

    if (error) throw error;

    res.status(201).json({
      resume: data,
      parsedResume,
    });
  } finally {
    await removeLocalFile(req.file.path);
  }
}


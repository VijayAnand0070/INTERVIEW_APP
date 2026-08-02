import dotenv from "dotenv";

// Local .env values should take precedence over stale inherited shell variables.
dotenv.config({ override: true });

export const env = {
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:8000",
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  groqFastModel: process.env.GROQ_FAST_MODEL || process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  groqEvalModel: process.env.GROQ_EVAL_MODEL || "llama-3.3-70b-versatile",
  groqReportModel: process.env.GROQ_REPORT_MODEL || "llama-3.3-70b-versatile",
  enableServerStt: String(process.env.ENABLE_SERVER_STT || "").toLowerCase() === "true",
};

function missingSecret(value) {
  return (
    !value ||
    /^(your_|replace_|placeholder|<secret)/i.test(value)
  );
}

export function assertRequiredEnv() {
  const missing = [];
  if (missingSecret(env.supabaseUrl)) missing.push("SUPABASE_URL");
  if (missingSecret(env.supabaseServiceRoleKey)) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

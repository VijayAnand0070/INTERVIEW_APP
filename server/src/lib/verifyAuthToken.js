import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../config/supabase.js";

let authClient = null;

function getAuthClient() {
  if (!authClient && env.supabaseAnonKey && env.supabaseUrl) {
    authClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return authClient;
}

async function verifyViaRest(token) {
  const apiKey = env.supabaseAnonKey || env.supabaseServiceRoleKey;
  if (!apiKey || !env.supabaseUrl) return null;

  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: apiKey,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

/** Validate a Supabase user JWT (publishable/anon or service-role clients). */
export async function verifyAuthToken(token) {
  if (!token) {
    return { user: null, error: "Missing authorization token" };
  }

  const publishableClient = getAuthClient();
  if (publishableClient) {
    const { data, error } = await publishableClient.auth.getUser(token);
    if (data?.user) return { user: data.user, error: null };
    if (error && !env.supabaseServiceRoleKey) {
      return { user: null, error: error.message };
    }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (data?.user) return { user: data.user, error: null };

  const restUser = await verifyViaRest(token);
  if (restUser?.id) return { user: restUser, error: null };

  return {
    user: null,
    error: error?.message || "Invalid or expired session",
  };
}

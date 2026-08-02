import axios from "axios";
import { supabase } from "./supabase.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 120000,
});

async function getValidAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  const needsRefresh = !expiresAtMs || Date.now() >= expiresAtMs - 60_000;

  if (!needsRefresh) return session.access_token;

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session?.access_token) {
    await supabase.auth.signOut();
    return null;
  }

  return refreshed.session.access_token;
}

api.interceptors.request.use(async (config) => {
  const token = await getValidAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      const onAuthPage =
        window.location.pathname === "/login" ||
        window.location.pathname === "/register";
      if (!onAuthPage) {
        window.location.replace(
          `/login?reason=session_expired&from=${encodeURIComponent(window.location.pathname)}`
        );
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      error.message ||
      "Something went wrong";
    return Promise.reject(new Error(message));
  }
);

export default api;

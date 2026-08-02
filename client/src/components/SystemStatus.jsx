import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  Volume2,
  XCircle,
} from "lucide-react";
import api from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import Button from "./Button.jsx";

const initialChecks = {
  backend: { label: "Backend API", status: "checking", detail: "Checking API" },
  ai: { label: "AI Service", status: "checking", detail: "Checking FastAPI" },
  supabase: { label: "Supabase Schema", status: "checking", detail: "Checking tables" },
  voice: { label: "Natural Voice", status: "checking", detail: "Checking TTS" },
};

function mapStatus(status) {
  if (status === "ready") return "border-moss/20 bg-moss/5 text-moss";
  if (status === "warning") return "border-gold/30 bg-gold/10 text-amber-700";
  if (status === "error") return "border-coral/25 bg-coral/10 text-coral";
  return "border-stone-200 bg-stone-50 text-stone-500";
}

function StatusIcon({ status }) {
  if (status === "ready") return <CheckCircle2 size={18} />;
  if (status === "warning") return <AlertTriangle size={18} />;
  if (status === "error") return <XCircle size={18} />;
  return <RefreshCw className="animate-spin" size={18} />;
}

function checkIcon(key) {
  const icons = {
    backend: Server,
    ai: BrainCircuit,
    supabase: Database,
    voice: Volume2,
  };
  return icons[key] ?? Server;
}

export default function SystemStatus() {
  const [checks, setChecks] = useState(initialChecks);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setChecks(initialChecks);

    const nextChecks = { ...initialChecks };

    try {
      const { data } = await api.get("/health");
      nextChecks.backend = {
        label: "Backend API",
        status: data?.status === "ok" ? "ready" : "warning",
        detail: data?.status === "ok" ? "Connected on port 5000" : "Unexpected health response",
      };
    } catch (error) {
      nextChecks.backend = {
        label: "Backend API",
        status: "error",
        detail: "Start server with npm run dev",
      };
    }

    try {
      const { data } = await api.get("/api/ai/readiness");
      nextChecks.ai = {
        label: "AI Service",
        status: data?.ready ? "ready" : "warning",
        detail: data?.ready ? "Groq and speech ready" : "Start AI service and check Groq key",
      };
      nextChecks.voice = {
        label: "Natural Voice",
        status: data?.natural_voice_ready ? "ready" : "warning",
        detail: data?.natural_voice_ready
          ? "Server TTS ready"
          : "Configure XTTS or Piper",
      };
    } catch (error) {
      nextChecks.ai = {
        label: "AI Service",
        status: "error",
        detail: "FastAPI not reachable",
      };
      nextChecks.voice = {
        label: "Natural Voice",
        status: "warning",
        detail: "Browser voice fallback only",
      };
    }

    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (error) {
        const missingTable =
          error.code === "42P01" ||
          error.message?.toLowerCase().includes("could not find") ||
          error.message?.toLowerCase().includes("schema");
        nextChecks.supabase = {
          label: "Supabase Schema",
          status: missingTable ? "error" : "warning",
          detail: missingTable ? "Run supabase/schema.sql" : error.message,
        };
      } else {
        nextChecks.supabase = {
          label: "Supabase Schema",
          status: "ready",
          detail: "Tables reachable",
        };
      }
    } catch (error) {
      nextChecks.supabase = {
        label: "Supabase Schema",
        status: "error",
        detail: "Could not check tables",
      };
    }

    setChecks(nextChecks);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const summary = useMemo(() => {
    const values = Object.values(checks);
    const errorCount = values.filter((item) => item.status === "error").length;
    const warningCount = values.filter((item) => item.status === "warning").length;
    if (errorCount > 0) return `${errorCount} blocker${errorCount > 1 ? "s" : ""}`;
    if (warningCount > 0) return `${warningCount} warning${warningCount > 1 ? "s" : ""}`;
    return "All systems ready";
  }, [checks]);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">
              System readiness
            </p>
            <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">
              {summary}
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-ink">
            Runtime Connection Check
          </h2>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {Object.entries(checks).map(([key, check]) => {
          const Icon = checkIcon(key);
          return (
            <div
              key={key}
              className={`rounded-lg border p-4 ${mapStatus(check.status)}`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <Icon size={20} />
                <StatusIcon status={check.status} />
              </div>
              <p className="font-bold">{check.label}</p>
              <p className="mt-1 min-h-10 text-sm opacity-80">{check.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

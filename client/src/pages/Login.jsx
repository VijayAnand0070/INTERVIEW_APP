
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, Loader2, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { hasSupabaseConfig, supabase } from "../lib/supabase.js";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("reason") === "session_expired") {
      setError("Your session expired. Please sign in again.");
    }
  }, [location.search]);

  useEffect(() => {
    if (user) {
      const params = new URLSearchParams(location.search);
      const from = params.get("from") || location.state?.from?.pathname;
      navigate(from || "/dashboard", { replace: true });
    }
  }, [user, navigate, location.state, location.search]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10 overflow-hidden">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={container}
        className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_420px]"
      >
        <section className="max-w-2xl">
          <motion.div variants={itemAnim} className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-ink text-white">
            <BriefcaseBusiness size={28} />
          </motion.div>
          <motion.h1 variants={itemAnim} className="text-5xl font-bold leading-tight text-ink font-serif tracking-tight">
            interview_agent
          </motion.h1>
          <motion.p variants={itemAnim} className="mt-5 text-lg leading-8 text-stone-600">
            Practice with an AI recruiter, improve your resume match, and walk
            into interviews with sharper answers.
          </motion.p>
          <motion.div variants={itemAnim} className="mt-8 grid gap-3 text-sm font-semibold text-stone-700 sm:grid-cols-3">
            <motion.div whileHover={{ y: -2 }} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              ATS scoring
            </motion.div>
            <motion.div whileHover={{ y: -2 }} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              Voice interviews
            </motion.div>
            <motion.div whileHover={{ y: -2 }} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              Roadmaps
            </motion.div>
          </motion.div>
        </section>

        <motion.div variants={itemAnim}>
          <Card className="shadow-lg border-stone-200/50">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-ink">Login</h2>
              <p className="mt-1 text-sm text-stone-500">
                Use your Supabase email and password.
              </p>
            </div>

            <AnimatePresence>
              {!hasSupabaseConfig && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  Add Supabase values to `client/.env` before signing in.
                </motion.div>
              )}
            </AnimatePresence>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Email</span>
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 transition-colors focus:border-moss"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  Password
                </span>
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 transition-colors focus:border-moss"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-md border border-coral/25 bg-coral/10 p-3 text-sm text-coral"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
                  {loading ? "Signing in..." : "Login"}
                </Button>
              </motion.div>
            </form>

            <p className="mt-5 text-center text-sm text-stone-600">
              New here?{" "}
              <Link className="font-semibold text-moss transition-colors hover:text-ink" to="/register">
                Create an account
              </Link>
            </p>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

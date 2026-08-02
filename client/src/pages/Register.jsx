import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
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

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (data.session) {
      navigate("/dashboard", { replace: true });
      return;
    }

    setMessage("Account created. Confirm your email, then login.");
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10 overflow-hidden">
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={container}
        className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center"
      >
        <motion.div variants={itemAnim} className="w-full">
          <Card className="w-full shadow-lg border-stone-200/50">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-ink font-serif tracking-tight">Create Account</h1>
              <p className="mt-2 text-sm text-stone-500">
                Start with Supabase authentication.
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
                  Add Supabase values to `client/.env` before signing up.
                </motion.div>
              )}
            </AnimatePresence>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  Full name
                </span>
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 transition-colors focus:border-moss"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </label>
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
                  minLength={8}
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
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-md border border-moss/25 bg-moss/10 p-3 text-sm text-moss"
                  >
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                  {loading ? "Creating..." : "Register"}
                </Button>
              </motion.div>
            </form>

            <p className="mt-5 text-center text-sm text-stone-600">
              Already have an account?{" "}
              <Link className="font-semibold text-moss transition-colors hover:text-ink" to="/login">
                Login
              </Link>
            </p>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}


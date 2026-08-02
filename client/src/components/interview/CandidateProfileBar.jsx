import { motion } from "framer-motion";
import { UserRound } from "lucide-react";

const statusStyles = {
  in_progress: { label: "Live Interview", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  completed: { label: "Completed", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  cancelled: { label: "Cancelled", className: "bg-red-500/20 text-red-300 border-red-500/30" },
  evaluating: { label: "Evaluating", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

export default function CandidateProfileBar({
  name,
  email,
  avatarUrl,
  resumeScore,
  role,
  sessionStatus,
  questionIndex,
  totalQuestions,
}) {
  const status = statusStyles[sessionStatus] || statusStyles.in_progress;
  const initials = (name || "C")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl"
    >
      <motion.div
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-600/40 to-indigo-700/40"
        whileHover={{ scale: 1.03 }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <motion.div
            className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            {initials || <UserRound size={20} />}
          </motion.div>
        )}
      </motion.div>

      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-bold text-white">{name}</p>
        {email && <p className="truncate text-xs text-slate-400">{email}</p>}
        <p className="mt-0.5 truncate text-xs text-cyan-300/90">
          Role: {role && role !== "Pending" ? role : "Selecting..."}
        </p>
      </div>

      <motion.div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.className}`}>
          {status.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Resume</span>
          <span className="rounded-lg bg-violet-500/20 px-2 py-0.5 text-sm font-bold text-violet-200">
            {resumeScore > 0 ? resumeScore : "-"}%
          </span>
        </div>
        <p className="text-[10px] text-slate-500">
          Q {questionIndex + 1} / {totalQuestions || "..."}
        </p>
      </motion.div>
    </motion.div>
  );
}

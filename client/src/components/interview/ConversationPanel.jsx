import { motion } from "framer-motion";
import { Bot, UserRound, Loader2 } from "lucide-react";
import { useTypewriter } from "../../hooks/useTypewriter.js";

export default function ConversationPanel({
  callStage,
  agentLine,
  userLine,
  agentStatus,
}) {
  const typedAgent = useTypewriter(agentLine, {
    active: !!agentLine && agentStatus === "speaking",
    speed: 18,
  });

  const agentSpeaking = agentStatus === "speaking";
  const userSpeaking = callStage === "user" && agentStatus === "listening";
  const processing = agentStatus === "transcribing" || agentStatus === "evaluating";
  const idle = callStage === "idle" && !agentLine && !userLine;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/90 shadow-2xl backdrop-blur-2xl"
    >
      <motion.div className="grid gap-0 border-b border-white/10 sm:grid-cols-2">
        <div
          className={`px-5 py-3 ${
            agentSpeaking ? "bg-violet-500/15 ring-1 ring-inset ring-violet-500/40" : ""
          }`}
        >
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-300">
            <Bot size={12} />
            {agentSpeaking ? "Sarah is speaking" : "AI Interviewer"}
          </p>
        </div>
        <motion.div
          className={`px-5 py-3 ${
            userSpeaking || userLine || processing
              ? "bg-cyan-500/15 ring-1 ring-inset ring-cyan-500/40"
              : ""
          }`}
        >
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
            <UserRound size={12} />
            {userSpeaking ? "You are speaking (live)" : processing ? "Your answer" : "Your turn"}
          </p>
        </motion.div>
      </motion.div>

      <div className="space-y-4 p-6 sm:p-8 min-h-[320px]">
        {idle && (
          <p className="py-16 text-center text-slate-500">Connecting to interview session...</p>
        )}

        {agentLine && (
          <motion.div
            layout
            className={`rounded-2xl border px-5 py-4 ${
              agentSpeaking
                ? "border-violet-500/40 bg-violet-500/10"
                : "border-white/10 bg-white/5"
            }`}
          >
            <p className="text-lg font-medium leading-relaxed text-white/95 sm:text-xl whitespace-pre-line">
              {agentSpeaking ? typedAgent : agentLine}
              {agentSpeaking && typedAgent.length < agentLine.length && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-400 align-middle" />
              )}
            </p>
          </motion.div>
        )}

        {(userLine || userSpeaking || processing) && (
          <motion.div
            layout
            className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-4"
          >
            <p className="text-lg font-medium leading-relaxed text-cyan-50 sm:text-xl whitespace-pre-line">
              {userLine || (
                <span className="text-cyan-200/60 italic">Listening... speak now, your words appear here</span>
              )}
              {userSpeaking && userLine && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-cyan-400 align-middle" />
              )}
            </p>
          </motion.div>
        )}

        {processing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 py-4 text-amber-200"
          >
            <Loader2 size={20} className="animate-spin" />
            <p className="text-sm font-medium">
              {agentStatus === "evaluating"
                ? "Sarah is preparing your full interview evaluation..."
                : "Saving your answer..."}
            </p>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}

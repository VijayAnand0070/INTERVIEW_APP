import { motion } from "framer-motion";
import { Bot, Sparkles } from "lucide-react";
import VoiceWaveform from "./VoiceWaveform.jsx";

export default function AgentAvatar({ speaking, thinking, label = "Sarah" }) {
  const active = speaking || thinking;

  return (
    <motion.div
      className="relative flex items-center gap-4"
      animate={speaking ? { x: [0, -1, 1, -1, 0] } : { x: 0 }}
      transition={speaking ? { duration: 0.45, repeat: Infinity } : {}}
    >
      <div className="relative">
        {active && (
          <motion.div
            className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-violet-500/40 to-cyan-500/40 blur-xl"
            animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.95, 1.08, 0.95] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        )}
        <motion.div
          className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600 to-indigo-800 shadow-lg ${
            speaking ? "ring-2 ring-violet-400/60 ring-offset-2 ring-offset-slate-950" : ""
          }`}
          animate={speaking ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          <Bot className="text-white" size={28} />
          {thinking && (
            <motion.span
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles size={12} className="text-white" />
            </motion.span>
          )}
        </motion.div>
      </div>

      <motion.div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-300/80">AI Agent</p>
        <p className="text-lg font-bold text-white">{label}</p>
        <div className="mt-1 h-8">
          <VoiceWaveform active={speaking} color="violet" />
        </div>
      </motion.div>
    </motion.div>
  );
}

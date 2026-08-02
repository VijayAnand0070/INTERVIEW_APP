import { motion } from "framer-motion";

export default function VoiceWaveform({ active, color = "violet" }) {
  const bars = [0, 1, 2, 3, 4, 5, 6];
  const colorMap = {
    violet: "bg-violet-400",
    cyan: "bg-cyan-400",
    emerald: "bg-emerald-400",
  };

  return (
    <motion.div
      className="flex h-8 items-end justify-center gap-1"
      animate={{ opacity: active ? 1 : 0.35 }}
    >
      {bars.map((i) => (
        <motion.span
          key={i}
          className={`w-1 rounded-full ${colorMap[color] || colorMap.violet}`}
          animate={
            active
              ? { height: [6, 22, 10, 26, 8, 20, 6] }
              : { height: 6 }
          }
          transition={
            active
              ? { duration: 0.9, repeat: Infinity, delay: i * 0.07, ease: "easeInOut" }
              : { duration: 0.2 }
          }
          style={{ height: 6 }}
        />
      ))}
    </motion.div>
  );
}

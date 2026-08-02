export default function ScoreBadge({ score = 0, label = "Score", tone = "moss" }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const toneMap = {
    moss: "text-moss border-moss/25 bg-moss/5",
    skyline: "text-skyline border-skyline/25 bg-skyline/5",
    coral: "text-coral border-coral/25 bg-coral/5",
    gold: "text-amber-700 border-gold/30 bg-gold/10",
  };

  return (
    <div className={`rounded-lg border p-4 ${toneMap[tone] ?? toneMap.moss}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold">{Math.round(value)}</p>
      <div className="mt-3 h-2 rounded-full bg-white/70">
        <div
          className="h-2 rounded-full bg-current"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}


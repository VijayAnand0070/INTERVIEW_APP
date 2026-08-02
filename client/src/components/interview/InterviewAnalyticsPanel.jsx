import { motion } from "framer-motion";
import { Radar, Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend
);

const chartTheme = {
  grid: "rgba(255,255,255,0.08)",
  label: "rgba(255,255,255,0.65)",
  tooltip: {
    bg: "rgba(15,23,42,0.95)",
    border: "rgba(99,102,241,0.4)",
  },
};

function MetricPill({ label, value, accent }) {
  return (
    <motion.div
      layout
      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
    >
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${accent}`}>{value}</p>
    </motion.div>
  );
}

export default function InterviewAnalyticsPanel({ metrics, lastEval }) {
  const hasCategories = metrics?.categories && Object.keys(metrics.categories).length > 0;

  if (!hasCategories) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-center backdrop-blur-xl">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="mb-4 h-14 w-14 rounded-full bg-violet-500/20 ring-2 ring-violet-500/40"
        />
        <h3 className="font-semibold text-slate-200">Live Analytics</h3>
        <p className="mt-2 text-sm text-slate-500">
          Charts and scores appear after Sarah evaluates your first submitted answer.
        </p>
        {lastEval && (
          <p className="mt-4 text-xs text-violet-300">
            Last score: {Math.round(lastEval.score ?? 0)}/100
          </p>
        )}
      </div>
    );
  }

  const labels = Object.keys(metrics.categories);
  const values = Object.values(metrics.categories);

  const radarData = {
    labels,
    datasets: [
      {
        label: "Performance",
        data: values,
        backgroundColor: "rgba(139, 92, 246, 0.25)",
        borderColor: "rgba(167, 139, 250, 1)",
        borderWidth: 2,
        pointBackgroundColor: "#a78bfa",
      },
    ],
  };

  const pieData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)",
          "rgba(6, 182, 212, 0.8)",
          "rgba(168, 85, 247, 0.8)",
          "rgba(52, 211, 153, 0.8)",
          "rgba(251, 191, 36, 0.8)",
        ],
        borderWidth: 0,
      },
    ],
  };

  const trendLabels =
    metrics.trendHistory?.map((t) => `Q${t.questionIndex + 1}`) || [];
  const trendScores = metrics.trendHistory?.map((t) => t.score) || [];
  const confValues = metrics.confidenceTrend?.map((t) => t.value) || [];

  const lineData = {
    labels: trendLabels.length ? trendLabels : ["-"],
    datasets: [
      {
        label: "Answer score",
        data: trendScores.length ? trendScores : [0],
        borderColor: "#22d3ee",
        backgroundColor: "rgba(34, 211, 238, 0.1)",
        fill: true,
        tension: 0.35,
      },
      ...(confValues.length
        ? [
            {
              label: "Confidence",
              data: confValues,
              borderColor: "#a78bfa",
              backgroundColor: "transparent",
              tension: 0.35,
            },
          ]
        : []),
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { display: false },
        grid: { color: chartTheme.grid },
        angleLines: { color: chartTheme.grid },
        pointLabels: { color: chartTheme.label, font: { size: 10 } },
      },
    },
    plugins: { legend: { display: false } },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { color: chartTheme.label }, grid: { color: chartTheme.grid } },
      y: { min: 0, max: 100, ticks: { color: chartTheme.label }, grid: { color: chartTheme.grid } },
    },
    plugins: {
      legend: {
        labels: { color: chartTheme.label, boxWidth: 10, font: { size: 10 } },
      },
    },
  };

  const avgConf =
    confValues.length > 0
      ? Math.round(confValues.reduce((a, b) => a + b, 0) / confValues.length)
      : "—";

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-xl">
      <motion.div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-violet-300">
          Live Analytics
        </h3>
        <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-sm font-bold text-violet-200">
          Avg {metrics.averageScore}
        </span>
      </motion.div>

      <div className="grid grid-cols-3 gap-2">
        <MetricPill label="Answered" value={metrics.answeredCount} accent="text-cyan-300" />
        <MetricPill label="Evaluated" value={metrics.evaluatedCount} accent="text-emerald-300" />
        <MetricPill label="Confidence" value={avgConf} accent="text-amber-300" />
      </div>

      <div className="h-[160px]">
        <Radar data={radarData} options={radarOptions} />
      </div>

      <motion.div className="grid grid-cols-2 gap-3">
        <div className="h-[120px]">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Skill mix</p>
          <Doughnut
            data={pieData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
            }}
          />
        </div>
        <motion.div className="h-[120px]">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Trends</p>
          <Line data={lineData} options={lineOptions} />
        </motion.div>
      </motion.div>

      {lastEval?.evaluation?.technical_breakdown && (
        <motion.p
          layout
          className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2 text-xs text-slate-300 line-clamp-3"
        >
          {lastEval.evaluation.technical_breakdown}
        </motion.p>
      )}
    </div>
  );
}

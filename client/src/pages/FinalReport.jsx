import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Lightbulb,
  Map,
  MessageSquareText,
  Target,
  UploadCloud,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar, Bar, Line } from "react-chartjs-2";
import api from "../lib/api.js";
import { downloadReportPdf } from "../utils/downloadReportPdf.js";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import ScoreBadge from "../components/ScoreBadge.jsx";
import WorkflowSteps from "../components/WorkflowSteps.jsx";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend
);

function arrayFrom(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textFrom(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => textFrom(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const preferred = value.title || value.area || value.category || value.action || value.description || value.summary || value.text || value.value;
    if (preferred && preferred !== value) return textFrom(preferred);
    return Object.entries(value)
      .map(([key, val]) => `${key.replace(/_/g, " ")}: ${textFrom(val)}`)
      .join("; ");
  }
  return fallback;
}

function safeList(value) {
  return arrayFrom(value).map((item) => textFrom(item)).filter(Boolean);
}

function safeKey(value, index) {
  return `${textFrom(value).slice(0, 80)}-${index}`;
}

function numberFrom(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function chartLabels(value) {
  return arrayFrom(value).map((item, index) => textFrom(item, `Q${index + 1}`));
}

function chartScores(value) {
  return arrayFrom(value).map((item) => numberFrom(item));
}

function scoreBand(score) {
  if (score >= 80) return { label: "Excellent", color: "#27745C" };
  if (score >= 65) return { label: "Good", color: "#3A6EA5" };
  if (score >= 50) return { label: "Developing", color: "#D9A441" };
  return { label: "Needs practice", color: "#E56B5D" };
}

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function FinalReport() {
  const { sessionId } = useParams();
  const location = useLocation();
  const [report, setReport] = useState(location.state?.report ?? null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(!location.state?.report);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadReport() {
      try {
        const { data } = await api.get(`/api/interview/result/${sessionId}`);
        if (!mounted) return;
        setReport(data.finalReport);
        setAnswers(data.answers ?? []);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadReport();
    return () => { mounted = false; };
  }, [sessionId]);

  const normalized = useMemo(() => {
    const data = report ?? {};
    const details = data.report_json ?? data;
    const chart = details.chartData ?? {};
    return {
      overall: data.overall_score ?? details.overall_score ?? 0,
      technical: data.technical_score ?? details.technical_score ?? 0,
      communication: data.communication_score ?? details.communication_score ?? 0,
      confidence: data.confidence_score ?? details.confidence_score ?? 0,
      resume: data.resume_relevance_score ?? details.resume_relevance_score ?? 0,
      problemSolving: data.problem_solving_score ?? details.problem_solving_score ?? 0,
      evidenceDepth: data.evidence_depth_score ?? details.evidence_depth_score ?? 0,
      answerStructure: data.answer_structure_score ?? details.answer_structure_score ?? 0,
      strengths: safeList(data.strengths ?? details.strengths),
      weakAreas: safeList(data.weak_areas ?? details.weak_areas),
      improvements: safeList(data.improvements ?? details.improvements),
      roadmap: arrayFrom(data.roadmap ?? details.roadmap),
      keyTakeaway: textFrom(details.key_takeaway),
      technicalReasoning: textFrom(details.technical_reasoning_summary),
      detailedImprovements: arrayFrom(details.detailed_improvements),
      barChart: details.bar_chart_data ?? chart.barChartData ?? null,
      trendChart: details.trend_data ?? chart.trendData ?? null,
      radarChart: details.radar_chart_data ?? chart.radarChartData ?? null,
      categoryBreakdown: arrayFrom(details.category_breakdown ?? chart.categoryBreakdown).map((item) => ({
        ...(typeof item === "object" && item !== null ? item : {}),
        category: textFrom(item?.category ?? item?.type ?? item?.name ?? item, "General"),
        average_score: numberFrom(item?.average_score ?? item?.averageScore ?? item?.score ?? 0),
        question_count: numberFrom(item?.question_count ?? item?.questionCount ?? item?.count ?? 0),
      })),
      comparisonPercentile: details.comparison_percentile ?? null,
      candidateName: details.candidate_name ?? data.candidate_name ?? "",
      jobRole: details.job_role ?? data.job_role ?? "",
      areasOfImprovement: arrayFrom(details.areas_of_improvement),
    };
  }, [report]);

  const band = scoreBand(normalized.overall);

  const radarData = useMemo(() => {
    const fromReport = normalized.radarChart;
    if (fromReport?.labels?.length && fromReport?.values?.length) {
      const values = chartScores(fromReport.values);
      return {
        labels: chartLabels(fromReport.labels),
        datasets: [
          {
            label: "Your Score",
            data: values,
            backgroundColor: "rgba(39, 116, 92, 0.15)",
            borderColor: "rgba(39, 116, 92, 0.9)",
            borderWidth: 2,
            pointBackgroundColor: "rgba(39, 116, 92, 1)",
            pointBorderColor: "#fff",
            pointRadius: 5,
          },
          {
            label: "Target",
            data: values.map(() => 75),
            backgroundColor: "rgba(58, 110, 165, 0.06)",
            borderColor: "rgba(58, 110, 165, 0.4)",
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
          },
        ],
      };
    }
    return {
    labels: ["Technical", "Communication", "Problem Solving", "Confidence", "Evidence", "Structure"],
    datasets: [
      {
        label: "Your Score",
        data: [
          normalized.technical,
          normalized.communication,
          normalized.problemSolving || Math.round(normalized.technical * 0.9),
          normalized.confidence,
          normalized.evidenceDepth || Math.round(normalized.technical * 0.85),
          normalized.answerStructure || Math.round(normalized.communication * 0.9),
        ],
        backgroundColor: "rgba(39, 116, 92, 0.15)",
        borderColor: "rgba(39, 116, 92, 0.9)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(39, 116, 92, 1)",
        pointBorderColor: "#fff",
        pointRadius: 5,
        pointHoverRadius: 7,
      },
      {
        label: "Industry Avg",
        data: [65, 70, 65, 68, 66, 68],
        backgroundColor: "rgba(58, 110, 165, 0.08)",
        borderColor: "rgba(58, 110, 165, 0.5)",
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointBackgroundColor: "rgba(58, 110, 165, 0.7)",
        pointBorderColor: "#fff",
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };
  }, [normalized]);

  const perQuestionBar = useMemo(() => {
    const bar = normalized.barChart;
    if (!bar?.labels?.length) {
      return {
        labels: answers.map((a, i) => `Q${i + 1}`),
        datasets: [{
          label: "Score",
          data: answers.map((a) => Number(a.score) || 0),
          backgroundColor: "rgba(39, 116, 92, 0.65)",
          borderRadius: 6,
        }],
      };
    }
    const labels = chartLabels(bar.labels);
    const scores = chartScores(bar.scores ?? bar.values ?? bar.data);
    return {
      labels,
      datasets: [{
        label: "Score per question",
        data: scores,
        backgroundColor: scores.map((s) =>
          s >= 75 ? "rgba(39, 116, 92, 0.75)" : s >= 55 ? "rgba(217, 164, 65, 0.75)" : "rgba(229, 107, 93, 0.75)"
        ),
        borderRadius: 6,
      }],
    };
  }, [normalized.barChart, answers]);

  const trendLine = useMemo(() => {
    const trend = normalized.trendChart;
    if (!trend?.labels?.length) return null;
    const scores = chartScores(trend.scores ?? trend.values ?? trend.data);
    return {
      labels: chartLabels(trend.labels),
      datasets: [
        {
          label: "Score",
          data: scores,
          borderColor: "rgba(58, 110, 165, 0.9)",
          backgroundColor: "rgba(58, 110, 165, 0.12)",
          fill: true,
          tension: 0.35,
        },
        {
          label: "Moving avg",
          data: chartScores(trend.moving_average ?? trend.movingAverage ?? []),
          borderColor: "rgba(39, 116, 92, 0.9)",
          borderDash: [6, 4],
          tension: 0.35,
        },
      ],
    };
  }, [normalized.trendChart]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
    scales: {
      y: { min: 0, max: 100, ticks: { stepSize: 20 } },
    },
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 1200, easing: "easeOutQuart" },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { stepSize: 20, display: false },
        grid: { color: "rgba(0,0,0,0.08)" },
        angleLines: { color: "rgba(0,0,0,0.08)" },
        pointLabels: {
          color: "#44403c",
          font: { family: "'Inter', sans-serif", size: 12, weight: 600 },
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#44403c",
          font: { family: "'Inter', sans-serif", size: 11 },
          boxWidth: 12,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.88)",
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.8)",
        padding: 10,
        cornerRadius: 8,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}/100` },
      },
    },
  };

  const metrics = useMemo(() => [
    { label: "Technical", value: normalized.technical, color: "bg-skyline", hex: "#3A6EA5" },
    { label: "Communication", value: normalized.communication, color: "bg-gold", hex: "#D9A441" },
    { label: "Problem Solving", value: normalized.problemSolving, color: "bg-moss", hex: "#27745C" },
    { label: "Confidence", value: normalized.confidence, color: "bg-coral", hex: "#E56B5D" },
    { label: "Evidence Depth", value: normalized.evidenceDepth, color: "bg-skyline/80", hex: "#5B8FC7" },
    { label: "Answer Structure", value: normalized.answerStructure, color: "bg-moss/80", hex: "#4A9B7F" },
    { label: "Resume Fit", value: normalized.resume, color: "bg-moss", hex: "#27745C" },
  ].filter((m) => m.value > 0), [normalized]);

  const answerStats = useMemo(() => {
    const scores = answers.map((a) => Number(a.score)).filter((s) => Number.isFinite(s));
    if (!scores.length) return { count: 0, average: 0, highest: 0, lowest: 0 };
    return {
      count: scores.length,
      average: scores.reduce((s, v) => s + v, 0) / scores.length,
      highest: Math.max(...scores),
      lowest: Math.min(...scores),
    };
  }, [answers]);

  const weeklyFocus = useMemo(() => [
    { week: "Week 1", label: "Resume alignment", value: Math.max(25, 100 - normalized.resume) },
    { week: "Week 2", label: "Technical depth", value: Math.max(25, 100 - normalized.technical) },
    { week: "Week 3", label: "Communication drills", value: Math.max(25, 100 - normalized.communication) },
    { week: "Week 4", label: "Mock confidence", value: Math.max(25, 100 - normalized.confidence) },
  ], [normalized]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-moss/20 border-t-moss" />
          <p className="mt-4 text-sm font-semibold text-stone-500">Building your evaluation report…</p>
          <p className="mt-1 text-xs text-stone-400">This may take a few moments</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={container} className="pb-20 md:pb-0">
      <motion.div variants={itemAnim} className="mb-5">
        <WorkflowSteps current="report" completed={["upload", "ats", "interview"]} />
      </motion.div>

      {/* Header */}
      <motion.div variants={itemAnim} className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-moss">Final report</p>
          <h1 className="mt-2 text-4xl font-bold text-ink font-serif tracking-tight">Interview Performance</h1>
          <p className="mt-3 max-w-2xl text-base leading-6 text-stone-600">
            AI-powered evaluation across technical, communication, and role-fit dimensions.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/dashboard">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="secondary" className="w-full sm:w-auto"><ArrowLeft size={16} />Dashboard</Button>
            </motion.div>
          </Link>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() =>
                downloadReportPdf({
                  report,
                  answers,
                  candidateName: normalized.candidateName || "Candidate",
                  role: report?.job_role,
                })
              }
            >
              <FileText size={16} />
              Download PDF
            </Button>
          </motion.div>
          <Link to="/resume/upload">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="w-full sm:w-auto"><UploadCloud size={16} />Practice Again</Button>
            </motion.div>
          </Link>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 rounded-md border border-coral/25 bg-coral/10 p-3 text-sm text-coral"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overall score hero */}
      <motion.div variants={itemAnim}>
        <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl">
          <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
            <div className="text-center lg:text-left">
              {(normalized.candidateName || normalized.jobRole) && (
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
                {normalized.candidateName}{normalized.candidateName && normalized.jobRole ? " — " : ""}{normalized.jobRole}
              </p>
            )}
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Overall score</p>
              <motion.p
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.8 }}
                className="mt-2 text-7xl font-black text-white"
              >
                {Math.round(normalized.overall)}
                <span className="text-3xl font-normal text-white/40">/100</span>
              </motion.p>
              <p className="mt-2 text-lg font-bold" style={{ color: band.color }}>
                {band.label}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="rounded-xl bg-white/10 p-4 text-center backdrop-blur"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{m.label}</p>
                  <p className="mt-2 text-3xl font-bold text-white">{Math.round(m.value)}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-white/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, m.value))}%` }}
                      transition={{ duration: 1, delay: 0.4 + i * 0.1 }}
                      className="h-1.5 rounded-full bg-white"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {(normalized.technicalReasoning || normalized.keyTakeaway) && (
        <motion.div variants={itemAnim}>
          <Card className="mb-6 border-indigo-200 bg-indigo-50/40">
            <h2 className="text-xl font-bold text-ink">Deep technical reasoning</h2>
            {normalized.keyTakeaway && (
              <p className="mt-3 text-lg font-semibold text-ink">{normalized.keyTakeaway}</p>
            )}
            {normalized.technicalReasoning && (
              <p className="mt-3 text-sm leading-7 text-stone-700">{normalized.technicalReasoning}</p>
            )}
            {normalized.comparisonPercentile != null && (
              <p className="mt-4 text-sm font-semibold text-indigo-700">
                Estimated percentile vs typical candidates: {normalized.comparisonPercentile}%
              </p>
            )}
          </Card>
        </motion.div>
      )}

      <motion.div variants={itemAnim}>
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-ink">Evaluation statistics</h2>
          <p className="mt-1 text-sm text-stone-500">
            Answers stored in the database, evaluated with deeper reasoning, then charted below.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="h-72">
              <p className="mb-2 text-sm font-semibold text-stone-600">Score per question</p>
              <Bar data={perQuestionBar} options={chartOptions} />
            </div>
            {trendLine ? (
              <div className="h-72">
                <p className="mb-2 text-sm font-semibold text-stone-600">
                  Performance trend
                  {normalized.trendChart?.trend ? ` (${normalized.trendChart.trend})` : ""}
                </p>
                <Line data={trendLine} options={chartOptions} />
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-stone-200 text-sm text-stone-500">
                Trend chart available after multi-question interviews.
              </div>
            )}
          </div>
          {normalized.categoryBreakdown.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {normalized.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase text-stone-500">{cat.category}</p>
                  <p className="mt-1 text-2xl font-bold text-ink">{Math.round(cat.average_score)}</p>
                  <p className="text-xs text-stone-500">{cat.question_count} questions</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Priority Areas of Improvement — from Groq evaluation */}
      {normalized.areasOfImprovement.length > 0 && (
        <motion.div variants={itemAnim}>
          <Card className="mb-6 border-amber-200 bg-amber-50/30">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">⚡</span>
              <div>
                <h2 className="text-xl font-bold text-ink">
                  Areas of Improvement{normalized.candidateName ? ` for ${normalized.candidateName}` : ""}
                </h2>
                {normalized.jobRole && (
                  <p className="text-sm text-stone-500 mt-0.5">Role: {normalized.jobRole}</p>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {normalized.areasOfImprovement.map((item, idx) => {
                const itemObj = typeof item === "object" && item !== null && !Array.isArray(item) ? item : {};
                const priority = textFrom(itemObj.priority, "Medium").toLowerCase();
                const borderColor = priority === "high" ? "border-red-200 bg-red-50/50" : priority === "low" ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50";
                const badgeColor = priority === "high" ? "bg-red-100 text-red-700" : priority === "low" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
                const area = textFrom(itemObj.area || itemObj.category || itemObj.title, textFrom(item, "Improvement area"));
                const action = textFrom(itemObj.action || itemObj.description || itemObj.suggestion, textFrom(item));
                return (
                  <motion.div
                    key={safeKey(item, idx)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className={`rounded-xl border p-4 ${borderColor}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-bold text-ink text-sm">{area}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${badgeColor}`}>
                        {textFrom(itemObj.priority, "Medium")}
                      </span>
                    </div>
                    <p className="text-sm text-stone-600 leading-6">{action}</p>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {normalized.detailedImprovements.length > 0 && (
        <motion.div variants={itemAnim}>
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-ink">Detailed Improvement Breakdown</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {normalized.detailedImprovements.map((item, index) => {
                const itemObj = typeof item === "object" && item !== null && !Array.isArray(item) ? item : {};
                const title = textFrom(itemObj.category || itemObj.area || itemObj.title, textFrom(item, "Improvement"));
                const suggestions = safeList(itemObj.suggestions || itemObj.actions || itemObj.items || item);
                return (
                <div key={safeKey(item, index)} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-ink">{title}</p>
                    <span className="text-sm font-bold text-moss">{Math.round(Number(itemObj.score) || 0)}/100</span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {suggestions.map((s, sIndex) => (
                      <li key={s} className="text-sm text-stone-600 leading-6">• {s}</li>
                    ))}
                  </ul>
                </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Radar chart + Answer analytics */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <motion.div variants={itemAnim}>
          <Card className="h-full">
            <h2 className="text-xl font-bold text-ink">Skill Radar</h2>
            <p className="mt-1 text-sm text-stone-500">
              Your performance across key interview dimensions vs. industry average.
            </p>
            <div className="mt-6 flex items-center justify-center" style={{ maxHeight: 320 }}>
              <Radar data={radarData} options={radarOptions} />
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemAnim} className="flex flex-col gap-4">
          <Card className="flex-1">
            <h2 className="text-xl font-bold text-ink">Answer Analytics</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Answered", answerStats.count],
                ["Avg Score", Math.round(answerStats.average)],
                ["Highest", Math.round(answerStats.highest)],
                ["Lowest", Math.round(answerStats.lowest)],
              ].map(([label, value], i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Score progress bars */}
          <Card>
            <h2 className="font-bold text-ink mb-3">Score Breakdown</h2>
            <div className="space-y-3">
              {metrics.map((m, i) => (
                <div key={m.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold text-stone-700">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: m.hex }} />
                      {m.label}
                    </span>
                    <span className="font-bold text-ink">{Math.round(m.value)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, m.value))}%` }}
                      transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                      className={`h-2 rounded-full ${m.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Weekly improvement plan */}
      <motion.div variants={itemAnim}>
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-ink">4-Week Improvement Plan</h2>
          <p className="mt-1 text-sm text-stone-500">
            Larger bars show areas needing more focus based on your evaluation.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {weeklyFocus.map((item, i) => (
              <div key={item.week} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{item.week}</p>
                <p className="mt-1 min-h-12 font-bold leading-6 text-ink">{item.label}</p>
                <div className="mt-4 flex h-36 items-end rounded-lg bg-white p-2">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(10, Math.min(100, item.value))}%` }}
                    transition={{ duration: 1, delay: 0.4 + i * 0.1 }}
                    className="w-full rounded-md bg-gradient-to-t from-moss to-moss/60"
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-moss">{Math.round(item.value)}% focus</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Strengths / Weak Areas / Improvements */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {[
          {
            icon: <CheckCircle2 className="text-moss" size={20} />,
            title: "Strengths",
            items: normalized.strengths,
            cls: "bg-moss/5",
            empty: "Strengths not returned.",
          },
          {
            icon: <Target className="text-coral" size={20} />,
            title: "Weak Areas",
            items: normalized.weakAreas,
            cls: "bg-coral/10",
            empty: "No weak areas returned.",
          },
          {
            icon: <Lightbulb className="text-skyline" size={20} />,
            title: "Improve Next",
            items: normalized.improvements,
            cls: "bg-skyline/10",
            empty: "Improvement items not returned.",
          },
        ].map((section) => (
          <motion.div key={section.title} variants={itemAnim}>
            <Card className="h-full">
              <div className="mb-4 flex items-center gap-2">
                {section.icon}
                <h2 className="text-xl font-bold text-ink">{section.title}</h2>
              </div>
              <ul className="space-y-3">
                {section.items.length ? (
                  section.items.map((item, i) => (
                    <motion.li
                      key={safeKey(item, i)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      className={`rounded-lg ${section.cls} p-3 text-sm leading-6`}
                    >
                      {textFrom(item)}
                    </motion.li>
                  ))
                ) : (
                  <li className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">{section.empty}</li>
                )}
              </ul>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Learning Roadmap */}
      <motion.div variants={itemAnim}>
        <Card className="mb-6">
          <div className="mb-5 flex items-center gap-2">
            <Map className="text-skyline" size={20} />
            <h2 className="text-xl font-bold text-ink">Learning Roadmap</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {normalized.roadmap.length ? (
              normalized.roadmap.map((item, index) => {
                const itemObj = typeof item === "object" && item !== null && !Array.isArray(item) ? item : {};
                const title = textFrom(itemObj.title || itemObj.week || itemObj.area, textFrom(item));
                const description = textFrom(itemObj.description || itemObj.action || itemObj.details);
                return (
                  <motion.div
                    key={`${title}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + index * 0.08 }}
                    className="rounded-xl border border-stone-200 bg-stone-50 p-4"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-skyline shadow-sm">
                        {index + 1}
                      </span>
                      <p className="font-semibold text-ink">{title}</p>
                    </div>
                    {description && <p className="text-sm leading-6 text-stone-600">{description}</p>}
                  </motion.div>
                );
              })
            ) : (
              <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500">Roadmap items not returned.</p>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Answer Review */}
      {answers.length > 0 && (
        <motion.div variants={itemAnim}>
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <MessageSquareText className="text-moss" size={20} />
              <h2 className="text-xl font-bold text-ink">Answer Review</h2>
            </div>
            <div className="divide-y divide-stone-100">
              {answers.map((answer, i) => {
                const ev = answer.evaluation_json || {};
                const tech = ev.technical_correctness ?? ev.technical_score ?? null;
                const comm = ev.communication_clarity ?? ev.communication_score ?? null;
                const suggestions = safeList(ev.suggestions ?? ev.improvements ?? []);
                return (
                  <motion.div
                    key={answer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 + i * 0.08 }}
                    className="py-5"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Question {Number(answer.question_index) + 1}
                        </p>
                        <p className="mt-1 font-semibold leading-6 text-ink">{textFrom(answer.question_text)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {tech !== null && (
                          <span className="rounded-md bg-moss/10 px-2 py-1 text-xs font-semibold text-moss">
                            Tech {Math.round(tech)}
                          </span>
                        )}
                        {comm !== null && (
                          <span className="rounded-md bg-gold/10 px-2 py-1 text-xs font-semibold text-stone-700">
                            Comm {Math.round(comm)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-skyline/10 px-3 py-1 text-sm font-bold text-skyline">
                          <FileText size={14} />
                          {Math.round(answer.score ?? 0)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 rounded-lg bg-stone-50 p-4 text-sm leading-7 text-stone-600">
                      {textFrom(answer.transcription) || <em className="text-stone-400">No transcription</em>}
                    </p>
                    {ev.technical_breakdown && (
                      <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-stone-700 border-l-2 border-indigo-400">
                        <span className="font-semibold">Technical breakdown: </span>
                        {textFrom(ev.technical_breakdown)}
                      </p>
                    )}
                    {ev.complexity_analysis && (
                      <p className="mt-2 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
                        <span className="font-semibold">Complexity: </span>
                        {textFrom(ev.complexity_analysis)}
                      </p>
                    )}
                    {suggestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {suggestions.slice(0, 2).map((s, si) => (
                          <p key={si} className="rounded-md border-l-2 border-skyline/40 bg-skyline/5 pl-3 py-2 text-sm text-stone-600">
                            {s}
                          </p>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

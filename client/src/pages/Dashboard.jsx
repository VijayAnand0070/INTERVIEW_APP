import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileText,
  Mic2,
  Plus,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Chart as ChartJS,
  PointElement,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import api from "../lib/api.js";

ChartJS.register(
  PointElement,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import ScoreBadge from "../components/ScoreBadge.jsx";
import SystemStatus from "../components/SystemStatus.jsx";
import WorkflowSteps from "../components/WorkflowSteps.jsx";

function formatDate(value) {
  if (!value) return "Recently";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Dashboard() {
  const [resumes, setResumes] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const { data } = await api.get("/api/resumes");
        if (!mounted) return;
        setResumes(data.resumes ?? []);
        setReports(data.reports ?? []);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  const latestReport = reports[0];
  const latestResume = resumes[0];

  const weeklyStats = useMemo(() => {
    if (!reports.length) return null;
    
    const weeksMap = new Map();
    reports.forEach(report => {
      const date = new Date(report.created_at);
      const day = date.getDay() || 7; // 1-7 (Mon-Sun)
      date.setHours(0,0,0,0);
      date.setDate(date.getDate() - day + 1); // Monday
      const weekKey = date.getTime();
      
      if (!weeksMap.has(weekKey)) {
        weeksMap.set(weekKey, { count: 0, totalScore: 0, label: `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` });
      }
      const w = weeksMap.get(weekKey);
      w.count += 1;
      w.totalScore += (report.overall_score || 0);
    });

    const sortedKeys = Array.from(weeksMap.keys()).sort();
    const labels = sortedKeys.map(k => weeksMap.get(k).label);
    const counts = sortedKeys.map(k => weeksMap.get(k).count);
    const averages = sortedKeys.map(k => Math.round(weeksMap.get(k).totalScore / weeksMap.get(k).count));

    return { labels, counts, averages };
  }, [reports]);

  const weeklyChartData = useMemo(() => {
    if (!weeklyStats) return null;
    return {
      labels: weeklyStats.labels,
      datasets: [
        {
          type: 'line',
          label: 'Average Score',
          data: weeklyStats.averages,
          borderColor: "rgba(39, 116, 92, 0.9)",
          backgroundColor: "rgba(39, 116, 92, 0.9)",
          borderWidth: 2,
          yAxisID: 'y-score',
          tension: 0.3,
        },
        {
          type: 'bar',
          label: 'Interviews Completed',
          data: weeklyStats.counts,
          backgroundColor: "rgba(58, 110, 165, 0.65)",
          borderRadius: 4,
          yAxisID: 'y-count',
        }
      ]
    };
  }, [weeklyStats]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" }
    },
    scales: {
      'y-score': {
        type: 'linear',
        position: 'left',
        min: 0,
        max: 100,
        title: { display: true, text: 'Average Score' }
      },
      'y-count': {
        type: 'linear',
        position: 'right',
        min: 0,
        ticks: { stepSize: 1 },
        title: { display: true, text: 'Interviews Completed' },
        grid: { drawOnChartArea: false }
      }
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={container}
      className="pb-20 md:pb-0"
    >
      <motion.div variants={item} className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-moss">
                Interview operations
              </p>
              <h1 className="mt-2 text-4xl font-bold text-ink font-serif tracking-tight">
                Practice Command Center
              </h1>
              <p className="mt-3 text-base leading-6 text-stone-600">
                Move from resume analysis to a voice interview and coaching
                report with one guided workflow.
              </p>
            </div>
            <Link to="/resume/upload">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="w-full sm:w-auto">
                  <Plus size={16} />
                  New Practice
                </Button>
              </motion.div>
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Link
              to="/resume/upload"
              className="focus-ring rounded-lg border border-moss/20 bg-moss/5 p-4 transition hover:border-moss/40 hover:bg-moss/10"
            >
              <UploadCloud className="text-moss" size={22} />
              <p className="mt-3 font-bold text-ink">Upload Resume</p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                Start a new ATS and interview run.
              </p>
            </Link>
            <Link
              to={latestResume ? `/ats-result/${latestResume.id}` : "/resume/upload"}
              className="focus-ring rounded-lg border border-skyline/20 bg-skyline/5 p-4 transition hover:border-skyline/40 hover:bg-skyline/10"
            >
              <BarChart3 className="text-skyline" size={22} />
              <p className="mt-3 font-bold text-ink">Review ATS</p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                Check matches before interview.
              </p>
            </Link>
            <Link
              to={latestReport ? `/report/${latestReport.session_id}` : "/resume/upload"}
              className="focus-ring rounded-lg border border-gold/30 bg-gold/10 p-4 transition hover:border-gold/50"
            >
              <ClipboardCheck className="text-amber-700" size={22} />
              <p className="mt-3 font-bold text-ink">Open Report</p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                See scores and improvement plan.
              </p>
            </Link>
          </div>
        </section>

        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-ink text-white">
                <Mic2 size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-moss">
                  Current run
                </p>
                <h2 className="text-xl font-bold text-ink">
                  {latestResume ? latestResume.job_role : "Ready to begin"}
                </h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              {latestResume
                ? `${latestResume.file_name} was uploaded on ${formatDate(
                    latestResume.uploaded_at
                  )}.`
                : "Upload a resume to generate ATS scoring and personalized interview questions."}
            </p>
          </div>
          <Link
            className="mt-5 inline-flex"
            to={latestResume ? `/ats-result/${latestResume.id}` : "/resume/upload"}
          >
            <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="w-full">
                {latestResume ? "Continue Run" : "Upload Resume"}
                <ArrowRight size={16} />
              </Button>
            </motion.div>
          </Link>
        </Card>
      </motion.div>

      <motion.div variants={item} className="mb-5">
        <WorkflowSteps
          current={latestReport ? "report" : latestResume ? "ats" : "upload"}
          completed={[
            ...(latestResume ? ["upload"] : []),
            ...(latestReport ? ["ats", "interview"] : []),
          ]}
        />
      </motion.div>

      {error && (
        <motion.div variants={item} className="mb-5 rounded-md border border-coral/25 bg-coral/10 p-3 text-sm text-coral">
          {error}
        </motion.div>
      )}

      <motion.div variants={item}>
        <SystemStatus />
      </motion.div>

      <motion.div variants={item} className="mt-6 grid gap-4 md:grid-cols-4">
        <ScoreBadge
          label="Latest Overall"
          score={latestReport?.overall_score ?? 0}
          tone="moss"
        />
        <ScoreBadge
          label="Technical"
          score={latestReport?.technical_score ?? 0}
          tone="skyline"
        />
        <ScoreBadge
          label="Communication"
          score={latestReport?.communication_score ?? 0}
          tone="gold"
        />
        <ScoreBadge
          label="Confidence"
          score={latestReport?.confidence_score ?? 0}
          tone="coral"
        />
      </motion.div>

      {weeklyChartData && (
        <motion.div variants={item} className="mt-6">
          <Card>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-ink">Weekly Statistics</h2>
              <p className="text-sm text-stone-500">
                Track your interview volume and average performance score over time.
              </p>
            </div>
            <div className="h-80 w-full">
              <Bar data={weeklyChartData} options={chartOptions} />
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div variants={item} className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-ink">Resume Runs</h2>
              <p className="text-sm text-stone-500">
                Uploaded resumes and their target roles.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="h-32 animate-pulse rounded-lg bg-stone-100" />
          ) : resumes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
              <FileText className="mx-auto text-stone-400" size={34} />
              <p className="mt-3 font-semibold text-ink">No resumes yet</p>
              <p className="mt-1 text-sm text-stone-500">
                Upload a resume to generate your ATS score.
              </p>
              <Link to="/resume/upload" className="mt-4 inline-flex">
                <Button>
                  <UploadCloud size={16} />
                  Upload Resume
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {resumes.map((resume) => (
                <Link
                  key={resume.id}
                  to={`/ats-result/${resume.id}`}
                  className="group flex items-center justify-between gap-4 rounded-md px-2 py-4 transition hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{resume.job_role}</p>
                      <span className="rounded-md bg-moss/5 px-2 py-1 text-xs font-semibold text-moss">
                        ATS ready
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-stone-500">
                      {resume.file_name} - {formatDate(resume.uploaded_at)}
                    </p>
                  </div>
                  <ArrowRight
                    className="text-stone-400 transition group-hover:translate-x-1 group-hover:text-moss"
                    size={20}
                  />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold/15 text-amber-700">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">Recent Reports</h2>
              <p className="text-sm text-stone-500">Completed interviews.</p>
            </div>
          </div>
          {reports.length === 0 ? (
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="text-sm text-stone-500">
                Final reports appear here after a voice interview.
              </p>
              <Link
                to="/resume/upload"
                className="mt-3 inline-flex items-center text-sm font-semibold text-moss hover:text-ink transition-colors"
              >
                Proceed to interview <ArrowRight size={16} className="ml-1" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.slice(0, 5).map((report) => (
                <Link
                  key={report.id}
                  to={`/report/${report.session_id}`}
                  className="block rounded-lg border border-stone-200 p-4 transition hover:border-moss/40 hover:bg-moss/5"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-ink font-serif text-lg">
                      Score {Math.round(report.overall_score)}
                    </p>
                    <ArrowRight size={16} className="text-stone-400" />
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {formatDate(report.created_at)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}

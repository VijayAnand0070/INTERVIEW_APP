import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  ListChecks,
  Loader2,
  Mic2,
  SlidersHorizontal,
  Target,
  Volume2,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api.js";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import ScoreBadge from "../components/ScoreBadge.jsx";
import WorkflowSteps from "../components/WorkflowSteps.jsx";

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function scoreTone(score) {
  if (score >= 75) return "moss";
  if (score >= 55) return "gold";
  return "coral";
}

function scoreLabel(score) {
  if (score >= 75) return "Strong match";
  if (score >= 55) return "Interviewable match";
  return "Needs sharpening";
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

const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function ATSResult() {
  const { resumeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [resume, setResume] = useState(location.state?.resume ?? null);
  const [atsScore, setAtsScore] = useState(location.state?.atsScore ?? null);
  const [loading, setLoading] = useState(!location.state?.atsScore);
  const [starting, setStarting] = useState(false);
  const [questionCount, setQuestionCount] = useState(8);
  const [guideSpeaking, setGuideSpeaking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (atsScore) return;
    let mounted = true;

    async function loadScore() {
      try {
        const { data } = await api.get(`/api/ats/score/${resumeId}`);
        if (!mounted) return;
        setAtsScore(data.atsScore);
        setResume(data.resume);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadScore();
    return () => {
      mounted = false;
    };
  }, [atsScore, resumeId]);

  const INTERVIEW_TRACKS = [
  "Software Developer",
  "Frontend Developer",
  "Backend Developer",
  "Advanced Level Coding",
];

  const normalized = useMemo(() => {
    const score = atsScore ?? {};
    return {
      score: score.score ?? score.ats_score ?? 0,
      matchedSkills: asArray(score.matched_skills ?? score.matchedSkills),
      missingSkills: asArray(score.missing_skills ?? score.missingSkills),
      suggestions: asArray(score.suggestions ?? score.improvementSuggestions),
      strengths: asArray(score.strengths),
      breakdown: score.breakdown ?? {},
    };
  }, [atsScore]);

  const candidateName = useMemo(() => {
    const parsedName = resume?.parsed_json?.name || "";
    if (parsedName) return String(parsedName).split(/\s+/).slice(0, 2).join(" ");
    return "Candidate";
  }, [resume]);

  async function startInterview() {
    setStarting(true);
    setError("");
    try {
      const { data } = await api.post("/api/interview/start", {
        resumeId,
        atsScoreId: atsScore?.id,
        questionCount,
      });
      navigate(`/interview/${data.session.id}`, {
        state: data,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  function speakSetupGuide() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const text = `Hi ${candidateName}. Groq will review your parsed resume, ATS score, job role, and job description first. Then Sarah will ask ${questionCount} tailored questions and generate your final evaluation report.`;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice =
      voices.find((voice) => /female|zira|samantha|aria|jenny/i.test(voice.name)) ||
      voices.find((voice) => voice.lang?.startsWith("en")) ||
      voices[0];
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.rate = 0.94;
    utterance.pitch = 1.03;
    utterance.onstart = () => setGuideSpeaking(true);
    utterance.onend = () => setGuideSpeaking(false);
    utterance.onerror = () => setGuideSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-moss/20 border-t-moss" />
          <p className="mt-3 text-sm font-semibold text-stone-500">
            Loading ATS result
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={container}
      className="pb-20 md:pb-0"
    >
      <motion.div variants={itemAnim} className="mb-5">
        <WorkflowSteps current="ats" completed={["upload"]} />
      </motion.div>

      <motion.div variants={itemAnim} className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-moss">
            ATS result
          </p>
          <h1 className="mt-2 text-4xl font-bold text-ink font-serif tracking-tight">
            {resume?.job_role ?? "Resume Match"}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-6 text-stone-600">
            The interview agent will use this ATS result, resume evidence, and
            job description to generate role-specific questions.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/resume/upload">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="secondary" className="w-full sm:w-auto">
                <ArrowLeft size={16} />
                Upload Another
              </Button>
            </motion.div>
          </Link>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={startInterview}
              disabled={starting || !atsScore}
              className="w-full sm:w-auto"
            >
              {starting ? <Loader2 className="animate-spin" size={16} /> : <Mic2 size={16} />}
              {starting ? "Preparing Interview..." : "Proceed to interview"}
            </Button>
          </motion.div>
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

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <motion.div variants={itemAnim}>
            <Card className="border-moss/20 bg-moss/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-moss">
                    ATS score
                  </p>
                  <p className="mt-2 text-5xl font-bold text-ink">
                    {Math.round(normalized.score)}
                    <span className="text-xl text-stone-400">/100</span>
                  </p>
                  <p className="mt-2 font-semibold text-moss">
                    {scoreLabel(normalized.score)}
                  </p>
                </div>
                <Target className="text-moss" size={28} />
              </div>
              <div className="mt-5 h-2 rounded-full bg-white overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, normalized.score))}%` }}
                  transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                  className="h-2 rounded-full bg-moss"
                />
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemAnim}>
            <ScoreBadge
              label="Interview readiness"
              score={normalized.score}
              tone={scoreTone(normalized.score)}
            />
          </motion.div>

          <motion.div variants={itemAnim}>
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <FileText className="text-skyline" size={19} />
                <h2 className="text-lg font-bold text-ink">Resume File</h2>
              </div>
              <p className="break-words text-sm font-semibold text-ink">
                {resume?.file_name ?? "Resume"}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {resume?.job_description
                  ? `${resume.job_description.slice(0, 180)}${
                      resume.job_description.length > 180 ? "..." : ""
                    }`
                  : "Job description saved with the resume run."}
              </p>
            </Card>
          </motion.div>

          <motion.div variants={itemAnim}>
            <Card>
              <h2 className="text-lg font-bold text-ink">Score Breakdown</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(normalized.breakdown).length ? (
                  Object.entries(normalized.breakdown).map(([key, value], i) => (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="capitalize text-stone-600">
                          {key.replaceAll("_", " ")}
                        </span>
                        <span className="font-semibold text-ink">
                          {Math.round(Number(value) || 0)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }}
                          transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                          className="h-2 rounded-full bg-skyline"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">
                    Breakdown was not returned by the scorer.
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid gap-4">
          <motion.div variants={itemAnim}>
            <Card className="border-moss/20">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-moss" size={20} />
                <h2 className="text-xl font-bold text-ink">Matched Skills</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {normalized.matchedSkills.length ? (
                  normalized.matchedSkills.map((skill, i) => (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      key={skill}
                      className="rounded-md border border-moss/20 bg-moss/10 px-3 py-1 text-sm font-semibold text-moss"
                    >
                      {skill}
                    </motion.span>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">No direct matches found.</p>
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemAnim}>
            <Card className="border-coral/20">
              <div className="mb-4 flex items-center gap-2">
                <XCircle className="text-coral" size={20} />
                <h2 className="text-xl font-bold text-ink">Missing Skills</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {normalized.missingSkills.length ? (
                  normalized.missingSkills.map((skill, i) => (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      key={skill}
                      className="rounded-md border border-coral/20 bg-coral/10 px-3 py-1 text-sm font-semibold text-coral"
                    >
                      {skill}
                    </motion.span>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">No major gaps detected.</p>
                )}
              </div>
            </Card>
          </motion.div>

          <div className="grid gap-4 xl:grid-cols-2">
            <motion.div variants={itemAnim}>
              <Card>
                <div className="mb-4 flex items-center gap-2">
                  <ListChecks className="text-skyline" size={20} />
                  <h2 className="text-xl font-bold text-ink">Resume Suggestions</h2>
                </div>
                <ul className="space-y-3">
                  {normalized.suggestions.length ? (
                    normalized.suggestions.map((suggestion, i) => (
                      <motion.li
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        key={suggestion}
                        className="rounded-lg bg-stone-50 p-3 text-sm leading-6 text-stone-700"
                      >
                        {suggestion}
                      </motion.li>
                    ))
                  ) : (
                    <li className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">
                      No specific suggestions returned.
                    </li>
                  )}
                </ul>
              </Card>
            </motion.div>

            <motion.div variants={itemAnim}>
              <Card>
                <h2 className="text-xl font-bold text-ink">Resume Strengths</h2>
                <ul className="mt-4 space-y-3">
                  {normalized.strengths.length ? (
                    normalized.strengths.map((strength, i) => (
                      <motion.li
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        key={strength}
                        className="rounded-lg bg-moss/5 p-3 text-sm leading-6 text-stone-700"
                      >
                        {strength}
                      </motion.li>
                    ))
                  ) : (
                    <li className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">
                      Strengths will appear when returned by the ATS service.
                    </li>
                  )}
                </ul>
              </Card>
            </motion.div>
          </div>

          <motion.div variants={itemAnim}>
            <Card className="border-skyline/20 bg-skyline/5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-skyline shadow-sm">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-skyline">
                    Interview setup
                  </p>
                  <h2 className="text-xl font-bold text-ink">
                    Hi {candidateName}, Groq will prepare Sarah's interview
                  </h2>
                </div>
              </div>

              <motion.div variants={itemAnim} className="mb-4 grid gap-2 sm:grid-cols-2">
                {INTERVIEW_TRACKS.map((track) => (
                  <div
                    key={track}
                    className="rounded-lg border border-skyline/15 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
                  >
                    {track}
                  </div>
                ))}
              </motion.div>

              <label className="block max-w-xs">
                <span className="text-sm font-semibold text-stone-700">
                  Groq-generated questions
                </span>
                <select
                  className="focus-ring mt-1 w-full rounded-md border border-skyline/20 bg-white px-3 py-2 shadow-sm"
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                >
                  {[4, 5, 6, 8, 10, 12].map((count) => (
                    <option key={count} value={count}>
                      {count} questions
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Groq reads the parsed resume, job role, job description, and ATS context first.
                Sarah then starts directly with tailored interview questions.
              </p>
              <div className="mt-4 rounded-lg border border-white bg-white p-4 shadow-sm">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                  <div>
                    <p className="text-sm font-bold text-ink">
                      interview_agent AI Interviewer
                    </p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      "Hi {candidateName}, I reviewed your resume and prepared this interview for your selected role."
                    </p>
                  </div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="secondary"
                      onClick={speakSetupGuide}
                      disabled={guideSpeaking}
                      className="w-full sm:w-auto"
                    >
                      {guideSpeaking ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Volume2 size={16} />
                      )}
                      {guideSpeaking ? "Speaking..." : "Play Guide"}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemAnim}>
            <Card className="border-ink/10 bg-ink text-white shadow-medium">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
                    Next step
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">Enter the voice interview</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                    Sarah prepares the interview privately. You will only see each
                    question when the AI interviewer asks it.
                  </p>
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={startInterview}
                    disabled={starting || !atsScore}
                    className="bg-white text-ink hover:bg-stone-100"
                  >
                    {starting ? <Loader2 className="animate-spin" size={16} /> : <Mic2 size={16} />}
                    {starting ? "Preparing..." : "Proceed to interview"}
                  </Button>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}


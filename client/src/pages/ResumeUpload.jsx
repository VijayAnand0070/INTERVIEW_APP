import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api.js";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import WorkflowSteps from "../components/WorkflowSteps.jsx";

const progressSteps = [
  "Resume upload",
  "Resume parsing",
  "ATS scoring",
  "Ready for interview",
];

function formatBytes(size = 0) {
  if (!size) return "0 KB";
  const kb = size / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
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

export default function ResumeUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [jobRole, setJobRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [stage, setStage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  const stageIndex = useMemo(() => {
    if (!stage) return -1;
    return progressSteps.findIndex((item) => item === stage);
  }, [stage]);

  const canSubmit = file && jobRole.trim() && jobDescription.trim() && !stage;
  const jobDescriptionCount = jobDescription.trim().split(/\s+/).filter(Boolean).length;

  function selectFile(nextFile) {
    if (!nextFile) return;
    setFile(nextFile);
    setError("");
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError("Upload a PDF or DOCX resume.");
      return;
    }

    setError("");
    setStage("Resume upload");

    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("jobRole", jobRole);
      formData.append("jobDescription", jobDescription);

      const uploadResponse = await api.post("/api/resume/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStage("Resume parsing");
      const resume = uploadResponse.data.resume;

      setStage("ATS scoring");
      const scoreResponse = await api.post("/api/ats/score", {
        resumeId: resume.id,
      });

      setStage("Ready for interview");
      navigate(`/ats-result/${resume.id}`, {
        state: {
          resume,
          atsScore: scoreResponse.data.atsScore,
        },
      });
    } catch (err) {
      setError(err.message);
      setStage("");
    }
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={container}
      className="mx-auto max-w-6xl pb-20 md:pb-0"
    >
      <motion.div variants={itemAnim} className="mb-5">
        <WorkflowSteps current="upload" />
      </motion.div>

      <motion.div variants={itemAnim} className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-moss">
            Resume analysis
          </p>
          <h1 className="mt-2 text-4xl font-bold text-ink font-serif tracking-tight">
            Upload Resume
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-6 text-stone-600">
            The backend stores the file in Supabase, parses it, scores ATS fit,
            and prepares resume-aware interview questions.
          </p>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <motion.div variants={itemAnim}>
          <Card>
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  Resume file
                </span>
                <motion.div
                  animate={{
                    scale: dragActive ? 1.02 : 1,
                    backgroundColor: dragActive ? "rgba(15, 81, 50, 0.1)" : "rgba(250, 250, 249, 1)",
                    borderColor: dragActive ? "rgba(15, 81, 50, 1)" : "rgba(214, 213, 212, 1)"
                  }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 flex min-h-52 items-center justify-center rounded-lg border border-dashed p-6 text-center"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <div className="w-full max-w-lg">
                    <motion.div 
                      animate={{ y: dragActive ? -5 : 0 }}
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-white text-moss shadow-sm"
                    >
                      <UploadCloud size={28} />
                    </motion.div>
                    <p className="mt-4 text-lg font-bold text-ink">
                      {file ? file.name : "Choose or drop your resume"}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      PDF or DOCX - Stored in Supabase resumes bucket
                    </p>
                    <input
                      className="focus-ring mt-5 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => selectFile(event.target.files?.[0])}
                      required
                    />
                    <AnimatePresence>
                      {file && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="mt-4 flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-moss shadow-sm"
                        >
                          <FileText size={16} />
                          {formatBytes(file.size)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </label>

              <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">
                    Job role
                  </span>
                  <div className="mt-1 flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2">
                    <BriefcaseBusiness size={17} className="text-stone-400" />
                    <input
                      className="focus-ring w-full border-0 bg-transparent p-0 outline-none"
                      placeholder="Full Stack Developer"
                      value={jobRole}
                      onChange={(event) => setJobRole(event.target.value)}
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">
                    Target job description
                  </span>
                  <textarea
                    className="focus-ring mt-1 min-h-32 w-full rounded-md border border-stone-200 bg-white px-3 py-2"
                    placeholder="Paste the target job description here..."
                    value={jobDescription}
                    onChange={(event) => setJobDescription(event.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs font-semibold text-stone-500">
                    {jobDescriptionCount} words
                  </p>
                </label>
              </div>

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
              </AnimatePresence>

              <AnimatePresence>
                {stage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-lg border border-skyline/20 bg-skyline/5 p-4"
                  >
                    <div className="flex items-center gap-3 text-sm font-semibold text-skyline">
                      <Loader2 className="animate-spin" size={18} />
                      {stage}...
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      {progressSteps.map((item, index) => (
                        <div
                          key={item}
                          className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors duration-300 ${
                            index <= stageIndex
                              ? "border-skyline/25 bg-white text-skyline"
                              : "border-stone-200 bg-white/70 text-stone-400"
                          }`}
                        >
                          {index < stageIndex ? (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <CheckCircle2 className="mb-1" size={15} />
                            </motion.div>
                          ) : (
                            <span className="mb-1 block h-[15px]" />
                          )}
                          {item}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div whileHover={canSubmit ? { scale: 1.02 } : {}} whileTap={canSubmit ? { scale: 0.98 } : {}}>
                <Button className="w-full" type="submit" disabled={!canSubmit}>
                  <Wand2 size={16} />
                  {stage ? "Processing..." : "Analyze Resume"}
                  {!stage && <ArrowRight size={16} />}
                </Button>
              </motion.div>
            </form>
          </Card>
        </motion.div>

        <motion.div variants={itemAnim} className="grid gap-4 content-start">
          <Card>
            <h2 className="text-xl font-bold text-ink">What Happens Next</h2>
            <div className="mt-4 space-y-3">
              {[
                "Resume is uploaded to Supabase Storage.",
                "AI parser extracts skills, projects, education, and experience.",
                "ATS scoring compares the resume with the target job.",
                "The next page opens the voice interview agent.",
              ].map((item, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  key={item} 
                  className="flex gap-3 rounded-lg bg-stone-50 p-3"
                >
                  <CheckCircle2 className="mt-0.5 shrink-0 text-moss" size={18} />
                  <p className="text-sm leading-6 text-stone-700">{item}</p>
                </motion.div>
              ))}
            </div>
          </Card>

          <Card className="border-moss/20 bg-moss/5">
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">
              Voice agent ready
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink">
              Resume-aware questions
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              After ATS scoring, Sarah prepares questions from the parsed resume
              and job role. XTTS speaks them in the female recruiter voice.
            </p>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  UploadCloud,
  FileText,
  Mic2,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import Button from "../components/Button.jsx";
import InteractiveDots from "../components/InteractiveDots.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const audienceWords = [
  "interviewees",
  "freshers",
  "job seekers",
  "software developers",
  "backend developers",
  "career switchers",
  "campus placements",
];

const features = [
  {
    icon: UploadCloud,
    title: "Resume first",
    text: "Upload a resume and let the system extract skills, projects, and experience before interview setup.",
  },
  {
    icon: Mic2,
    title: "Voice interview",
    text: "Enter a call-style AI interview where the recruiter speaks one question at a time.",
  },
  {
    icon: BarChart3,
    title: "Serious report",
    text: "Get technical, communication, confidence, and resume relevance scores with a learning plan.",
  },
];

function useTypingWords(words) {
  const [wordIndex, setWordIndex] = useState(0);
  const [visible, setVisible] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIndex];
    const atFullWord = visible === word;
    const atEmptyWord = visible === "";
    const delay = atFullWord && !deleting ? 1500 : deleting ? 40 : 80;

    const timer = window.setTimeout(() => {
      if (!deleting && atFullWord) {
        setDeleting(true);
        return;
      }

      if (deleting && atEmptyWord) {
        setDeleting(false);
        setWordIndex((index) => (index + 1) % words.length);
        return;
      }

      setVisible((current) =>
        deleting ? word.slice(0, current.length - 1) : word.slice(0, current.length + 1)
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [deleting, visible, wordIndex, words]);

  return visible;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

export default function Landing() {
  const { user } = useAuth();
  const typedWord = useTypingWords(audienceWords);
  const primaryTarget = user ? "/dashboard" : "/register";
  const uploadTarget = user ? "/resume/upload" : "/login";

  return (
    <div className="min-h-screen overflow-hidden bg-cream text-ink font-sans">
      <header className="border-b border-black/5 bg-cream/90 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="focus-ring flex items-center gap-3 rounded-md">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-white shadow-sm"
            >
              <BriefcaseBusiness size={20} />
            </motion.div>
            <div>
              <p className="text-base font-bold leading-5 font-serif tracking-tight">
                interview_agent
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex">
            <a className="hover:text-ink transition-colors" href="#workflow">
              Workflow
            </a>
            <a className="hover:text-ink transition-colors" href="#report">
              Reports
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to={user ? "/dashboard" : "/login"} className="hidden sm:inline-flex text-sm font-medium text-stone-600 hover:text-ink">
              {user ? "Dashboard" : "Login"}
            </Link>
            <Link to={primaryTarget}>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-ink hover:bg-stone-800 text-white shadow-soft rounded-full px-5 py-2 text-sm font-medium transition-colors"
              >
                {user ? "Open App" : "Start Practice"}
              </motion.button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <motion.section 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="relative flex flex-col items-center text-center px-4 pt-24 pb-20 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-32 overflow-hidden min-h-[85vh]"
        >
          <InteractiveDots />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_26%_22%_at_50%_50%,rgba(250,248,245,0.82)_0%,rgba(250,248,245,0.2)_45%,transparent_68%)]"
          />
          <motion.div variants={fadeUp} className="relative z-10 w-full flex flex-col items-center">
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-4 py-1.5 text-xs font-medium text-stone-600 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-moss animate-pulse"></span>
            Practice mode active
          </motion.div>

          <motion.h1 variants={fadeUp} className="max-w-5xl text-6xl font-serif font-medium leading-[1.1] tracking-tight text-ink sm:text-7xl lg:text-8xl">
            Built for <span className="text-coral/50 font-sans mx-1">&gt;</span>{" "}
            <span className="inline-block text-coral">
              {typedWord}
              <span className="ml-[2px] h-[0.9em] w-[3px] -translate-y-1 inline-block animate-caret bg-coral" />
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-8 max-w-2xl text-lg leading-relaxed text-stone-600 sm:text-xl">
            Practice real AI interviews, speak with a voice interviewer, get
            resume-based questions, and receive serious feedback before the
            real interview.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to={primaryTarget}>
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 rounded-full bg-ink px-8 py-3.5 text-base font-medium text-white transition-all hover:bg-stone-800 hover:shadow-soft w-full sm:w-auto"
              >
                Start Interview Practice
              </motion.button>
            </Link>
            <Link to={uploadTarget}>
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 rounded-full bg-white border border-stone-200 px-8 py-3.5 text-base font-medium text-ink transition-all hover:bg-stone-50 hover:border-stone-300 shadow-sm w-full sm:w-auto"
              >
                Upload Resume
              </motion.button>
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} className="mt-6 text-sm text-stone-500">
            Or read the <a href="#workflow" className="underline underline-offset-4 hover:text-ink">workflow documentation</a>
          </motion.p>
          </motion.div>
        </motion.section>

        <section id="workflow" className="border-y border-black/5 bg-white/50 py-24 overflow-hidden">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          >
            <motion.div variants={fadeUp} className="mb-16 text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-serif tracking-tight text-ink sm:text-4xl">The complete interview pipeline</h2>
              <p className="mt-4 text-lg text-stone-600">A professional-grade environment to refine your responses and eliminate surprises.</p>
            </motion.div>
            <div className="grid gap-8 md:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <motion.div
                  variants={fadeUp}
                  whileHover={{ y: -5 }}
                  key={title}
                  className="rounded-2xl border border-stone-200/60 bg-white p-8 shadow-soft transition-shadow hover:shadow-medium"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-moss/10 text-moss">
                    <Icon size={24} strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-6 text-xl font-serif text-ink tracking-tight">{title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-stone-600">{text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <section id="report" className="py-24 bg-cream overflow-hidden">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8 items-center"
          >
            <motion.div variants={fadeUp}>
              <p className="text-sm font-semibold uppercase tracking-widest text-moss mb-3">
                Actionable Feedback
              </p>
              <h2 className="text-4xl font-serif tracking-tight text-ink sm:text-5xl leading-tight">
                Finish the call with a serious performance report.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-stone-600">
                The final page separates technical depth, clarity, confidence,
                role fit, resume relevance, and improvement priorities so the
                next practice round has a clear purpose.
              </p>
              <div className="mt-8 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-moss" size={20} />
                  <p className="text-stone-700">Detailed breakdown of matched skills vs missing skills.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-moss" size={20} />
                  <p className="text-stone-700">Audio playback and transcript review for every answer.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-moss" size={20} />
                  <p className="text-stone-700">A personalized 4-week learning roadmap based on weak areas.</p>
                </div>
              </div>
            </motion.div>
            <motion.div 
              variants={fadeUp}
              className="rounded-2xl border border-stone-200 bg-white p-8 shadow-medium relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-moss via-skyline to-coral"></div>
              <div className="mb-6 pb-6 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-500">Overall Score</p>
                  <p className="text-4xl font-serif text-ink mt-1">78<span className="text-lg text-stone-400">/100</span></p>
                </div>
                <div className="h-16 w-16 rounded-full border-4 border-moss flex items-center justify-center text-moss font-bold bg-moss/5">
                  Good
                </div>
              </div>
              <div className="grid gap-5">
                {[
                  ["Technical", 78, "bg-skyline"],
                  ["Communication", 72, "bg-gold"],
                  ["Confidence", 66, "bg-coral"],
                  ["Resume relevance", 84, "bg-moss"],
                ].map(([label, value, color], i) => (
                  <div key={label} className="">
                    <div className="mb-2 flex items-center justify-between text-sm font-medium">
                      <span className="text-stone-700">{label}</span>
                      <span className="text-ink font-bold">{value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${value}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                        className={`h-full rounded-full ${color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </section>
      </main>
      
      <footer className="border-t border-black/5 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-stone-500">
          <div className="flex justify-center items-center gap-2 mb-4">
            <BriefcaseBusiness size={20} className="text-moss" />
            <span className="font-serif font-bold text-ink text-base">interview_agent</span>
          </div>
          <p>© {new Date().getFullYear()} AI Interview Prep. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

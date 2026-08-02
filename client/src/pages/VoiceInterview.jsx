import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import {
  MicOff,
  Send,
  Loader2,
  Radio,
  Volume2,
  Waves,
  Clock,
  Download,
  History,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import api from "../lib/api.js";
import {
  joinInterviewSession,
  submitTextAnswer,
  fetchInterviewSession,
} from "../lib/interviewApi.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import AgentAvatar from "../components/interview/AgentAvatar.jsx";
import CandidateProfileBar from "../components/interview/CandidateProfileBar.jsx";
import ConversationPanel from "../components/interview/ConversationPanel.jsx";
import InterviewAnalyticsPanel from "../components/interview/InterviewAnalyticsPanel.jsx";

const MIN_ANSWER_MS = 15_000;

function getQuestionText(q) {
  if (!q) return "";
  if (typeof q === "string" || typeof q === "number" || typeof q === "boolean") return String(q);
  return textFrom(q.question || q.text || q.prompt || q, "");
}

function browserSpeech() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

let selectedSarahVoice = null;
function pickFemaleVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (selectedSarahVoice && voices.some((voice) => voice.name === selectedSarahVoice.name)) {
    return selectedSarahVoice;
  }
  selectedSarahVoice =
    voices.find((v) => /aria|jenny|zira|samantha|nova|female/i.test(v.name) && /^en/i.test(v.lang || "")) ||
    voices.find((v) => /samantha|zira|jenny|aria|nova|female/i.test(v.name)) ||
    voices.find((v) => v.lang?.startsWith("en")) ||
    voices[0] ||
    null;
  return selectedSarahVoice;
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function asArray(value) {
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
    const preferred = value.question || value.prompt || value.title || value.area || value.category || value.action || value.description || value.summary || value.text || value.value;
    if (preferred && preferred !== value) return textFrom(preferred);
    return Object.entries(value)
      .map(([key, val]) => `${key.replace(/_/g, " ")}: ${textFrom(val)}`)
      .join("; ");
  }
  return fallback;
}

function safeList(value) {
  return asArray(value).map((item) => textFrom(item)).filter(Boolean);
}

function stripRepeatedPrefix(text) {
  const words = String(text || "").trim().split(/\s+/);
  if (words.length < 6) return text;
  for (let size = 1; size <= 4; size += 1) {
    const first = words.slice(0, size).join(" ").toLowerCase();
    const second = words.slice(size, size * 2).join(" ").toLowerCase();
    if (first && first === second) {
      return words.slice(size).join(" ");
    }
  }
  return text;
}

function normalizeTranscript(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

function mergeTranscript(existing, incoming) {
  const current = normalizeTranscript(existing);
  const next = normalizeTranscript(incoming);
  if (!next) return current;
  if (!current) return next;

  const currentLower = current.toLowerCase();
  const nextLower = next.toLowerCase();
  if (currentLower.endsWith(nextLower) || currentLower.includes(nextLower)) return current;

  const currentWords = current.split(/\s+/);
  const nextWords = next.split(/\s+/);
  const maxOverlap = Math.min(currentWords.length, nextWords.length, 12);
  for (let size = maxOverlap; size > 0; size -= 1) {
    const tail = currentWords.slice(-size).join(" ").toLowerCase();
    const head = nextWords.slice(0, size).join(" ").toLowerCase();
    if (tail === head) {
      return normalizeTranscript(`${current} ${nextWords.slice(size).join(" ")}`);
    }
  }
  return normalizeTranscript(`${current} ${next}`);
}

function LiveFeedbackPanel({ lastEval, candidateName }) {
  const evaluation = lastEval?.evaluation || {};
  const score = Math.round(Number(lastEval?.score) || 0);
  const improvements = [
    ...safeList(evaluation.weak_areas),
    ...safeList(evaluation.suggestions),
    ...safeList(evaluation.how_to_improve),
    ...safeList(evaluation.improvements),
    ...safeList(evaluation.next_steps),
  ].filter(Boolean).slice(0, 6);
  const fallbackImprovements = [
    "Add one specific example from your project or work experience.",
    "Explain the trade-offs behind your chosen approach.",
    "Close with the measurable outcome, impact, or lesson learned.",
  ];

  const scoreColor = score >= 80 ? "text-emerald-300" : score >= 60 ? "text-amber-300" : "text-red-400";
  const scoreBg = score >= 80 ? "border-emerald-500/30 bg-emerald-500/10" : score >= 60 ? "border-amber-500/30 bg-amber-500/10" : "border-red-500/30 bg-red-500/10";

  if (!lastEval) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-300 mb-3">📊 Live Statistics</p>
        <p className="text-sm text-slate-400">
          Speak and submit each answer. Sarah will evaluate the complete interview after the final question and build your report statistics from all answers.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
            📊 Live Statistics {candidateName ? `— ${candidateName}` : ""}
          </p>
          <h3 className={`mt-1 text-2xl font-bold ${scoreColor}`}>
            {score}/100
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Answer score</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ["Technical", evaluation.technical_correctness],
            ["Clarity", evaluation.communication_clarity],
            ["Confidence", evaluation.confidence],
          ].map(([label, value]) => {
            const v = Math.round(Number(value) || 0);
            const c = v >= 70 ? "text-emerald-300" : v >= 50 ? "text-amber-300" : "text-red-400";
            return (
              <div key={label} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2">
                <p className="text-slate-500">{label}</p>
                <p className={`text-lg font-bold ${c}`}>{v}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score progress bar */}
      <div className="mb-4">
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${score >= 80 ? "bg-emerald-400" : score >= 60 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {evaluation.technical_breakdown && (
        <p className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm leading-6 text-cyan-50">
          {textFrom(evaluation.technical_breakdown)}
        </p>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">⚡ Areas to Improve</p>
        <div className="grid gap-2">
          {(improvements.length ? improvements : fallbackImprovements).map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-50 flex gap-2">
              <span className="text-amber-400 shrink-0">•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VoiceInterview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const socketRef = useRef(null);
  const [socketReady, setSocketReady] = useState(false);
  const [socketError, setSocketError] = useState("");
  const [useRestMode, setUseRestMode] = useState(false);

  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [candidateName, setCandidateName] = useState("Candidate");
  const [interviewRole, setInterviewRole] = useState("Pending");
  const [resumeScore, setResumeScore] = useState(0);
  const [sessionStatus, setSessionStatus] = useState("in_progress");
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);

  const [callStage, setCallStage] = useState("idle");
  const [agentLine, setAgentLine] = useState("");
  const [userLine, setUserLine] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");

  const [agentStatus, setAgentStatus] = useState("idle");
  const [manualText, setManualText] = useState("");
  const [lastEval, setLastEval] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [confirmedRole, setConfirmedRole] = useState("");
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [error, setError] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioHasInput, setAudioHasInput] = useState(false);

  const recognitionRef = useRef(null);
  const speechSegmentsRef = useRef([]);
  const liveTextRef = useRef("");
  const committedTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const mediaRecorderRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const previewChunksRef = useRef([]);
  const previewBusyRef = useRef(false);
  const previewTextRef = useRef("");
  const previewTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioFrameRef = useRef(null);
  const audioHasInputRef = useRef(false);
  const lastAudioAtRef = useRef(0);
  const answerStartedAtRef = useRef(0);
  const serverAudioSubmittingRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const welcomePlayedRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const audioRef = useRef(null);
  const autoModeRef = useRef(false);
  const agentStatusRef = useRef("idle");
  const agentSpeakingRef = useRef(false);
  const questionIndexRef = useRef(0);
  const lastQuestionKeyRef = useRef("");
  const submitAnswerRef = useRef(null);
  const startRecognitionRef = useRef(null);
  const callStageRef = useRef("idle");
  const intentionallyStoppingRecognitionRef = useRef(false);
  const recognitionRunIdRef = useRef(0);
  const reportPollTimerRef = useRef(null);
  autoModeRef.current = autoMode;
  agentStatusRef.current = agentStatus;
  callStageRef.current = callStage;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const beginSubmit = useCallback(() => {
    if (submitInFlightRef.current) return false;
    submitInFlightRef.current = true;
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    setIsSubmitting(true);
    return true;
  }, []);

  const endSubmit = useCallback(() => {
    submitInFlightRef.current = false;
    serverAudioSubmittingRef.current = false;
    setIsSubmitting(false);
  }, []);

  const stopReportPolling = useCallback(() => {
    window.clearInterval(reportPollTimerRef.current);
    reportPollTimerRef.current = null;
  }, []);

  const startReportPolling = useCallback(() => {
    if (reportPollTimerRef.current || !sessionId) return;
    const poll = async () => {
      try {
        const { data } = await api.get(`/api/interview/result/${sessionId}`);
        if (data?.finalReport) {
          stopReportPolling();
          navigate(`/report/${sessionId}`, { state: { report: data.finalReport } });
        }
      } catch {
        // Report is not ready yet.
      }
    };
    reportPollTimerRef.current = window.setInterval(poll, 4000);
    poll();
  }, [navigate, sessionId, stopReportPolling]);

  const roleDisplay = confirmedRole || interviewRole;
  const canSubmitAnswer =
    Boolean(userLine?.trim() || manualText.trim() || liveTranscript.trim()) &&
    !isSubmitting &&
    agentStatus !== "evaluating" &&
    callStage !== "agent";

  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const applySessionContext = useCallback((ctx) => {
    if (!ctx) return;
    if (ctx.candidateName) setCandidateName(ctx.candidateName);
    if (ctx.interviewRole) setInterviewRole(ctx.interviewRole);
    if (ctx.resumeScore != null && ctx.resumeScore > 0) setResumeScore(ctx.resumeScore);
    if (ctx.sessionStatus) setSessionStatus(ctx.sessionStatus);
    if (ctx.questionIndex != null) {
      setQuestionIndex(ctx.questionIndex);
      questionIndexRef.current = ctx.questionIndex;
    }
    if (ctx.totalQuestions) setTotalQuestions(ctx.totalQuestions);
  }, []);

  useEffect(() => {
    welcomePlayedRef.current = sessionStorage.getItem(`sarah-welcomed:${sessionId}`) === "true";
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    fetchInterviewSession(sessionId)
      .then((data) => {
        if (data.candidateName) setCandidateName(data.candidateName);
        if (data.interviewRole) setInterviewRole(data.interviewRole);
        if (data.session?.status) setSessionStatus(data.session.status);
        if (data.evaluating || data.session?.status === "evaluating") {
          setCallStage("processing");
          setAgentStatus("evaluating");
          setUserLine(data.message || "Sarah is preparing your final interview evaluation...");
          startReportPolling();
        }
        if (data.resumeScore != null && data.resumeScore > 0) setResumeScore(data.resumeScore);
        if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
        if (data.questionIndex != null) {
          setQuestionIndex(data.questionIndex);
          questionIndexRef.current = data.questionIndex;
        }
      })
      .catch(() => {});
  }, [sessionId, startReportPolling]);

  const playAudio = useCallback((url, onEnd) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      audioRef.current = null;
      onEnd?.();
    };
    audio.onerror = () => {
      audioRef.current = null;
      onEnd?.();
    };
    audio.play().catch(() => onEnd?.());
  }, []);

  const speakBrowser = useCallback((text, onEnd) => {
    if (!window.speechSynthesis || !text) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voice = pickFemaleVoice();
    if (voice) utt.voice = voice;
    utt.rate = 0.93;
    utt.pitch = 1.05;
    utt.onend = onEnd;
    utt.onerror = onEnd;
    window.speechSynthesis.speak(utt);
  }, []);

  function stopAudioCapture({ keepChunks = false } = {}) {
    window.clearInterval(previewTimerRef.current);
    previewTimerRef.current = null;
    if (audioFrameRef.current) {
      window.cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    if (!keepChunks) {
      audioChunksRef.current = [];
      previewChunksRef.current = [];
      previewTextRef.current = "";
      audioHasInputRef.current = false;
      lastAudioAtRef.current = 0;
      setAudioHasInput(false);
    }
  }

  async function startAudioCapture() {
    if (!navigator.mediaDevices?.getUserMedia || mediaRecorderRef.current?.state === "recording") return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    micStreamRef.current = stream;
    audioChunksRef.current = [];
    previewChunksRef.current = [];
    previewTextRef.current = "";
    audioHasInputRef.current = false;
    answerStartedAtRef.current = Date.now();
    setAudioHasInput(false);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        audioChunksRef.current.push(event.data);
        previewChunksRef.current.push(event.data);
      }
    };
    recorder.start(500);
    mediaRecorderRef.current = recorder;
    window.clearInterval(previewTimerRef.current);
    previewTimerRef.current = null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    const watchLevel = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) {
        const centered = value - 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / samples.length);
      const now = Date.now();
      if (rms > 9) {
        lastAudioAtRef.current = now;
        if (!audioHasInputRef.current) {
          audioHasInputRef.current = true;
          setAudioHasInput(true);
        }
        if (!liveTextRef.current) {
          setLiveTranscript("I can hear you. Waiting for browser speech text...");
        }
      }
      audioFrameRef.current = window.requestAnimationFrame(watchLevel);
    };
    audioFrameRef.current = window.requestAnimationFrame(watchLevel);
  }

  function stopRecognition() {
    clearTimeout(silenceTimerRef.current);
    intentionallyStoppingRecognitionRef.current = true;
    recognitionRunIdRef.current += 1;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopAudioCapture({ keepChunks: true });
  }

  const startRecognition = useCallback((options = {}) => {
    const preserveTranscript = options.preserveTranscript === true;
    const preserveAudio = options.preserveAudio === true;

    if (!preserveAudio) {
      stopRecognition();
    }

    if (!preserveTranscript) {
      liveTextRef.current = '';
      committedTextRef.current = '';
      finalTranscriptRef.current = '';
      speechSegmentsRef.current = [];
      previewTextRef.current = '';
      previewChunksRef.current = [];
    }
    setCallStage('user');
    if (!preserveTranscript) {
      setUserLine('');
      setLiveTranscript('');
    }
    if (!preserveTranscript) setAudioHasInput(false);
    setError('');
    intentionallyStoppingRecognitionRef.current = false;
    const recognitionRunId = recognitionRunIdRef.current + 1;
    recognitionRunIdRef.current = recognitionRunId;

    if (!preserveAudio) {
      // Audio capture is used only for the local speaking indicator; answer text comes from browser SpeechRecognition or typed input.
      startAudioCapture().catch((err) => {
        setError('Microphone permission failed: ' + err.message + '. Allow microphone access, then press Start voice interview.');
        setAutoMode(false);
      });
    }

    setAgentStatus('listening');

    // Browser SpeechRecognition is the only speech-to-text path; typed text remains the fallback.
    const Recognition = browserSpeech();
    if (!Recognition) return;

    try {
      const rec = new Recognition();
      rec.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-IN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        const segments = speechSegmentsRef.current;
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const phrase = normalizeTranscript(e.results[i][0]?.transcript || '');
          segments[i] = {
            text: phrase,
            final: Boolean(e.results[i].isFinal),
          };
        }

        const final = normalizeTranscript(segments.filter((segment) => segment?.final).map((segment) => segment.text).join(' '));
        const interim = normalizeTranscript(segments.filter((segment) => segment && !segment.final).map((segment) => segment.text).join(' '));
        const combined = normalizeTranscript(`${final} ${interim}`);
        finalTranscriptRef.current = final;
        committedTextRef.current = final;
        if (combined) {
          liveTextRef.current = combined;
          setUserLine(combined);
          setLiveTranscript(combined);
          setAudioHasInput(true);
        }

        if (agentStatusRef.current === 'speaking') {
          audioRef.current?.pause();
          window.speechSynthesis?.cancel();
          setAgentLine('');
          setCallStage('user');
          setAgentStatus('listening');
        }

        clearTimeout(silenceTimerRef.current);
      };

      rec.onerror = (ev) => {
        if (ev.error === 'no-speech') return;
        if (ev.error !== 'aborted') {
          recognitionRef.current = null;
          console.warn('Browser speech recognition error:', ev.error);
        }
      };

      rec.onend = () => {
        recognitionRef.current = null;
        if (
          recognitionRunIdRef.current === recognitionRunId &&
          !intentionallyStoppingRecognitionRef.current &&
          !submitInFlightRef.current &&
          agentStatusRef.current === 'listening' &&
          callStageRef.current === 'user'
        ) {
          window.setTimeout(() => {
            if (!submitInFlightRef.current && callStageRef.current === 'user') {
              startRecognitionRef.current?.({ preserveTranscript: true, preserveAudio: true });
            }
          }, 300);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      recognitionRef.current = null;
    }
  }, []);

  const handleQuestion = useCallback(
    (payload) => {
      const idx = payload.questionIndex ?? 0;
      const rawQuestionText = getQuestionText(payload.question);
      const questionKey = `${idx}:${rawQuestionText}`;
      if (lastQuestionKeyRef.current === questionKey && callStageRef.current !== "idle") {
        return;
      }
      lastQuestionKeyRef.current = questionKey;
      endSubmit();
      setGeneratingQuestions(false);
      setError("");
      setQuestion(payload.question);
      setQuestionIndex(idx);
      questionIndexRef.current = idx;
      setTotalQuestions(payload.totalQuestions ?? 1);
      setCandidateName(payload.candidateName || "Candidate");
      setInterviewRole((prev) => payload.interviewRole || prev);
      setTtsAudioUrl(payload.ttsAudioUrl || null);
      setSessionStatus("in_progress");

      const qText =
        payload.questionIndex === 0
          ? rawQuestionText
              .replace(/^Hello\s+[^!]+!\s+I am Sarah,\s+your AI interviewer\.\s*/i, "")
              .replace(/^Before we dive/i, "Before we dive")
          : rawQuestionText;
      const shouldWelcome =
        payload.questionIndex === 0 && payload.openingMessage && !welcomePlayedRef.current;
      const cleanQText = stripRepeatedPrefix(qText);
      const fullAgent = shouldWelcome ? `${payload.openingMessage}\n\n${cleanQText}` : cleanQText;
      if (shouldWelcome) {
        welcomePlayedRef.current = true;
        sessionStorage.setItem(`sarah-welcomed:${sessionId}`, "true");
      }

      setUserLine("");
      setLiveTranscript("");
      liveTextRef.current = "";
      committedTextRef.current = "";
      finalTranscriptRef.current = "";
      speechSegmentsRef.current = [];
      setAgentLine(fullAgent);
      setCallStage("agent");
      setAgentStatus("speaking");
      agentSpeakingRef.current = true;

      const onQuestionSpoken = () => {
        agentSpeakingRef.current = false;
        setCallStage("user");
        setUserLine("");
        setLiveTranscript("");
        setAgentStatus("listening");
        if (autoModeRef.current || payload.question?.type === "Setup" || payload.questionIndex === 0) {
          startRecognition();
        }
      };

      speakBrowser(fullAgent, onQuestionSpoken);

      if (payload.questionIndex === 0 && !autoModeRef.current) setAutoMode(true);
    },
    [sessionId, speakBrowser, startRecognition, endSubmit]
  );

  const processRestAnswer = useCallback(
    async (text) => {
      setUserLine(text);
      setCallStage("processing");
      setAgentStatus("transcribing");
      try {
        const data = await submitTextAnswer(sessionId, text, questionIndexRef.current);
        if (data.evaluation) setLastEval(data.evaluation);
        if (data.metrics) setMetrics(data.metrics);
        if (data.completed) {
          navigate(`/report/${sessionId}`, { state: { report: data.finalReport } });
          return;
        }
        if (data.preparing) {
          setGeneratingQuestions(true);
          setUserLine("Preparing your personalized interview questions...");
          setAgentStatus("evaluating");
        }
        if (data.roleConfirmed) {
          setConfirmedRole(data.roleConfirmed);
          setInterviewRole(data.roleConfirmed);
          setGeneratingQuestions(false);
        }
        applySessionContext(data.sessionContext);
        if (data.question) handleQuestion(data.question);
      } catch (err) {
        setError(err.message);
        setCallStage("user");
        setAgentStatus("listening");
      } finally {
        endSubmit();
      }
    },
    [sessionId, navigate, applySessionContext, handleQuestion, endSubmit]
  );

  const joinViaRest = useCallback(async () => {
    try {
      setSocketError("");
      const data = await joinInterviewSession(sessionId);
      setUseRestMode(true);
      setSocketReady(true);
      if (data.completed) {
        navigate(`/report/${sessionId}`);
        return;
      }
      applySessionContext(data.sessionContext);
      if (data.evaluating) {
        setCallStage("processing");
        setAgentStatus("evaluating");
        setUserLine(data.message || "Sarah is preparing your final interview evaluation...");
        startReportPolling();
        return;
      }
      if (data.question) handleQuestion(data.question);
    } catch (err) {
      setError(err.message || "Failed to join interview");
      setCallStage("idle");
    }
  }, [sessionId, navigate, applySessionContext, handleQuestion, startReportPolling]);

  const submitLiveAnswer = useCallback(() => {
    const text = normalizeTranscript(liveTextRef.current || finalTranscriptRef.current || userLine || "");
    if (!text && audioHasInputRef.current) {
      setError("I can hear the microphone, but Chrome has not produced text yet. Please speak again or type the answer, then click Submit.");
      return;
    }
    if (!text || !beginSubmit()) return;
    stopRecognition();
    liveTextRef.current = "";
    committedTextRef.current = "";
    finalTranscriptRef.current = "";
    speechSegmentsRef.current = [];
    setLiveTranscript("");
    setUserLine(text);
    setCallStage("processing");
    setAgentStatus("transcribing");

    if (useRestMode || !socketRef.current?.connected) {
      processRestAnswer(text);
      return;
    }
    socketRef.current.emit("interview:textAnswer", {
      sessionId,
      questionIndex: questionIndexRef.current,
      transcription: text,
    });
  }, [sessionId, useRestMode, processRestAnswer, userLine, beginSubmit]);

  submitAnswerRef.current = submitLiveAnswer;
  startRecognitionRef.current = startRecognition;

  useEffect(() => {
    let socket;
    let joined = false;
    let restFallbackTimer;
    let cancelled = false;

    const joinSession = () => {
      if (joined || !socket?.connected || !sessionId) return;
      joined = true;
      setSocketError("");
      setUseRestMode(false);
      socket.emit("interview:join", { sessionId });
    };

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setSocketError("Not authenticated.");
        return;
      }
      if (cancelled) return;

      const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
      socket = io(`${base}/interview`, {
        auth: { token },
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 10,
        timeout: 15000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setSocketReady(true);
        setSocketError("");
        joinSession();
      });

      socket.on("connect_error", () => {
        setSocketReady(false);
        joinViaRest();
      });

      socket.on("disconnect", () => {
        setSocketReady(false);
        joined = false;
      });

      socket.on("interview:sessionContext", applySessionContext);
      socket.on("interview:question", handleQuestion);

      socket.on("interview:ttsReady", (payload) => {
        if (payload.questionIndex != null && payload.questionIndex !== questionIndexRef.current) return;
        setTtsAudioUrl(payload.ttsAudioUrl);
      });

      socket.on("interview:speaking", (payload) => {
        if (payload?.status === "preparing") {
          setGeneratingQuestions(true);
          setCallStage("processing");
          setUserLine("Preparing your personalized interview questions...");
          setAgentStatus("evaluating");
          agentSpeakingRef.current = false;
          return;
        }
        setGeneratingQuestions(false);
      });

      socket.on("interview:roleConfirmed", ({ role }) => {
        setConfirmedRole(role || "");
        setInterviewRole(role || "");
        setGeneratingQuestions(false);
      });

      socket.on("interview:transcribing", (payload) => {
        if (payload?.transcription) {
          setUserLine(payload.transcription);
          setLiveTranscript(payload.transcription);
        }
        setCallStage("processing");
        setAgentStatus("transcribing");
        agentSpeakingRef.current = false;
      });

      socket.on("interview:answerSaved", ({ transcription }) => {
        if (transcription) {
          setUserLine(transcription);
          setLiveTranscript(transcription);
        }
        socket.emit("interview:getMetrics", { sessionId });
      });

      socket.on("interview:answerRecorded", ({ message }) => {
        setAgentStatus("transcribing");
        setCallStage("processing");
        if (message) setUserLine(message);
      });

      socket.on("interview:answerEvaluated", (payload) => {
        setLastEval(payload);
        setAgentStatus("evaluating");
        setCallStage("processing");
        socket.emit("interview:getMetrics", { sessionId });
      });

      socket.on("interview:metrics", (payload) => {
        setMetrics(payload);
      });

      socket.on("interview:evaluating", () => {
        endSubmit();
        setSessionStatus("evaluating");
        setCallStage("processing");
        setAgentStatus("evaluating");
        agentSpeakingRef.current = false;
        stopRecognition();
        socket.emit("interview:getMetrics", { sessionId });
        startReportPolling();
      });

      socket.on("interview:reportReady", ({ sessionId: sid, finalReport }) => {
        endSubmit();
        stopReportPolling();
        setSessionStatus("completed");
        navigate(`/report/${sid}`, { state: { report: finalReport } });
      });

      socket.on("interview:error", ({ message }) => {
        endSubmit();
        setError(message);
        setAgentStatus("idle");
        setCallStage("idle");
        agentSpeakingRef.current = false;
      });

      socket.on("interview:answerProcessing", ({ message }) => {
        setCallStage("processing");
        setAgentStatus("evaluating");
        setUserLine(message || "This answer is already being evaluated.");
      });

      socket.on("interview:staleAnswerIgnored", ({ message }) => {
        endSubmit();
        setError(message || "That answer was already processed.");
      });

      restFallbackTimer = window.setTimeout(() => {
        if (!joined) joinViaRest();
      }, 5000);
    })();

    return () => {
      cancelled = true;
      joined = true;
      clearTimeout(restFallbackTimer);
      stopReportPolling();
      stopRecognition();
      socket?.disconnect();
    };
  }, [sessionId, navigate, handleQuestion, startRecognition, applySessionContext, joinViaRest, endSubmit, startReportPolling, stopReportPolling]);

  function submitAnswerNow() {
    const text = normalizeTranscript(manualText || liveTextRef.current || finalTranscriptRef.current || userLine);
    if (!text && audioHasInputRef.current) {
      setError("I can hear the microphone, but Chrome has not produced text yet. Please speak again or type the answer, then click Submit.");
      return;
    }
    if (!text || !beginSubmit()) return;
    setManualText("");
    liveTextRef.current = text;
    committedTextRef.current = text;
    finalTranscriptRef.current = text;
    speechSegmentsRef.current = [{ text, final: true }];
    stopRecognition();
    setUserLine(text);
    setCallStage("processing");
    setAgentStatus("transcribing");
    if (useRestMode || !socketRef.current?.connected) {
      processRestAnswer(text);
    } else {
      socketRef.current.emit("interview:textAnswer", {
        sessionId,
        questionIndex: questionIndexRef.current,
        transcription: text,
      });
    }
  }

  function submitManual() {
    const text = manualText.trim();
    if (!text || agentStatus === 'evaluating' || !beginSubmit()) return;
    setManualText("");
    liveTextRef.current = text;
    committedTextRef.current = text;
    finalTranscriptRef.current = text;
    speechSegmentsRef.current = [{ text, final: true }];
    setUserLine(text);
    setLiveTranscript(text);
    stopRecognition();
    setCallStage("processing");
    setAgentStatus("transcribing");
    if (useRestMode || !socketRef.current?.connected) {
      processRestAnswer(text);
    } else {
      socketRef.current.emit("interview:textAnswer", {
        sessionId,
        questionIndex: questionIndexRef.current,
        transcription: text,
      });
    }
  }

  function toggleAutoMode() {
    if (!autoMode) {
      setAutoMode(true);
      startRecognition();
    } else {
      setAutoMode(false);
      stopRecognition();
      stopAudioCapture();
    }
  }

  function replayQuestion() {
    const text = agentLine || getQuestionText(question);
    setCallStage("agent");
    setAgentLine(text);
    setUserLine("");
    setLiveTranscript("");
    liveTextRef.current = "";
    committedTextRef.current = "";
    finalTranscriptRef.current = "";
    speechSegmentsRef.current = [];
    setAgentStatus("speaking");
    const onDone = () => {
      setAgentLine("");
      setCallStage("user");
      setAgentStatus("listening");
      if (autoModeRef.current) startRecognition();
    };
    speakBrowser(text, onDone);
  }

  const progress =
    totalQuestions > 0 ? Math.round(((questionIndex + 1) / totalQuestions) * 100) : 0;

  const speaking = agentStatus === "speaking";
  const thinking =
    agentStatus === "evaluating" ||
    agentStatus === "transcribing" ||
    generatingQuestions;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="-mx-4 -mt-6 min-h-[calc(100vh-4rem)] bg-slate-950 px-4 pb-24 pt-4 text-white sm:-mx-6 lg:-mx-8"
    >
      <motion.div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(99,102,241,0.15),transparent_50%)]"
        aria-hidden
      />

      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <AgentAvatar speaking={speaking} thinking={thinking && !speaking} />
          <CandidateProfileBar
            name={candidateName}
            email={user?.email}
            avatarUrl={user?.user_metadata?.avatar_url}
            resumeScore={resumeScore}
            role={roleDisplay}
            sessionStatus={sessionStatus}
            questionIndex={questionIndex}
            totalQuestions={totalQuestions}
          />
        </header>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
              <Clock size={14} className="text-violet-400" />
              {formatTimer(elapsed)}
            </span>
            <span className="text-xs text-slate-500">Voice transcript now, full evaluation after all questions</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Available after report is generated"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-500"
            >
              <Download size={14} />
              PDF report
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              <History size={14} />
              History
            </button>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                socketReady ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
              }`}
            >
              <Radio size={12} />
              {socketReady ? (useRestMode ? "Connected (HTTP)" : "Connected") : "Offline"}
            </span>
            {!socketReady && (
              <button
                type="button"
                onClick={joinViaRest}
                className="rounded-lg border border-violet-500/40 bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/30"
              >
                Retry connect
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {(error || socketError) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              {error || socketError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-3">
          <motion.div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </motion.div>
          <p className="mt-1 text-right text-xs text-slate-500">
            Question {questionIndex + 1} of {totalQuestions || "..."} - {progress}%
          </p>
        </div>

        <div className="space-y-4">
          <motion.div className="space-y-4">
            <ConversationPanel
              callStage={callStage}
              agentLine={agentLine}
              userLine={liveTranscript || userLine}
              agentStatus={agentStatus}
            />

            <motion.div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleAutoMode}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    autoMode
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  {autoMode ? <MicOff size={16} /> : <Waves size={16} />}
                  {autoMode ? "Stop microphone" : "Start voice interview"}
                </button>
                <button
                  type="button"
                  onClick={replayQuestion}
                  disabled={!question}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40"
                >
                  <Volume2 size={16} />
                  Replay
                </button>
                <button
                  type="button"
                  onClick={submitAnswerNow}
                  disabled={!canSubmitAnswer}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Submit answer
                </button>
              </div>
              <p className="text-xs text-slate-500">
              Each answer is saved now. Evaluation runs after the final question.
              </p>
            </motion.div>

            <motion.div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Text fallback
              </p>
              <div className="flex gap-2">
                <textarea
                  className="min-h-[72px] flex-1 resize-none rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  placeholder="Type if microphone is unavailable..."
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                />
                <button
                  type="button"
                  onClick={submitManual}
                  disabled={!manualText.trim() || agentStatus === "transcribing"}
                  className="flex items-center gap-2 self-end rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {agentStatus === "transcribing" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Send
                </button>
              </div>
            </motion.div>
          </motion.div>

          <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
            <InterviewAnalyticsPanel metrics={metrics} lastEval={lastEval} />
            <LiveFeedbackPanel lastEval={lastEval} candidateName={candidateName} />
          </section>
        </div>
      </div>
    </motion.div>
  );
}

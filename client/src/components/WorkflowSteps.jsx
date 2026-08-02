import clsx from "clsx";
import {
  BarChart3,
  CheckCircle2,
  FileUp,
  Mic2,
  Trophy,
} from "lucide-react";

const steps = [
  { key: "upload", label: "Resume Upload", icon: FileUp },
  { key: "ats", label: "ATS Score", icon: BarChart3 },
  { key: "interview", label: "Voice Interview", icon: Mic2 },
  { key: "report", label: "Final Report", icon: Trophy },
];

export default function WorkflowSteps({ current = "upload", completed = [] }) {
  const currentIndex = steps.findIndex((step) => step.key === current);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isDone = completed.includes(step.key) || index < currentIndex;
          const isActive = step.key === current;

          return (
            <div
              key={step.key}
              className={clsx(
                "flex min-h-20 items-center gap-3 rounded-lg border px-3 py-3",
                isActive && "border-moss/30 bg-moss/5 text-moss",
                isDone && !isActive && "border-skyline/25 bg-skyline/5 text-skyline",
                !isActive && !isDone && "border-stone-200 bg-stone-50 text-stone-500"
              )}
            >
              <div
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-white",
                  isActive && "border-moss/25",
                  isDone && !isActive && "border-skyline/20",
                  !isActive && !isDone && "border-stone-200"
                )}
              >
                {isDone ? <CheckCircle2 size={19} /> : <Icon size={19} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                  Step {index + 1}
                </p>
                <p className="truncate font-bold">{step.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const CALIBRATION_STEPS = [
  "Target Based Data Collection",
  "Vehicle Run Offload",
  "Target-Based Calibration Monitoring (Submitted)",
  "PR Generated [Need Review & Merge]",
  "PR Approved and Merged",
  "1-HR Targetless DC",
  "Data Ingestion",
  "Targetless PR Generated [Need Review & Merge]",
] as const;

export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const STEP_COLORS: Record<
  StepIndex,
  { dot: string; badge: string; row: string }
> = {
  0: {
    dot: "bg-sky-500",
    badge: "bg-sky-100 text-sky-900 border-sky-200",
    row: "bg-sky-50/80",
  },
  1: {
    dot: "bg-blue-600",
    badge: "bg-blue-100 text-blue-900 border-blue-200",
    row: "bg-blue-50/80",
  },
  2: {
    dot: "bg-indigo-500",
    badge: "bg-indigo-100 text-indigo-900 border-indigo-200",
    row: "bg-indigo-50/80",
  },
  3: {
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-900 border-violet-200",
    row: "bg-violet-50/80",
  },
  4: {
    dot: "bg-fuchsia-500",
    badge: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
    row: "bg-fuchsia-50/80",
  },
  5: {
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-950 border-amber-200",
    row: "bg-amber-50/80",
  },
  6: {
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-900 border-orange-200",
    row: "bg-orange-50/80",
  },
  7: {
    dot: "bg-emerald-600",
    badge: "bg-emerald-100 text-emerald-900 border-emerald-200",
    row: "bg-emerald-50/80",
  },
};

export function nextStepLabel(stepIndex: StepIndex): string | null {
  if (stepIndex >= CALIBRATION_STEPS.length - 1) {
    return "Calibration Completed";
  }
  return CALIBRATION_STEPS[stepIndex + 1] ?? null;
}

export function prevStepLabel(stepIndex: StepIndex): string | null {
  if (stepIndex <= 0) return null;
  return CALIBRATION_STEPS[stepIndex - 1] ?? null;
}

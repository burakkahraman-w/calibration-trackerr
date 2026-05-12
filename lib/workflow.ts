/** Default labels (used before DB migration and for in-memory dev). */
export const DEFAULT_CALIBRATION_STEPS = [
  "Target Based Data Collection",
  "Vehicle Run Offload",
  "Target-Based Calibration Monitoring (Submitted)",
  "PR Generated [Need Review & Merge]",
  "PR Approved and Merged",
  "1-HR Targetless DC",
  "Data Ingestion",
  "Targetless PR Generated [Need Review & Merge]",
] as const;

/** @deprecated use DEFAULT_CALIBRATION_STEPS */
export const CALIBRATION_STEPS = DEFAULT_CALIBRATION_STEPS;

const PALETTE = [
  { dot: "bg-sky-500", badge: "bg-sky-100 text-sky-900 border-sky-200", row: "bg-sky-50/80" },
  { dot: "bg-blue-600", badge: "bg-blue-100 text-blue-900 border-blue-200", row: "bg-blue-50/80" },
  { dot: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-900 border-indigo-200", row: "bg-indigo-50/80" },
  { dot: "bg-violet-500", badge: "bg-violet-100 text-violet-900 border-violet-200", row: "bg-violet-50/80" },
  { dot: "bg-fuchsia-500", badge: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200", row: "bg-fuchsia-50/80" },
  { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-950 border-amber-200", row: "bg-amber-50/80" },
  { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-900 border-orange-200", row: "bg-orange-50/80" },
  { dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-900 border-emerald-200", row: "bg-emerald-50/80" },
] as const;

/** Cycle colors for arbitrary step counts. */
export function stepColorsAt(stepIndex: number): (typeof PALETTE)[number] {
  const i = ((stepIndex % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[i]!;
}

/** @deprecated use stepColorsAt(stepIndex) */
export const STEP_COLORS = {
  0: PALETTE[0],
  1: PALETTE[1],
  2: PALETTE[2],
  3: PALETTE[3],
  4: PALETTE[4],
  5: PALETTE[5],
  6: PALETTE[6],
  7: PALETTE[7],
} as const;

export function nextStepLabel(steps: readonly string[], stepIndex: number): string | null {
  if (steps.length === 0) return null;
  if (stepIndex >= steps.length - 1) {
    return "Calibration Completed";
  }
  return steps[stepIndex + 1] ?? null;
}

export function prevStepLabel(steps: readonly string[], stepIndex: number): string | null {
  if (stepIndex <= 0) return null;
  return steps[stepIndex - 1] ?? null;
}

export function isValidStepIndex(stepsLength: number, stepIndex: number): boolean {
  return Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < stepsLength;
}

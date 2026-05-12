import { CalibrationTracker } from "@/components/CalibrationTracker";

export default function Home() {
  return (
    <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-80 w-80 rounded-full bg-cyan-300/15 blur-3xl" />
      <header className="relative mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600/90">
          Fleet operations
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Vehicle calibration tracker
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Follow-up calibrations in one place. Add a vehicle, step through the workflow — the list
          refreshes on its own.
        </p>
      </header>
      <CalibrationTracker />
    </main>
  );
}

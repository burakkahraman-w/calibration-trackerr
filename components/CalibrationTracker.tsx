"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalibrationVehicleRow } from "@/lib/types";
import {
  OWNER_DROPDOWN_OPTIONS,
  OTHERS_VEHICLE_VALUE,
  VEHICLE_DROPDOWN_OPTIONS,
} from "@/lib/fleet-options";
import {
  DEFAULT_CALIBRATION_STEPS,
  nextStepLabel,
  prevStepLabel,
  stepColorsAt,
} from "@/lib/workflow";

function formatPerformed(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function formatCompleted(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(d);
  const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(d);
  return { date, time };
}

/** Supabase / Postgres blocks new connections after repeated bad logins; slow polling avoids extending it. */
function isAuthOrCircuitError(message: string): boolean {
  return /ECIRCUITBREAKER|too many authentication|password authentication failed|authentication failed/i.test(
    message,
  );
}

export function CalibrationTracker() {
  const [vehicles, setVehicles] = useState<CalibrationVehicleRow[]>([]);
  const [storageBackend, setStorageBackend] = useState<"postgres" | "memory" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slowPollAfterAuthFailure, setSlowPollAfterAuthFailure] = useState(false);
  const [vehicleSelect, setVehicleSelect] = useState("");
  const [otherVehicleName, setOtherVehicleName] = useState("");
  const [ownerSelect, setOwnerSelect] = useState("");
  const [performedAt, setPerformedAt] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [ownerNames, setOwnerNames] = useState<string[]>(() => [...OWNER_DROPDOWN_OPTIONS]);
  const [stepTitles, setStepTitles] = useState<string[]>(() => [...DEFAULT_CALIBRATION_STEPS]);
  /** Admin-configured default owner; reapplied after starting a calibration when set. */
  const activeDefaultOwnerRef = useRef<string>("");

  const fetchOwnerNames = useCallback(async () => {
    const res = await fetch("/api/owner-options");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const names = json.owners;
    const activeRaw =
      typeof json.activeCalibrationOwner === "string"
        ? String(json.activeCalibrationOwner).trim()
        : "";
    if (Array.isArray(names) && names.every((x: unknown) => typeof x === "string")) {
      const list = names as string[];
      setOwnerNames(list);
      const preset = activeRaw && list.includes(activeRaw) ? activeRaw : "";
      activeDefaultOwnerRef.current = preset;
      setOwnerSelect((cur) => (cur === "" ? preset : cur));
    }
  }, []);

  useEffect(() => {
    void fetchOwnerNames();
  }, [fetchOwnerNames]);

  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setPerformedAt(local);
  }, []);

  const fetchVehicles = useCallback(async () => {
    const vRes = await fetch("/api/vehicles");
    const json = await vRes.json().catch(() => ({}));
    if (!vRes.ok) {
      const msg =
        typeof json.error === "string" ? json.error : "Failed to load vehicles";
      setStorageBackend(null);
      setLoadError(msg);
      setSlowPollAfterAuthFailure(isAuthOrCircuitError(msg));
      return;
    }
    setLoadError(null);
    setSlowPollAfterAuthFailure(false);
    if (json.storageBackend === "memory" || json.storageBackend === "postgres") {
      setStorageBackend(json.storageBackend);
    }
    setVehicles((json.vehicles as CalibrationVehicleRow[]) ?? []);
    if (Array.isArray(json.steps)) {
      const rows = json.steps as { title?: unknown; position?: unknown }[];
      const titles = [...rows]
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((r) => String(r.title ?? ""))
        .filter((t) => t.length > 0);
      if (titles.length > 0) {
        setStepTitles(titles);
      }
    }
  }, []);

  useEffect(() => {
    void fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    const pollMs = slowPollAfterAuthFailure ? 120_000 : 4000;
    const interval = window.setInterval(() => void fetchVehicles(), pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchVehicles();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchVehicles, slowPollAfterAuthFailure]);

  const startCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!vehicleSelect) {
      setFormError("Select a vehicle.");
      return;
    }
    const vehicleNameResolved =
      vehicleSelect === OTHERS_VEHICLE_VALUE ? otherVehicleName.trim() : vehicleSelect;
    if (!vehicleNameResolved) {
      setFormError(
        vehicleSelect === OTHERS_VEHICLE_VALUE
          ? "Enter a vehicle name for “Others”."
          : "Vehicle is required.",
      );
      return;
    }
    if (!ownerSelect) {
      setFormError("Select an owner.");
      return;
    }
    if (!performedAt) {
      setFormError("Date and time are required.");
      return;
    }

    const performed = new Date(performedAt);
    if (Number.isNaN(performed.getTime())) {
      setFormError("Invalid date/time.");
      return;
    }

    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_name: vehicleNameResolved,
        owner: ownerSelect,
        performed_at: performed.toISOString(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFormError(typeof json.error === "string" ? json.error : "Could not start calibration");
      return;
    }
    setVehicleSelect("");
    setOtherVehicleName("");
    setOwnerSelect(activeDefaultOwnerRef.current);
    const created = json.vehicle as CalibrationVehicleRow | undefined;
    if (created) {
      setVehicles((prev) => {
        const merged = [...prev.filter((v) => v.id !== created.id), created];
        merged.sort(
          (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
        );
        return merged;
      });
    } else {
      await fetchVehicles();
    }
    void fetchOwnerNames();
  };

  const patchStep = async (id: string, direction: "next" | "back") => {
    setBusyId(id);
    setFormError(null);
    const res = await fetch(`/api/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setFormError(typeof json.error === "string" ? json.error : "Update failed");
      return;
    }
    const updated = json.vehicle as CalibrationVehicleRow | undefined;
    if (updated) {
      setVehicles((prev) => {
        const rest = prev.filter((v) => v.id !== updated.id);
        const merged = [...rest, updated];
        merged.sort(
          (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
        );
        return merged;
      });
    } else {
      await fetchVehicles();
    }
  };

  const active = vehicles.filter((v) => !v.is_completed);
  const completed = vehicles.filter((v) => v.is_completed);

  return (
    <div className="relative space-y-10">
      {loadError && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          <p>{loadError}</p>
        </div>
      )}

      {storageBackend === "memory" && !loadError && (
        <div
          className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-sm"
          role="status"
        >
          <p className="font-semibold">In-memory only</p>
          <p className="mt-1 text-sky-900/90">
            Set <code className="rounded bg-white/80 px-1 py-0.5 text-xs">DATABASE_URL</code> in{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 text-xs">.env.local</code> and restart{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 text-xs">npm run dev</code> for Postgres.
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-lg shadow-slate-200/50 backdrop-blur-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Start calibration</h2>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          Refreshes every few seconds and when you return to this tab.
        </p>
        <form
          onSubmit={startCalibration}
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-2">
            Performing date &amp; time
            <input
              type="datetime-local"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-2">
            Vehicle
            <select
              value={vehicleSelect}
              onChange={(e) => {
                setVehicleSelect(e.target.value);
                if (e.target.value !== OTHERS_VEHICLE_VALUE) setOtherVehicleName("");
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
            >
              <option value="">Select vehicle…</option>
              {VEHICLE_DROPDOWN_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {vehicleSelect === OTHERS_VEHICLE_VALUE && (
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-2">
              Other vehicle name
              <input
                value={otherVehicleName}
                onChange={(e) => setOtherVehicleName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                placeholder="e.g. custom ID"
                autoComplete="off"
              />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-2">
            Owner
            <select
              value={ownerSelect}
              onChange={(e) => setOwnerSelect(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
            >
              <option value="">Select owner…</option>
              {ownerNames.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-300/50 transition hover:brightness-105 sm:w-auto"
            >
              Start calibration
            </button>
          </div>
        </form>
        {formError && (
          <p className="mt-3 text-sm text-red-700" role="status">
            {formError}
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Active calibrations</h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            {stepTitles.length > 0
              ? `First step: ${stepTitles[0]}.`
              : "Configure workflow steps in Admin."}
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg shadow-slate-200/40 backdrop-blur-sm">
          <table className="min-w-[860px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">Performing</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Step</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No active calibrations yet.
                  </td>
                </tr>
              )}
              {active.map((v) => {
                const step = v.step_index;
                const n = stepTitles.length;
                const safeStep =
                  n > 0 && Number.isInteger(step) ? Math.max(0, Math.min(n - 1, step)) : 0;
                const colors = stepColorsAt(safeStep);
                const nextLabel = n > 0 ? nextStepLabel(stepTitles, safeStep) : null;
                const prev = n > 0 ? prevStepLabel(stepTitles, safeStep) : null;
                const nextDisabled = busyId === v.id;
                const atLast = n > 0 && safeStep >= n - 1;
                const label = n > 0 ? stepTitles[safeStep] : "—";
                return (
                  <tr key={v.id} className={`border-b border-slate-100 ${colors.row}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatPerformed(v.performed_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{v.vehicle_name}</td>
                    <td className="px-4 py-3 text-slate-700">{v.owner || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${colors.dot}`}
                          title="Status color"
                          aria-hidden
                        />
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${colors.badge}`}
                        >
                          {label}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-stretch gap-2 sm:inline-flex sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                        {prev ? (
                          <button
                            type="button"
                            disabled={nextDisabled}
                            onClick={() => void patchStep(v.id, "back")}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                            title={`Back to ${prev}`}
                          >
                            Back
                            <span className="hidden sm:inline"> ({prev})</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 sm:inline">No back (first step)</span>
                        )}
                        <button
                          type="button"
                          disabled={nextDisabled || n === 0}
                          onClick={() => void patchStep(v.id, "next")}
                          className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
                          title={
                            atLast
                              ? "Mark calibration finished"
                              : nextLabel
                                ? `Next: ${nextLabel}`
                                : undefined
                          }
                        >
                          {atLast ? "Finish" : "Next"}
                          {nextLabel && !atLast && (
                            <span className="hidden font-normal sm:inline">
                              {" "}
                              ({nextLabel})
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Completed calibrations</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg shadow-slate-200/40 backdrop-blur-sm">
          <table className="min-w-[560px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {completed.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    No completed calibrations yet.
                  </td>
                </tr>
              )}
              {completed.map((v) => {
                const when = v.completed_at ? formatCompleted(v.completed_at) : null;
                return (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{v.vehicle_name}</td>
                    <td className="px-4 py-3 text-slate-700">{v.owner || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {when ? (
                        <>
                          Completed on {when.date} at {when.time}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CalibrationVehicleRow } from "@/lib/types";
import type { AdminChangeLogRow } from "@/lib/admin-change-log-db";
import type { LinkOptionRow } from "@/lib/link-options-db";
import type { OwnerOptionRow } from "@/lib/owner-options-db";
import type { VehicleOptionRow } from "@/lib/vehicle-options-db";
import type { WorkflowStepRow } from "@/lib/workflow-steps-db";

function formatLogTimestamp(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default function AdminPage() {
  const [me, setMe] = useState<{ authenticated: boolean; configured: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [vehicles, setVehicles] = useState<CalibrationVehicleRow[]>([]);
  const [owners, setOwners] = useState<OwnerOptionRow[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOptionRow[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepRow[]>([]);
  const [workflowPersisted, setWorkflowPersisted] = useState(true);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [stepEditDraft, setStepEditDraft] = useState<Record<string, string>>({});
  const [linkOptions, setLinkOptions] = useState<LinkOptionRow[]>([]);
  const [newLinkName, setNewLinkName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newOwnerName, setNewOwnerName] = useState("");
  const [newVehicleName, setNewVehicleName] = useState("");
  /** Pre-selected owner on the public tracker (admin-controlled). */
  const [defaultTrackerOwner, setDefaultTrackerOwner] = useState("");
  const [savingDefaultOwner, setSavingDefaultOwner] = useState(false);
  const [changeLog, setChangeLog] = useState<AdminChangeLogRow[]>([]);

  const refreshMe = useCallback(async () => {
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/me");
      const j = await res.json().catch(() => ({}));
      setMe({
        authenticated: Boolean(j.authenticated),
        configured: Boolean(j.configured),
      });
    } catch {
      setMe({ authenticated: false, configured: true });
      setLoginError(
        "Could not reach the server (network error). If you are running locally, start or restart `npm run dev` and refresh this page.",
      );
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/admin/bootstrap");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(typeof j.error === "string" ? j.error : "Failed to load admin data");
      return;
    }
    setVehicles((j.vehicles as CalibrationVehicleRow[]) ?? []);
    setOwners((j.owners as OwnerOptionRow[]) ?? []);
    setVehicleOptions((j.vehicleOptions as VehicleOptionRow[]) ?? []);
    setLinkOptions((j.linkOptions as LinkOptionRow[]) ?? []);
    setDefaultTrackerOwner(
      typeof j.activeCalibrationOwner === "string" ? j.activeCalibrationOwner : "",
    );
    const steps = (j.steps as WorkflowStepRow[]) ?? [];
    setWorkflowSteps([...steps].sort((a, b) => a.position - b.position));
    setWorkflowPersisted(Boolean(j.persisted));
    setChangeLog((j.changeLog as AdminChangeLogRow[]) ?? []);
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (me?.authenticated) void loadAdminData();
  }, [me?.authenticated, loadAdminData]);

  useEffect(() => {
    const m: Record<string, string> = {};
    for (const s of workflowSteps) {
      m[s.id] = s.title;
    }
    setStepEditDraft(m);
  }, [workflowSteps]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setLoginError(typeof j.error === "string" ? j.error : "Login failed");
      return;
    }
    setPassword("");
    await refreshMe();
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setVehicles([]);
    setOwners([]);
    setVehicleOptions([]);
    setLinkOptions([]);
    setDefaultTrackerOwner("");
    setWorkflowSteps([]);
    setWorkflowPersisted(true);
    setStepEditDraft({});
    setChangeLog([]);
    await refreshMe();
  };

  const deleteVehicle = async (id: string) => {
    if (!confirm("Delete this vehicle row? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/vehicles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(typeof j.error === "string" ? j.error : "Delete failed");
      return;
    }
    await loadAdminData();
  };

  const clearCompleted = async () => {
    if (!confirm("Remove ALL completed calibration rows? This cannot be undone.")) return;
    const res = await fetch("/api/admin/vehicles/completed", { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Clear failed");
      return;
    }
    await loadAdminData();
    alert(`Removed ${typeof j.removed === "number" ? j.removed : 0} row(s).`);
  };

  const addOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newOwnerName.trim();
    if (!name) return;
    const res = await fetch("/api/admin/owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Could not add owner");
      return;
    }
    setNewOwnerName("");
    await loadAdminData();
  };

  const removeOwner = async (id: string) => {
    if (!confirm("Remove this owner from the dropdown list?")) return;
    const res = await fetch(`/api/admin/owners/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(typeof j.error === "string" ? j.error : "Delete failed");
      return;
    }
    await loadAdminData();
  };

  const saveDefaultTrackerOwner = async () => {
    setSavingDefaultOwner(true);
    try {
      const res = await fetch("/api/admin/active-calibration-owner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: defaultTrackerOwner }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof j.error === "string" ? j.error : "Could not save default owner");
        return;
      }
      await loadAdminData();
    } finally {
      setSavingDefaultOwner(false);
    }
  };

  const addVehicleOption = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newVehicleName.trim();
    if (!name) return;
    const res = await fetch("/api/admin/vehicle-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Could not add vehicle");
      return;
    }
    setNewVehicleName("");
    await loadAdminData();
  };

  const removeVehicleOption = async (id: string) => {
    if (!confirm("Remove this vehicle from the dropdown list?")) return;
    const res = await fetch(`/api/admin/vehicle-options/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(typeof j.error === "string" ? j.error : "Delete failed");
      return;
    }
    await loadAdminData();
  };

  const patchVehicleOwner = async (id: string, owner: string) => {
    const res = await fetch(`/api/admin/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Update failed");
      return;
    }
    await loadAdminData();
  };

  const addWorkflowStep = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newStepTitle.trim();
    if (!title) return;
    const res = await fetch("/api/admin/workflow-steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Could not add step");
      return;
    }
    setNewStepTitle("");
    if (Array.isArray(j.steps)) {
      setWorkflowSteps([...(j.steps as WorkflowStepRow[])].sort((a, b) => a.position - b.position));
    } else {
      await loadAdminData();
    }
  };

  const saveWorkflowStepTitle = async (id: string, fallbackTitle: string) => {
    const raw = stepEditDraft[id];
    const title = (raw ?? fallbackTitle).trim();
    if (!title) {
      setStepEditDraft((d) => ({ ...d, [id]: fallbackTitle }));
      return;
    }
    if (title === fallbackTitle) return;
    const res = await fetch(`/api/admin/workflow-steps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Update failed");
      return;
    }
    if (Array.isArray(j.steps)) {
      setWorkflowSteps([...(j.steps as WorkflowStepRow[])].sort((a, b) => a.position - b.position));
    } else {
      await loadAdminData();
    }
  };

  const moveWorkflowStepRow = async (id: string, move: "up" | "down") => {
    const res = await fetch(`/api/admin/workflow-steps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Reorder failed");
      return;
    }
    if (Array.isArray(j.steps)) {
      setWorkflowSteps([...(j.steps as WorkflowStepRow[])].sort((a, b) => a.position - b.position));
    } else {
      await loadAdminData();
    }
  };

  const deleteWorkflowStepRow = async (id: string) => {
    if (!confirm("Delete this step? Active vehicles on this index will shift to the next label.")) return;
    const res = await fetch(`/api/admin/workflow-steps/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Delete failed");
      return;
    }
    if (Array.isArray(j.steps)) {
      setWorkflowSteps([...(j.steps as WorkflowStepRow[])].sort((a, b) => a.position - b.position));
    } else {
      await loadAdminData();
    }
  };

  const addLinkOption = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newLinkName.trim();
    if (!name) return;
    const res = await fetch("/api/admin/link-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Could not add link name");
      return;
    }
    setNewLinkName("");
    await loadAdminData();
  };

  const removeLinkOption = async (id: string) => {
    if (!confirm("Remove this link name from the tracker Links panel?")) return;
    const res = await fetch(`/api/admin/link-options/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Delete failed");
      return;
    }
    await loadAdminData();
  };

  const saveAdminStepLink = async (vehicleId: string, linkIndex: number, url: string) => {
    const res = await fetch(`/api/admin/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step_link: { step_index: linkIndex, url: url.trim() } }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof j.error === "string" ? j.error : "Could not save link");
      return;
    }
    await loadAdminData();
  };

  const stepLabelForVehicle = (stepIndex: number) => {
    const ordered = [...workflowSteps].sort((a, b) => a.position - b.position);
    return ordered[stepIndex]?.title ?? `Step ${stepIndex}`;
  };

  if (!me) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!me.configured) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-lg">
        <h1 className="text-xl font-bold tracking-tight">Admin env missing</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Set <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">ADMIN_PASSWORD</code> in{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.local</code>, restart{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">npm run dev</code>. Optional:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">ADMIN_SESSION_SECRET</code>.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md"
        >
          ← Back
        </Link>
      </div>
    );
  }

  if (!me.authenticated) {
    return (
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <h1 className="text-center text-xl font-bold tracking-tight text-slate-900">Admin</h1>
        <form onSubmit={login} className="mt-6 space-y-4">
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              placeholder="••••••••"
            />
          </label>
          {loginError && (
            <p className="text-center text-xs text-red-600" role="alert">
              {loginError}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-40"
          >
            {busy ? "…" : "Sign in"}
          </button>
        </form>
        <Link href="/" className="mt-6 block text-center text-xs text-slate-500 hover:text-slate-800">
          ← Back
        </Link>
      </div>
    );
  }

  const completed = vehicles.filter((v) => v.is_completed);
  const active = vehicles.filter((v) => !v.is_completed);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-24 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Admin</h1>
          <p className="mt-1 text-sm text-slate-600">Vehicles, owners, default tracker owner, clear completed.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadAdminData()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            Log out
          </button>
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-md"
          >
            Tracker
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadError}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-slate-900">Calibration steps</h2>
        <p className="mt-1 text-xs text-slate-500">
          Workflow order on the tracker (&quot;Next&quot; / &quot;Finish&quot;). Run{" "}
          <code className="rounded bg-slate-100 px-1">004_calibration_workflow_steps.sql</code> on
          Postgres to enable editing (until then, defaults are read-only).
        </p>
        {!workflowPersisted && (
          <p className="mt-2 text-xs font-medium text-amber-800">
            Workflow table not found — showing built-in defaults. Apply the migration to customize steps.
          </p>
        )}
        <form onSubmit={addWorkflowStep} className="mt-4 flex flex-wrap gap-2">
          <input
            value={newStepTitle}
            onChange={(e) => setNewStepTitle(e.target.value)}
            placeholder="New step title"
            disabled={!workflowPersisted}
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!workflowPersisted || !newStepTitle.trim()}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
          >
            Add step
          </button>
        </form>
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
          {workflowSteps.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">No steps.</li>
          )}
          {[...workflowSteps]
            .sort((a, b) => a.position - b.position)
            .map((s, idx, arr) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 px-4 py-3 text-sm text-slate-800 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="shrink-0 text-xs font-semibold text-slate-500">#{idx + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input
                      value={stepEditDraft[s.id] ?? s.title}
                      onChange={(e) =>
                        setStepEditDraft((d) => ({ ...d, [s.id]: e.target.value }))
                      }
                      disabled={!workflowPersisted}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={!workflowPersisted}
                      onClick={() => void saveWorkflowStepTitle(s.id, s.title)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={!workflowPersisted || idx === 0}
                    onClick={() => void moveWorkflowStepRow(s.id, "up")}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    disabled={!workflowPersisted || idx >= arr.length - 1}
                    onClick={() => void moveWorkflowStepRow(s.id, "down")}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    disabled={!workflowPersisted || arr.length <= 1}
                    onClick={() => void deleteWorkflowStepRow(s.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-slate-900">Link names (Links panel)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Labels shown in the tracker <strong>Links</strong> dropdown only — workflow step names are
          unchanged. Run{" "}
          <code className="rounded bg-slate-100 px-1">012_restore_workflow_add_link_options.sql</code>{" "}
          on Postgres if the table is missing.
        </p>
        <form onSubmit={addLinkOption} className="mt-4 flex flex-wrap gap-2">
          <input
            value={newLinkName}
            onChange={(e) => setNewLinkName(e.target.value)}
            placeholder="Link label"
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            Add
          </button>
        </form>
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
          {linkOptions.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">No link names.</li>
          )}
          {[...linkOptions]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((lo, idx) => (
              <li
                key={lo.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-800"
              >
                <span>
                  <span className="mr-2 text-xs font-semibold text-slate-500">#{idx + 1}</span>
                  {lo.name}
                </span>
                <button
                  type="button"
                  onClick={() => void removeLinkOption(lo.id)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                >
                  Remove
                </button>
              </li>
            ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-slate-900">Owners (dropdown)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Postgres: run <code className="rounded bg-slate-100 px-1">003_calibration_owners.sql</code>{" "}
          if the table is missing.
        </p>
        <form onSubmit={addOwner} className="mt-4 flex flex-wrap gap-2">
          <input
            value={newOwnerName}
            onChange={(e) => setNewOwnerName(e.target.value)}
            placeholder="New owner name"
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            Add
          </button>
        </form>
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
          {owners.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">No rows.</li>
          )}
          {owners.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-800"
            >
              <span>{o.name}</span>
              <button
                type="button"
                onClick={() => void removeOwner(o.id)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-slate-900">Active calibration owner</h2>
        <p className="mt-1 text-xs text-slate-500">
          Pre-selects this person in the owner dropdown on the public tracker (they can still change
          it before starting). Apply{" "}
          <code className="rounded bg-slate-100 px-1">005_calibration_app_settings.sql</code> on
          Postgres first; until then the value cannot be saved for production DB.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[220px] flex-1 flex-col text-xs font-medium text-slate-600">
            Default owner on tracker
            <select
              value={defaultTrackerOwner}
              onChange={(e) => setDefaultTrackerOwner(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            >
              <option value="">None — user chooses each time</option>
              {owners.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
              {defaultTrackerOwner &&
                !owners.some((o) => o.name === defaultTrackerOwner) && (
                  <option value={defaultTrackerOwner}>{defaultTrackerOwner} (stored)</option>
                )}
            </select>
          </label>
          <button
            type="button"
            disabled={savingDefaultOwner}
            onClick={() => void saveDefaultTrackerOwner()}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
          >
            {savingDefaultOwner ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-slate-900">Vehicles (dropdown)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Manage the vehicle list on the public tracker. Names entered via{" "}
          <strong>Others</strong> are added here automatically. Run{" "}
          <code className="rounded bg-slate-100 px-1">009_calibration_vehicle_options.sql</code> on
          Postgres if the table is missing.
        </p>
        <form onSubmit={addVehicleOption} className="mt-4 flex flex-wrap gap-2">
          <input
            value={newVehicleName}
            onChange={(e) => setNewVehicleName(e.target.value)}
            placeholder="Vehicle name or ID"
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            Add
          </button>
        </form>
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
          {vehicleOptions.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">No vehicles.</li>
          )}
          {vehicleOptions.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-800"
            >
              <span>{v.name}</span>
              <button
                type="button"
                onClick={() => void removeVehicleOption(v.id)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">All calibrations</h2>
          <button
            type="button"
            onClick={() => void clearCompleted()}
            className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-orange-900 hover:bg-orange-100"
          >
            Clear completed ({completed.length})
          </button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm text-slate-800">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Vehicle</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Jira</th>
                <th className="px-3 py-2">Step / links</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...active, ...completed].map((v) => (
                <tr key={v.id} className="bg-white">
                  <td className="px-3 py-2">
                    {v.is_completed ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
                        Done
                      </span>
                    ) : (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">{v.vehicle_name}</td>
                  <td className="px-3 py-2">
                    <select
                      key={`${v.id}-${v.updated_at}`}
                      defaultValue={v.owner}
                      onChange={(e) => {
                        const next = e.target.value;
                        void patchVehicleOwner(v.id, next);
                      }}
                      className="max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
                    >
                      {owners.map((o) => (
                        <option key={o.id} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                      {v.owner && !owners.some((o) => o.name === v.owner) && (
                        <option value={v.owner}>{v.owner} (legacy)</option>
                      )}
                    </select>
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-slate-600" title={v.reason}>
                    {v.reason || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{v.jira_ticket || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {v.is_completed ? (
                      "—"
                    ) : (
                      <div className="space-y-1">
                        <div>{stepLabelForVehicle(v.step_index)}</div>
                        {[...linkOptions]
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((lo) => {
                            const saved = v.step_links?.[String(lo.sort_order)] ?? "";
                            return (
                              <div key={lo.id} className="flex flex-wrap items-center gap-1 text-xs">
                                <span className="text-slate-500">{lo.name}:</span>
                                <input
                                  key={`${v.id}-${lo.sort_order}-${saved}`}
                                  defaultValue={saved}
                                  placeholder="https://…"
                                  className="min-w-[10rem] flex-1 rounded border border-slate-200 px-1.5 py-0.5"
                                  onBlur={(e) => {
                                    const next = e.target.value.trim();
                                    if (next !== saved) {
                                      void saveAdminStepLink(v.id, lo.sort_order, next);
                                    }
                                  }}
                                />
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void deleteVehicle(v.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    No vehicles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-slate-900">Owner change log</h2>
        <p className="mt-1 text-xs text-slate-500">
          Owner changes made on the public tracker, newest first.
        </p>
        <ul className="mt-4 max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50">
          {changeLog.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              No owner changes logged yet.
            </li>
          )}
          {changeLog.map((entry) => (
            <li key={entry.id} className="px-4 py-3 text-sm text-slate-800">
              <time
                dateTime={entry.created_at}
                className="block text-xs font-medium text-slate-500"
              >
                {formatLogTimestamp(entry.created_at)}
              </time>
              <p className="mt-1 leading-relaxed">{entry.message}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

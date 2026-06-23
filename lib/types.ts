export type CalibrationVehicleRow = {
  id: string;
  vehicle_name: string;
  /** Calibration owner / performer (from dropdown). */
  owner: string;
  /** Why this calibration was started (required on new rows). */
  reason: string;
  /** Jira ticket reference (required on new rows). */
  jira_ticket: string;
  performed_at: string;
  step_index: number;
  /** Saved URLs keyed by step index string, e.g. { "3": "https://..." }. */
  step_links: Record<string, string>;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CalibrationVehicleRow = {
  id: string;
  vehicle_name: string;
  /** Calibration owner / performer (from dropdown). */
  owner: string;
  performed_at: string;
  step_index: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

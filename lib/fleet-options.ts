/** Default fleet IDs seeded in the database. */
export const DEFAULT_FLEET_VEHICLE_OPTIONS = [
  ...Array.from({ length: 21 }, (_, i) => `fme${10000 + i}`),
] as const;

/** Fleet vehicles shown in the start-calibration dropdown (fallback when DB list unavailable). */
export const VEHICLE_DROPDOWN_OPTIONS = [...DEFAULT_FLEET_VEHICLE_OPTIONS, "Others"] as const;

/**
 * Owners / performers for the dropdown. Edit this list to match your team (or wire Notion later).
 */
export const OWNER_DROPDOWN_OPTIONS = [
  "Team member A",
  "Team member B",
  "Team member C",
] as const;

export const OTHERS_VEHICLE_VALUE = "Others";

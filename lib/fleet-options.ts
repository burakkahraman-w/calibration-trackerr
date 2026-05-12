/** Fleet vehicles shown in the start-calibration dropdown (matches internal fleet UI pattern). */
export const VEHICLE_DROPDOWN_OPTIONS = [
  ...Array.from({ length: 21 }, (_, i) => `fme${10000 + i}`),
  "Others",
] as const;

/**
 * Owners / performers for the dropdown. Edit this list to match your team (or wire Notion later).
 */
export const OWNER_DROPDOWN_OPTIONS = [
  "Team member A",
  "Team member B",
  "Team member C",
] as const;

export const OTHERS_VEHICLE_VALUE = "Others";

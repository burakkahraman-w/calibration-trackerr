/** Workflow step titles that do not show a link field on the tracker. */
export const STEP_TITLES_WITHOUT_LINKS = [
  "Vehicle Run Offload",
  "PR Approved and Merged",
  "Data Ingestion",
  "ADAS Verification Run Review",
] as const;

export function stepTitleHasLinkField(title: string): boolean {
  return !STEP_TITLES_WITHOUT_LINKS.includes(
    title as (typeof STEP_TITLES_WITHOUT_LINKS)[number],
  );
}

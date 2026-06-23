-- Disable link fields on selected workflow steps.

update public.calibration_workflow_steps
set link_enabled = false
where title in (
  'Vehicle Run Offload',
  'PR Approved and Merged',
  'Data Ingestion',
  'ADAS Verification Run Review'
);

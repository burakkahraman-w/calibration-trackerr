# Standard operating procedure: Vehicle calibration tracker (end users)

**Scope:** This document describes how to use the **public** vehicle calibration tracker only. It does **not** cover the admin console, database setup, or deployment.

**Application:** “Vehicle calibration tracker” — home page with **Start calibration**, **Active calibrations**, and **Completed calibrations**.

---

## 1. Purpose

Ensure calibrations are recorded with the correct vehicle, owner, and time, and that each job is stepped through the agreed workflow until completion. The tracker is shared: everyone sees the same active and completed lists.

---

## 2. Before you begin

- Open the tracker in a **web browser** using the URL your team provides (for example, your production site root `/`).
- You need **no login** for the public tracker unless your organization has added something in front of it (not part of this app’s default home page).
- **Owner** and **vehicle** choices come from dropdowns. If your name or vehicle is missing, ask whoever maintains the system to update the lists (admin); you cannot change those lists from this page.

---

## 3. Screen layout (what you see)

| Area | What it is for |
|------|----------------|
| **Start calibration** | Form to register a new calibration row. |
| **Active calibrations** | Jobs in progress: current step, **Back** / **Next** or **Finish**. |
| **Completed calibrations** | Read-only history of finished jobs. |

The page **refreshes data about every four seconds** and when you **switch back to the browser tab**. You do not need to reload the page to see updates from teammates.

---

## 4. SOP — Start a new calibration

**When:** A calibration session begins for a vehicle.

**Steps:**

1. Go to the **Start calibration** section.
2. Set **Performing date & time** to when the work is being performed (defaults to “now”; adjust if needed).
3. Under **Vehicle**, choose the vehicle identifier from the list.
   - If the vehicle is not in the list, choose **Others** and type the identifier in **Other vehicle name** (required when Others is selected).
4. Under **Owner**, select the person performing or responsible for this calibration (must match an entry in the list).
5. Click **Start calibration**.

**Expected result:** A new row appears under **Active calibrations** at the first workflow step. If an error message appears in red under the form, read it, correct the field, and try again.

**Validation (built into the app):** Vehicle (or Others name), owner, and date/time are required.

---

## 5. SOP — Move through the workflow (active job)

**When:** Work progresses from one calibration stage to the next, or you need to correct a mistaken step.

**Steps:**

1. Find the row under **Active calibrations** (columns: Performing, Vehicle, Owner, Step, Actions).
2. Read the **Step** badge: that is the **current** stage for that vehicle.
3. To advance:
   - Click **Next** (label may include the name of the next step). On the **last** step, the button reads **Finish** — use it to mark the calibration **completed**.
4. To go back one stage (e.g. after a mistake):
   - Click **Back** if shown. On the first step, back is not available (“No back (first step)”).

**Expected result:** The step badge updates immediately after a successful click. While a request is in progress, buttons may be briefly disabled.

**Rules of thumb:**

- Use **Next** only when the current step’s work is actually done (team policy).
- Use **Finish** on the final step to move the job to **Completed calibrations**; it does not create a duplicate row.

---

## 6. SOP — Handoffs and shared visibility

- Multiple people can use the tracker at once; all users see the same **Active** and **Completed** lists after refresh.
- If two people act on the **same** row at the same time, the latest successful update wins; coordinate verbally or by chat for the same vehicle when needed.

---

## 7. SOP — Completed calibrations (read-only)

**When:** You need to confirm that a job was finished or when it completed.

**Steps:**

1. Scroll to **Completed calibrations**.
2. Locate the vehicle and owner; read **Completed on** (date and time).

**Note:** The public tracker does not provide edit or delete for completed rows from this page.

---

## 8. If something looks wrong

| Situation | What to do |
|-----------|------------|
| Yellow/amber banner at the top with an error message | Note the exact text; retry after a moment. If it mentions database or configuration, escalate to IT/admin. |
| Blue “In-memory only” notice | The deployment is not using persistent database storage; data may not survive restarts. Escalate to admin — not an operator fix. |
| Step names missing or wrong | Workflow step titles are configured outside this SOP (admin). Continue using **Next** / **Finish** as labeled. |
| Owner or vehicle missing from dropdowns | Ask admin to add options; you cannot add them from the public page. |

---

## 9. Revision record (optional)

Use this table in your quality system if you version controlled printed copies.

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | | | Initial end-user SOP |

---

*This SOP describes behavior of the open-source-style tracker UI (start form, active table with Back/Next/Finish, completed table). Step names and dropdown contents depend on your environment.*

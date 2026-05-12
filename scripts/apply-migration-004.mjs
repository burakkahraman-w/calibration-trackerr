#!/usr/bin/env node
/**
 * Apply db/migrations/004_calibration_workflow_steps.sql using DATABASE_URL from .env.local.
 *
 * Usage (from project root):
 *   node scripts/apply-migration-004.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath}`);
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

function sslForUrl(connectionString, rejectUnauthorizedFalse) {
  if (!connectionString) return undefined;
  if (/\bsslmode=(disable|allow)\b/i.test(connectionString)) return undefined;
  if (/\.pooler\.supabase\.com\b|\.supabase\.co\b/i.test(connectionString)) {
    return rejectUnauthorizedFalse ? { rejectUnauthorized: false } : undefined;
  }
  if (/\bsslmode=/i.test(connectionString)) {
    return rejectUnauthorizedFalse ? { rejectUnauthorized: false } : undefined;
  }
  return undefined;
}

const env = loadEnvLocal();
const rawUrl = env.DATABASE_URL?.trim();
if (!rawUrl) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}

const relax =
  String(env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? "")
    .trim()
    .toLowerCase() === "false";

let connectionString = rawUrl;
if (relax && /\.pooler\.supabase\.com\b|\.supabase\.co\b/i.test(rawUrl)) {
  connectionString = /[?&]sslmode=/i.test(rawUrl)
    ? rawUrl.replace(/([?&])sslmode=[^&]*/gi, "$1sslmode=no-verify")
    : `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}sslmode=no-verify`;
}

const sqlPath = path.join(__dirname, "..", "db", "migrations", "004_calibration_workflow_steps.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const client = new Client({
  connectionString,
  ssl: sslForUrl(rawUrl, relax),
});

await client.connect();
try {
  await client.query(sql);
  console.log("Applied 004_calibration_workflow_steps.sql successfully.");
} finally {
  await client.end();
}

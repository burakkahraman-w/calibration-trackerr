#!/usr/bin/env node
/**
 * Finds your Supabase Session pooler region and prints a DATABASE_URL line for .env.local
 *
 * Usage (from project root):
 *   SUPABASE_DB_PASSWORD='your-password' node scripts/print-supabase-database-url.mjs
 *
 * Optional: pass project ref (default matches Calibration tracker project subdomain)
 *   SUPABASE_DB_PASSWORD='...' node scripts/print-supabase-database-url.mjs your-project-ref
 */
import pg from "pg";

const { Client } = pg;
const projectRef = process.argv[2] ?? process.env.SUPABASE_PROJECT_REF ?? "slpucyfandveivshwgn";
const password = process.env.SUPABASE_DB_PASSWORD;

const regions = [
  "eu-central-1",
  "eu-central-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "eu-south-1",
  "eu-south-2",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "ca-west-1",
  "sa-east-1",
  "ap-south-1",
  "ap-south-2",
  "ap-east-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "ap-southeast-4",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "me-central-1",
  "me-south-1",
  "il-central-1",
  "af-south-1",
];

if (!password) {
  console.error("Set SUPABASE_DB_PASSWORD to your Postgres password, then run again.");
  console.error("Example: SUPABASE_DB_PASSWORD='...' node scripts/print-supabase-database-url.mjs");
  process.exit(1);
}

function encodePasswordForUrl(p) {
  return encodeURIComponent(p);
}

async function tryConnect(config) {
  const client = new Client({
    ...config,
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    await client.end();
    return true;
  } catch (e) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/self-signed certificate|certificate/i.test(msg)) {
      const c2 = new Client({
        ...config,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      });
      try {
        await c2.connect();
        await c2.query("select 1");
        await c2.end();
        return true;
      } catch {
        try {
          await c2.end();
        } catch {
          /* ignore */
        }
      }
    }
    return false;
  }
}

async function tryRegion(region) {
  for (const prefix of ["aws-0", "aws-1"]) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    const base = {
      host,
      user: `postgres.${projectRef}`,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: true },
    };
    if (await tryConnect({ ...base, port: 5432 })) {
      return { prefix, region, port: 5432 };
    }
    if (await tryConnect({ ...base, port: 6543 })) {
      return { prefix, region, port: 6543 };
    }
  }
  return null;
}

for (const region of regions) {
  const ok = await tryRegion(region);
  if (ok) {
    const enc = encodePasswordForUrl(password);
    const suffix =
      ok.port === 6543 ? "postgres?sslmode=require&pgbouncer=true" : "postgres?sslmode=require";
    console.log("");
    console.log("Paste this single line into .env.local (then save and run npm run dev):");
    console.log("");
    console.log(
      `DATABASE_URL=postgresql://postgres.${projectRef}:${enc}@${ok.prefix}-${ok.region}.pooler.supabase.com:${ok.port}/${suffix}`,
    );
    console.log("");
    process.exit(0);
  }
}

console.error("Could not connect via Session pooler with any common region.");
console.error("Copy the Session pooler URI from Supabase → Connect instead, or reset your DB password.");
process.exit(1);

import { Pool } from "pg";

let pool: Pool | null = null;

/** Supabase "Direct" host is often IPv6-only; many networks/DNS setups get getaddrinfo ENOTFOUND. */
function assertNotSupabaseDirectHost(connectionString: string): void {
  if (process.env.SUPABASE_ALLOW_DIRECT_DB_HOST === "true") {
    return;
  }
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    const m = connectionString.match(/@([^/?]+)/);
    host = m?.[1]?.split(":")[0] ?? "";
    if (!host) return;
  }
  if (/^db\.[^.]+\.supabase\.co$/i.test(host)) {
    throw new Error(
      `DATABASE_URL uses Supabase Direct host "${host}", which is often IPv6-only and fails with ENOTFOUND on IPv4 networks. ` +
        `In Supabase: Connect → Session pooler → URI, and paste that full URL into DATABASE_URL (host should look like *.pooler.supabase.com). ` +
        `Or set SUPABASE_ALLOW_DIRECT_DB_HOST=true only if you know IPv6 works from this machine.`,
    );
  }
}

function tlsRelax(): boolean {
  const v = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  return v != null && String(v).trim().toLowerCase() === "false";
}

function tlsLikely(connectionString: string): boolean {
  if (/\bsslmode=(disable|allow)\b/i.test(connectionString)) {
    return false;
  }
  if (process.env.DATABASE_SSL === "require") {
    return true;
  }
  if (/\bsslmode=/i.test(connectionString)) {
    return true;
  }
  return /\.pooler\.supabase\.com\b|\.supabase\.co\b/i.test(connectionString);
}

/**
 * `pg` merges parsed `connectionString` *after* Pool `ssl`, so `sslmode=require` can wipe
 * `rejectUnauthorized: false`. `sslmode=no-verify` is parsed into `rejectUnauthorized: false`.
 */
function connectionStringWithTlsRelaxed(connectionString: string): string {
  if (!tlsRelax() || !tlsLikely(connectionString)) {
    return connectionString;
  }
  if (/[?&]sslmode=/i.test(connectionString)) {
    return connectionString.replace(/([?&])sslmode=[^&]*/gi, "$1sslmode=no-verify");
  }
  const sep = connectionString.includes("?") ? "&" : "?";
  return `${connectionString}${sep}sslmode=no-verify`;
}

function trimDatabaseUrl(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * SSL for `pg`. If you see "self-signed certificate in certificate chain" (often corporate TLS
 * inspection), set DATABASE_SSL_REJECT_UNAUTHORIZED=false in .env.local and restart the dev server.
 */
function sslOptionForUrl(connectionString: string): object | undefined {
  const relax = tlsRelax();
  if (!tlsLikely(connectionString)) {
    return undefined;
  }
  if (relax) {
    return { rejectUnauthorized: false };
  }
  if (process.env.DATABASE_SSL === "require") {
    return { rejectUnauthorized: true };
  }
  if (/\bsslmode=/i.test(connectionString)) {
    return undefined;
  }
  if (/\.pooler\.supabase\.com\b|\.supabase\.co\b/i.test(connectionString)) {
    return { rejectUnauthorized: true };
  }
  return undefined;
}

export function getPool(): Pool {
  const raw = process.env.DATABASE_URL;
  if (!raw?.trim()) {
    throw new Error(
      "Missing DATABASE_URL. Create .env.local in the project root, set DATABASE_URL to your Postgres connection string (Supabase: Project Settings → Database → URI; see .env.example), then restart npm run dev.",
    );
  }

  const logicalUrl = trimDatabaseUrl(raw);
  if (!pool) {
    assertNotSupabaseDirectHost(logicalUrl);
    const connectionString = connectionStringWithTlsRelaxed(logicalUrl);
    pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      ssl: sslOptionForUrl(logicalUrl),
    });
  }

  return pool;
}

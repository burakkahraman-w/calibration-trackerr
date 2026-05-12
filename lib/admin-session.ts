import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "cal_admin";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function signingKey(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (secret) return secret;
  const pw = process.env.ADMIN_PASSWORD?.trim();
  if (pw) return `cal:${pw}`;
  return "";
}

function hashPasswordToken(input: string): Buffer {
  return createHash("sha256").update(input, "utf8").digest();
}

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected || !candidate) return false;
  try {
    return timingSafeEqual(hashPasswordToken(candidate), hashPasswordToken(expected));
  } catch {
    return false;
  }
}

function signPayload(payloadJson: string): string {
  const key = signingKey();
  if (!key) throw new Error("ADMIN_PASSWORD or ADMIN_SESSION_SECRET is not configured");
  const mac = createHmac("sha256", key).update(payloadJson).digest("base64url");
  return `${Buffer.from(payloadJson, "utf8").toString("base64url")}.${mac}`;
}

function verifyToken(token: string): boolean {
  const key = signingKey();
  if (!key) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return false;
  let payloadJson: string;
  try {
    payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", key).update(payloadJson).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  let exp: number;
  try {
    const o = JSON.parse(payloadJson) as { exp?: number };
    exp = Number(o.exp);
    if (!Number.isFinite(exp)) return false;
  } catch {
    return false;
  }
  return exp > Date.now();
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!adminPasswordConfigured()) return false;
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  return verifyToken(raw);
}

export function createAdminSessionToken(): string {
  const exp = Date.now() + COOKIE_MAX_AGE_SEC * 1000;
  const nonce = randomBytes(8).toString("hex");
  const payloadJson = JSON.stringify({ exp, nonce });
  return signPayload(payloadJson);
}

export function adminCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  };
}

export { COOKIE_NAME, COOKIE_MAX_AGE_SEC };

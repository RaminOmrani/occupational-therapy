import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { getSetting, setSetting, getSettingNumber } from "./settings.js";

export interface AuthPayload {
  sub: string;
  role: string;
  name: string;
}

let jwtSecret: string | null = null;

/** کلید امضای توکن به‌صورت خودکار ساخته و در دیتابیس ذخیره می‌شود (بدون نیاز به env) */
export async function getJwtSecret(): Promise<string> {
  if (jwtSecret) return jwtSecret;
  if (process.env.JWT_SECRET) {
    jwtSecret = process.env.JWT_SECRET;
    return jwtSecret;
  }
  let s = await getSetting("security.jwtSecret", "");
  if (!s) {
    s = randomBytes(48).toString("hex");
    await setSetting("security.jwtSecret", s);
  }
  jwtSecret = s;
  return s;
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(pw, hash);
}

export async function signToken(payload: AuthPayload) {
  const days = await getSettingNumber("security.sessionDays", 14);
  return jwt.sign(payload, await getJwtSecret(), { expiresIn: `${days}d` });
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    return jwt.verify(token, await getJwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

export const TOKEN_COOKIE = "ot_token";
export const ROLE_COOKIE = "ot_role";

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

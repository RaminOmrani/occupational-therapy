import type { NextFunction, Request, Response } from "express";
import { TOKEN_COOKIE, verifyToken, type AuthPayload } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { forbidden, unauthorized } from "../lib/errors.js";

export interface AuthUser {
  id: string;
  role: string;
  firstName: string;
  lastName: string;
  phone: string;
  therapistId: string | null;
  patientId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) return h.slice(7);
  const c = (req as any).cookies?.[TOKEN_COOKIE];
  return c || null;
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  const payload: AuthPayload | null = await verifyToken(token);
  if (!payload) return next();
  const u = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { therapist: { select: { id: true } }, patient: { select: { id: true } } },
  });
  if (u && u.isActive) {
    req.user = {
      id: u.id,
      role: u.role,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      therapistId: u.therapist?.id ?? null,
      patientId: u.patient?.id ?? null,
    };
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export const requireStaff = requireRole("ADMIN", "THERAPIST", "SECRETARY");
export const requireAdmin = requireRole("ADMIN");
export const requireAdminOrSecretary = requireRole("ADMIN", "SECRETARY");

/** بیمار فقط به داده‌های خودش دسترسی دارد؛ کارکنان به همه */
export function canAccessPatient(req: Request, patientId: string): boolean {
  if (!req.user) return false;
  if (req.user.role === "PATIENT") return req.user.patientId === patientId;
  return true;
}

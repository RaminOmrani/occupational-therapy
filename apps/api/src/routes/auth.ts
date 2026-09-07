import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { normalizePhone, isValidMobile } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { validate } from "../lib/validate.js";
import { generateOtp, hashPassword, ROLE_COOKIE, signToken, TOKEN_COOKIE, verifyPassword } from "../lib/auth.js";
import { badRequest, unauthorized } from "../lib/errors.js";
import { getSettingNumber } from "../lib/settings.js";
import { sendTemplateSms } from "../lib/sms/service.js";
import { requireAuth } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: "تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید" } });

async function issueSession(req: any, res: any, user: { id: string; role: string; firstName: string; lastName: string }) {
  const token = await signToken({ sub: user.id, role: user.role, name: `${user.firstName} ${user.lastName}` });
  const days = await getSettingNumber("security.sessionDays", 14);
  const maxAge = days * 24 * 60 * 60 * 1000;
  // کوکی امن فقط وقتی درخواست از طریق https رسیده باشد (پشت nginx با X-Forwarded-Proto)
  const secure = !!req.secure || String(req.headers["x-forwarded-proto"] ?? "").includes("https");
  res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, maxAge, path: "/" });
  res.cookie(ROLE_COOKIE, user.role, { httpOnly: false, sameSite: "lax", secure, maxAge, path: "/" });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return token;
}

function publicUser(u: any) {
  return {
    id: u.id,
    phone: u.phone,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
    avatar: u.avatar,
    therapistId: u.therapist?.id ?? null,
    patientId: u.patient?.id ?? null,
    fileNumber: u.patient?.fileNumber ?? null,
  };
}

/** ورود با شماره موبایل و رمز عبور (کارکنان و بیمارانی که رمز دارند) */
authRouter.post("/login", limiter, async (req, res) => {
  const body = validate(z.object({ phone: z.string().min(10), password: z.string().min(4) }), req.body);
  const phone = normalizePhone(body.phone);
  const user = await prisma.user.findUnique({ where: { phone }, include: { therapist: true, patient: true } });
  if (!user || !user.isActive || !(await verifyPassword(body.password, user.passwordHash))) throw unauthorized("شماره موبایل یا رمز عبور اشتباه است");
  const token = await issueSession(req, res, user);
  await audit(user.id, "login", "user", user.id);
  res.json({ token, user: publicUser(user) });
});

/** درخواست کد یکبارمصرف (بیماران و کارکنان) */
authRouter.post("/otp/request", limiter, async (req, res) => {
  const body = validate(z.object({ phone: z.string().min(10) }), req.body);
  const phone = normalizePhone(body.phone);
  if (!isValidMobile(phone)) throw badRequest("شماره موبایل معتبر نیست");
  const user = await prisma.user.findUnique({ where: { phone } });
  // برای جلوگیری از افشای وجود کاربر، پاسخ همیشه یکسان است
  if (user && user.isActive) {
    const ttl = await getSettingNumber("security.otpTtlMinutes", 5);
    const code = generateOtp();
    await prisma.otpCode.create({ data: { userId: user.id, code, expiresAt: new Date(Date.now() + ttl * 60000) } });
    await sendTemplateSms("otp", phone, { code, minutes: ttl }, { related: { type: "user", id: user.id } });
  }
  res.json({ ok: true, message: "در صورت وجود حساب، کد ورود پیامک شد" });
});

authRouter.post("/otp/verify", limiter, async (req, res) => {
  const body = validate(z.object({ phone: z.string().min(10), code: z.string().length(6) }), req.body);
  const phone = normalizePhone(body.phone);
  const user = await prisma.user.findUnique({ where: { phone }, include: { therapist: true, patient: true } });
  if (!user || !user.isActive) throw unauthorized("کد یا شماره نامعتبر است");
  const otp = await prisma.otpCode.findFirst({ where: { userId: user.id, code: body.code, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp) throw unauthorized("کد وارد‌شده نامعتبر یا منقضی است");
  await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  const token = await issueSession(req, res, user);
  await audit(user.id, "login_otp", "user", user.id);
  res.json({ token, user: publicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(TOKEN_COOKIE, { path: "/" });
  res.clearCookie(ROLE_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { therapist: true, patient: true } });
  res.json({ user: publicUser(user) });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const body = validate(z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر باشد") }), req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (user?.passwordHash && !(await verifyPassword(body.currentPassword ?? "", user.passwordHash))) throw badRequest("رمز عبور فعلی اشتباه است");
  await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
  res.json({ ok: true });
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  const body = validate(z.object({ firstName: z.string().min(1), lastName: z.string().min(1) }), req.body);
  const u = await prisma.user.update({ where: { id: req.user!.id }, data: body, include: { therapist: true, patient: true } });
  if (u.patient) await prisma.patient.update({ where: { id: u.patient.id }, data: { firstName: body.firstName, lastName: body.lastName } });
  res.json({ user: publicUser(u) });
});

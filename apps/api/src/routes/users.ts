import { Router } from "express";
import { z } from "zod";
import { normalizePhone, isValidMobile, isPhoneLike, ROLES } from "@toranj/shared";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zOptionalString, zOptionalInt } from "../lib/validate.js";
import { badRequest, notFound } from "../lib/errors.js";
import { hashPassword } from "../lib/auth.js";
import { requireAuth, requireAdmin, requireStaff } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const therapistShape = (t: any) => ({
  id: t.id,
  userId: t.userId,
  firstName: t.user.firstName,
  lastName: t.user.lastName,
  fullName: `${t.user.firstName} ${t.user.lastName}`,
  phone: t.user.phone,
  avatar: t.user.avatar,
  isActive: t.user.isActive,
  specialty: t.specialty,
  bio: t.bio,
  licenseNo: t.licenseNo,
  color: t.color,
  isPublic: t.isPublic,
  sessionPrice: t.sessionPrice,
  workDays: parseJson<number[]>(t.workDays, []),
  sortOrder: t.sortOrder,
  patientsCount: t._count?.patients,
});

/** فهرست درمانگران (برای همه کارکنان) */
usersRouter.get("/therapists", requireStaff, async (_req, res) => {
  const items = await prisma.therapist.findMany({ include: { user: true, _count: { select: { patients: true } } }, orderBy: [{ sortOrder: "asc" }, { user: { lastName: "asc" } }] });
  res.json({ items: items.map(therapistShape) });
});

usersRouter.use(requireAdmin);

usersRouter.get("/", async (req, res) => {
  const where: any = {};
  if (req.query.role) where.role = String(req.query.role);
  else where.role = { not: "PATIENT" };
  const q = String(req.query.q ?? "").trim();
  if (q) {
    where.OR = [{ firstName: { contains: q } }, { lastName: { contains: q } }];
    if (isPhoneLike(q)) where.OR.push({ phone: { contains: normalizePhone(q) } });
  }
  const items = await prisma.user.findMany({ where, include: { therapist: true }, orderBy: { createdAt: "desc" } });
  res.json({ items: items.map((u) => ({ ...u, passwordHash: undefined, fullName: `${u.firstName} ${u.lastName}`, therapist: u.therapist ? { ...u.therapist, workDays: parseJson(u.therapist.workDays, []) } : null })) });
});

const userSchema = z.object({
  firstName: z.string().min(1, "نام الزامی است"),
  lastName: z.string().min(1, "نام خانوادگی الزامی است"),
  phone: z.string().min(10),
  role: z.enum(ROLES),
  password: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر").optional(),
  isActive: z.boolean().optional(),
  therapist: z
    .object({
      specialty: zOptionalString,
      bio: zOptionalString,
      licenseNo: zOptionalString,
      color: zOptionalString,
      isPublic: z.boolean().optional(),
      sessionPrice: zOptionalInt,
      workDays: z.array(z.number().int()).optional(),
      sortOrder: zOptionalInt,
    })
    .optional(),
});

usersRouter.post("/", async (req, res) => {
  const body = validate(userSchema, req.body);
  const phone = normalizePhone(body.phone);
  if (!isValidMobile(phone)) throw badRequest("شماره موبایل معتبر نیست");
  if (await prisma.user.findUnique({ where: { phone } })) throw badRequest("این شماره قبلاً ثبت شده است");
  if (body.role !== "PATIENT" && !body.password) throw badRequest("رمز عبور برای کارکنان الزامی است");
  const user = await prisma.user.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      phone,
      role: body.role,
      isActive: body.isActive ?? true,
      passwordHash: body.password ? await hashPassword(body.password) : null,
      therapist: body.role === "THERAPIST" ? { create: { ...(body.therapist ?? {}), workDays: JSON.stringify(body.therapist?.workDays ?? [0, 1, 2, 3, 4, 6]), color: body.therapist?.color ?? "#178a6e", sortOrder: body.therapist?.sortOrder ?? 0 } } : undefined,
    },
    include: { therapist: true },
  });
  await audit(req.user!.id, "create", "user", user.id, { role: body.role });
  res.status(201).json({ user: { ...user, passwordHash: undefined } });
});

usersRouter.patch("/:id", async (req, res) => {
  const body = validate(userSchema.partial(), req.body);
  const cur = await prisma.user.findUnique({ where: { id: String(req.params.id) }, include: { therapist: true } });
  if (!cur) throw notFound("کاربر یافت نشد");
  const data: any = { firstName: body.firstName, lastName: body.lastName, isActive: body.isActive };
  if (body.phone) {
    data.phone = normalizePhone(body.phone);
    if (!isValidMobile(data.phone)) throw badRequest("شماره موبایل معتبر نیست");
  }
  if (body.password) data.passwordHash = await hashPassword(body.password);
  if (body.role && body.role !== cur.role) data.role = body.role;
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const role = body.role ?? cur.role;
  if (role === "THERAPIST") {
    const t = body.therapist ?? {};
    const tData: any = { ...t };
    if (t.workDays) tData.workDays = JSON.stringify(t.workDays);
    Object.keys(tData).forEach((k) => tData[k] === undefined && delete tData[k]);
    data.therapist = cur.therapist ? { update: tData } : { create: { ...tData, workDays: tData.workDays ?? "[0,1,2,3,4,6]" } };
  }
  const user = await prisma.user.update({ where: { id: cur.id }, data, include: { therapist: true } });
  await audit(req.user!.id, "update", "user", user.id);
  res.json({ user: { ...user, passwordHash: undefined } });
});

usersRouter.delete("/:id", async (req, res) => {
  if (String(req.params.id) === req.user!.id) throw badRequest("نمی‌توانید حساب خودتان را غیرفعال کنید");
  await prisma.user.update({ where: { id: String(req.params.id) }, data: { isActive: false } });
  res.json({ ok: true });
});

usersRouter.get("/audit", async (req, res) => {
  const items = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { firstName: true, lastName: true, role: true } } } });
  res.json({ items });
});

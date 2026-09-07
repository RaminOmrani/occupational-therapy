import { Router } from "express";
import { startOfDay, endOfDay, addDays } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRole("ADMIN", "SECRETARY"));

/** گزارش‌های مدیریتی: نرخ تبدیل لید، غیبت، درآمد به تفکیک درمانگر، بیماران در خطر ریزش */
reportsRouter.get("/management", async (req, res) => {
  const from = req.query.from ? startOfDay(new Date(String(req.query.from))) : addDays(new Date(), -30);
  const to = req.query.to ? endOfDay(new Date(String(req.query.to))) : new Date();
  const riskDays = Number(req.query.riskDays ?? 30);

  const [leads, appts, therapists, activePatients, newPatients] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: { createdAt: { gte: from, lte: to } }, _count: { _all: true } }),
    prisma.appointment.findMany({ where: { startAt: { gte: from, lte: to } }, select: { status: true, therapistId: true, price: true, source: true, patientId: true } }),
    prisma.therapist.findMany({ include: { user: { select: { firstName: true, lastName: true } } } }),
    prisma.patient.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, fileNumber: true, phone: true, primaryTherapist: { select: { user: { select: { firstName: true, lastName: true } } } }, appointments: { where: { status: "DONE" }, orderBy: { startAt: "desc" }, take: 1, select: { startAt: true } } } }),
    prisma.patient.count({ where: { createdAt: { gte: from, lte: to } } }),
  ]);

  const leadCounts = Object.fromEntries(leads.map((l) => [l.status, l._count._all]));
  const leadTotal = leads.reduce((s, l) => s + l._count._all, 0);
  const converted = leadCounts.CONVERTED ?? 0;

  const byStatus: Record<string, number> = {};
  for (const a of appts) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
  const finished = (byStatus.DONE ?? 0) + (byStatus.NO_SHOW ?? 0);
  const noShowRate = finished ? Math.round(((byStatus.NO_SHOW ?? 0) / finished) * 100) : 0;
  const webBookings = appts.filter((a) => a.source === "WEB").length;

  const perTherapist = therapists.map((t) => {
    const mine = appts.filter((a) => a.therapistId === t.id);
    const done = mine.filter((a) => a.status === "DONE");
    const uniquePatients = new Set(mine.map((a) => a.patientId)).size;
    return { id: t.id, name: `${t.user.firstName} ${t.user.lastName}`, color: t.color, sessions: done.length, noShow: mine.filter((a) => a.status === "NO_SHOW").length, cancelled: mine.filter((a) => a.status === "CANCELLED").length, revenue: done.reduce((s, a) => s + (a.price ?? 0), 0), patients: uniquePatients };
  }).sort((a, b) => b.revenue - a.revenue);

  const upcoming = await prisma.appointment.findMany({ where: { startAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } }, select: { patientId: true }, distinct: ["patientId"] });
  const hasUpcoming = new Set(upcoming.map((u) => u.patientId));
  const cutoff = addDays(new Date(), -riskDays);
  const atRisk = activePatients
    .filter((p) => !hasUpcoming.has(p.id) && (!p.appointments[0] || p.appointments[0].startAt < cutoff))
    .map((p) => ({ id: p.id, fullName: `${p.firstName} ${p.lastName}`, fileNumber: p.fileNumber, phone: p.phone, therapist: p.primaryTherapist ? `${p.primaryTherapist.user.firstName} ${p.primaryTherapist.user.lastName}` : null, lastVisit: p.appointments[0]?.startAt ?? null, daysSince: p.appointments[0] ? Math.floor((Date.now() - p.appointments[0].startAt.getTime()) / 86400000) : null }))
    .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));

  // روند ماهانه بیماران جدید (۶ ماه اخیر)
  const months: { label: string; from: Date; to: Date }[] = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); months.push({ label: d.toISOString().slice(0, 7), from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59) }); }
  const newPatientsTrend = await Promise.all(months.map(async (m) => ({ month: m.from.toISOString(), count: await prisma.patient.count({ where: { createdAt: { gte: m.from, lte: m.to } } }), sessions: await prisma.appointment.count({ where: { status: "DONE", startAt: { gte: m.from, lte: m.to } } }) })));

  res.json({
    range: { from, to },
    leads: { total: leadTotal, converted, rate: leadTotal ? Math.round((converted / leadTotal) * 100) : 0, byStatus: leadCounts },
    appointments: { total: appts.length, byStatus, noShowRate, webBookings },
    newPatients,
    perTherapist,
    atRisk,
    newPatientsTrend,
  });
});

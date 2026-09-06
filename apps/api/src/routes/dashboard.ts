import { Router } from "express";
import { startOfDay, endOfDay, addDays, daysUntilBirthday } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { patientFinancialSummary } from "../lib/finance.js";
import { getSettingNumber } from "../lib/settings.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

const apptInclude = {
  patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true } },
  therapist: { select: { id: true, color: true, user: { select: { firstName: true, lastName: true } } } },
} as const;
const shapeAppt = (a: any) => ({ ...a, patientName: `${a.patient.firstName} ${a.patient.lastName}`, therapistName: `${a.therapist.user.firstName} ${a.therapist.user.lastName}`, therapistColor: a.therapist.color });

dashboardRouter.get("/", async (req, res) => {
  const role = req.user!.role;
  const today = new Date();
  const dayRange = { gte: startOfDay(today), lte: endOfDay(today) };

  if (role === "PATIENT") {
    const patientId = req.user!.patientId!;
    const [patient, finance, next, recentProgress, goals, homePrograms, notifications] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId }, include: { primaryTherapist: { include: { user: { select: { firstName: true, lastName: true } } } } } }),
      patientFinancialSummary(patientId),
      prisma.appointment.findMany({ where: { patientId, startAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } }, include: apptInclude, orderBy: { startAt: "asc" }, take: 5 }),
      prisma.progressNote.findMany({ where: { patientId, visibleToPatient: true }, orderBy: { date: "desc" }, take: 3, include: { therapist: { include: { user: { select: { firstName: true, lastName: true } } } } } }),
      prisma.treatmentGoal.findMany({ where: { patientId, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.homeProgram.count({ where: { patientId, isActive: true } }),
      prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);
    const sessionsDone = await prisma.appointment.count({ where: { patientId, status: "DONE" } });
    return res.json({ role, patient, finance, upcoming: next.map(shapeAppt), recentProgress, goals, homePrograms, sessionsDone, notifications });
  }

  if (role === "THERAPIST") {
    const therapistId = req.user!.therapistId!;
    const [todayAppts, weekCount, patientsCount, doneMonth, recentNotes, pendingNotes] = await Promise.all([
      prisma.appointment.findMany({ where: { therapistId, startAt: dayRange, status: { not: "CANCELLED" } }, include: apptInclude, orderBy: { startAt: "asc" } }),
      prisma.appointment.count({ where: { therapistId, startAt: { gte: startOfDay(today), lte: endOfDay(addDays(today, 6)) }, status: { in: ["SCHEDULED", "CONFIRMED"] } } }),
      prisma.patient.count({ where: { primaryTherapistId: therapistId, status: "ACTIVE" } }),
      prisma.appointment.count({ where: { therapistId, status: "DONE", startAt: { gte: addDays(today, -30) } } }),
      prisma.progressNote.findMany({ where: { therapistId }, orderBy: { date: "desc" }, take: 5, include: { patient: { select: { firstName: true, lastName: true, fileNumber: true } } } }),
      prisma.appointment.findMany({ where: { therapistId, status: { in: ["CONFIRMED", "SCHEDULED"] }, startAt: { lt: new Date(), gte: addDays(today, -7) } }, include: apptInclude, orderBy: { startAt: "desc" }, take: 10 }),
    ]);
    const dailyLogged = await prisma.dailyPerformance.count({ where: { therapistUserId: req.user!.id, date: dayRange } });
    return res.json({ role, todayAppointments: todayAppts.map(shapeAppt), weekCount, patientsCount, doneMonth, recentNotes, pendingSessions: pendingNotes.map(shapeAppt), dailyLogged: dailyLogged > 0 });
  }

  // ADMIN / SECRETARY
  const birthdayDays = await getSettingNumber("crm.birthdayDaysAhead", 7);
  const [todayAppts, tomorrowAppts, patientsActive, patientsTotal, newLeads, leadsFollowUp, openFeedback, paymentsMonth, newPatientsMonth, unfixedTomorrow, withBirth, recentSms, therapists] = await Promise.all([
    prisma.appointment.findMany({ where: { startAt: dayRange, status: { not: "CANCELLED" } }, include: apptInclude, orderBy: { startAt: "asc" } }),
    prisma.appointment.count({ where: { startAt: { gte: startOfDay(addDays(today, 1)), lte: endOfDay(addDays(today, 1)) }, status: { not: "CANCELLED" } } }),
    prisma.patient.count({ where: { status: "ACTIVE" } }),
    prisma.patient.count(),
    prisma.lead.count({ where: { status: "NEW" } }),
    prisma.lead.count({ where: { followUpAt: { lte: new Date() }, status: { in: ["NEW", "CONTACTED", "INTERESTED"] } } }),
    prisma.feedback.count({ where: { status: "OPEN" } }),
    prisma.payment.aggregate({ where: { date: { gte: addDays(today, -30) } }, _sum: { amount: true } }),
    prisma.patient.count({ where: { createdAt: { gte: addDays(today, -30) } } }),
    prisma.appointment.count({ where: { startAt: { gte: startOfDay(addDays(today, 1)), lte: endOfDay(addDays(today, 1)) }, status: "SCHEDULED" } }),
    prisma.patient.findMany({ where: { birthDate: { not: null }, status: { not: "ARCHIVED" } }, select: { id: true, firstName: true, lastName: true, birthDate: true, phone: true, fileNumber: true } }),
    prisma.smsLog.count({ where: { createdAt: dayRange } }),
    prisma.therapist.count({ where: { user: { isActive: true } } }),
  ]);
  const birthdays = withBirth.map((p) => ({ ...p, daysToBirthday: daysUntilBirthday(p.birthDate) })).filter((p) => p.daysToBirthday !== null && p.daysToBirthday <= birthdayDays).sort((a, b) => a.daysToBirthday! - b.daysToBirthday!);
  const debtors = await prisma.invoice.groupBy({ by: ["patientId"], where: { status: { in: ["ISSUED", "PARTIAL"] } }, _sum: { total: true, paid: true } });
  const totalDebt = debtors.reduce((s, d) => s + ((d._sum.total ?? 0) - (d._sum.paid ?? 0)), 0);
  // نمودار ۱۴ روز اخیر: جلسات انجام‌شده و درآمد
  const series: { date: string; sessions: number; income: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    const r = { gte: startOfDay(d), lte: endOfDay(d) };
    const [sessions, income] = await Promise.all([prisma.appointment.count({ where: { startAt: r, status: "DONE" } }), prisma.payment.aggregate({ where: { date: r }, _sum: { amount: true } })]);
    series.push({ date: d.toISOString(), sessions, income: income._sum.amount ?? 0 });
  }
  const statusCounts = await prisma.appointment.groupBy({ by: ["status"], where: { startAt: { gte: addDays(today, -30) } }, _count: { _all: true } });
  res.json({
    role,
    todayAppointments: todayAppts.map(shapeAppt),
    tomorrowAppts,
    unfixedTomorrow,
    patientsActive,
    patientsTotal,
    newPatientsMonth,
    newLeads,
    leadsFollowUp,
    openFeedback,
    incomeMonth: paymentsMonth._sum.amount ?? 0,
    totalDebt,
    debtorsCount: debtors.filter((d) => (d._sum.total ?? 0) - (d._sum.paid ?? 0) > 0).length,
    birthdays,
    smsToday: recentSms,
    therapists,
    series,
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
  });
});

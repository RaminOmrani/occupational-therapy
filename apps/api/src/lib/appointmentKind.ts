import { prisma } from "./prisma.js";
import { getSettingNumber } from "./settings.js";

/** اولین نوبتِ مراجعی که هنوز جلسه‌ای (غیر لغو) نداشته، «جلسه ارزیابی» است */
export async function defaultKind(patientId: string): Promise<"SESSION" | "ASSESSMENT"> {
  const prior = await prisma.appointment.count({ where: { patientId, status: { not: "CANCELLED" } } });
  return prior === 0 ? "ASSESSMENT" : "SESSION";
}

/** قیمت پیش‌فرض: برای ارزیابی از تنظیمات (اگر خالی نباشد)، وگرنه قیمت درمانگر/پیش‌فرض */
export async function defaultPrice(kind: string, therapistPrice: number | null | undefined): Promise<number | null> {
  if (kind === "ASSESSMENT") {
    const p = await getSettingNumber("schedule.assessmentPrice", 0);
    if (p > 0) return p;
  }
  return therapistPrice ?? null;
}

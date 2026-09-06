import { prisma } from "./prisma.js";

/** شماره‌گذاری یکتا و ترتیبی برای پرونده، لید و صورت‌حساب */
export async function nextNumber(name: "patient" | "lead" | "invoice", prefix: string, width = 5): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}${String(counter.value).padStart(width, "0")}`;
}

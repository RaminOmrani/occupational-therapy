import { prisma } from "./prisma.js";

export async function notifyUser(userId: string | null | undefined, title: string, body?: string, link?: string) {
  if (!userId) return;
  try {
    await prisma.notification.create({ data: { userId, title, body: body ?? null, link: link ?? null } });
  } catch (e) {
    console.error("notify failed", e);
  }
}

export async function notifyRole(role: string, title: string, body?: string, link?: string) {
  const users = await prisma.user.findMany({ where: { role, isActive: true }, select: { id: true } });
  await Promise.all(users.map((u) => notifyUser(u.id, title, body, link)));
}

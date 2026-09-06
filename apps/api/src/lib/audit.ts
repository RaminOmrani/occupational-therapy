import { prisma } from "./prisma.js";

export async function audit(userId: string | null | undefined, action: string, entity: string, entityId?: string | null, meta?: unknown) {
  try {
    await prisma.auditLog.create({
      data: { userId: userId ?? null, action, entity, entityId: entityId ?? null, meta: meta ? JSON.stringify(meta) : null },
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}

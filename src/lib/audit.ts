import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export async function logAudit(params: {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        details: params.details ?? undefined,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

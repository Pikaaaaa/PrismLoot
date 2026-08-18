import { prisma } from "@/lib/db";
import { ADMIN_ACTOR_ID } from "@/lib/admin/auth";

export async function writeAudit(input: {
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  actorId?: string | null;
}) {
  await prisma.adminAuditLog.create({
    data: {
      actorId: input.actorId === undefined ? ADMIN_ACTOR_ID : input.actorId,
      action: input.action,
      targetType: input.targetType ?? "",
      targetId: input.targetId ?? "",
      detail: input.detail ?? "",
    },
  });
}

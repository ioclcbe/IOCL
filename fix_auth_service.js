const fs = require("fs");
let f = "apps/api/src/modules/auth/auth.service.ts";
let c = fs.readFileSync(f, "utf8");

if (!c.includes("ChangePasswordInput")) {
  c = c.replace(/import type \{ LoginInput \} from "@iocl\/shared";/, "import type { LoginInput, ChangePasswordInput } from \"@iocl/shared\";");
  
  const fn = `
export async function changePassword(userId: string, input: ChangePasswordInput, meta: RequestMeta) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new ApiError(401, "UNAUTHORIZED", "User not active");

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(400, "INVALID_PASSWORD", "Current password is incorrect");

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, lastPasswordChangedAt: new Date(), authVersion: { increment: 1 } },
    });
    await tx.refreshToken.updateMany({ 
      where: { userId, revokedAt: null }, 
      data: { revokedAt: new Date(), revokeReason: "PASSWORD_CHANGED" } 
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        actorRole: user.role,
        entityType: "USER",
        entityId: userId,
        action: "PASSWORD_RESET" as any,
        changedFields: ["passwordHash", "lastPasswordChangedAt", "authVersion"],
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
  });
}
`;
  c += fn;
  fs.writeFileSync(f, c);
}
console.log("Added changePassword to service");

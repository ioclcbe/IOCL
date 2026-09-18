const fs = require("fs");
let f = "apps/api/src/modules/auth/auth.controller.ts";
let c = fs.readFileSync(f, "utf8");

if (!c.includes("changePassword")) {
  c += `
export async function changePassword(req: Request, res: Response) {
  await authService.changePassword(req.auth!.userId, req.body, requestMeta(req));
  res.clearCookie(env.COOKIE_NAME, cookieBase);
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: null, message: "Password changed successfully. Please log in again." });
}
`;
  fs.writeFileSync(f, c);
}
console.log("Added changePassword to controller");

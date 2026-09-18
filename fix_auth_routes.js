const fs = require("fs");
let f = "apps/api/src/modules/auth/auth.routes.ts";
let c = fs.readFileSync(f, "utf8");

if (!c.includes("changePasswordSchema")) {
  c = c.replace(/import \{ loginSchema \} from "@iocl\/shared";/, "import { loginSchema, changePasswordSchema } from \"@iocl/shared\";");
  c += `\nauthRouter.post("/change-password", authenticate, validateBody(changePasswordSchema), asyncHandler(controller.changePassword));\n`;
  fs.writeFileSync(f, c);
}
console.log("Added changePassword to routes");

const fs = require("fs");
let f = "packages/shared/src/index.ts";
let c = fs.readFileSync(f, "utf8");

if (!c.includes("changePasswordSchema")) {
  c = c.replace(
    /export type CreateUserInput = z\.input<typeof createUserSchema>;/,
    `export type CreateUserInput = z.input<typeof createUserSchema>;\n\nexport const changePasswordSchema = z.object({\n  currentPassword: z.string().min(1, "Current password is required"),\n  newPassword: passwordSchema,\n}).strict();\nexport type ChangePasswordInput = z.input<typeof changePasswordSchema>;`
  );
  fs.writeFileSync(f, c);
}
console.log("Added changePasswordSchema");

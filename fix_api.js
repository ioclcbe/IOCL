const fs = require("fs");
let f = "apps/web/lib/api.ts";
let c = fs.readFileSync(f, "utf8");

if (!c.includes("changePassword(")) {
  c = c.replace(/export async function logoutSession\(\) \{/, `export async function changePassword(payload: import("@iocl/shared").ChangePasswordInput) {
  return apiFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoutSession() {`);
  fs.writeFileSync(f, c);
}
console.log("Added changePassword to api.ts");

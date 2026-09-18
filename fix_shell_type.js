const fs = require("fs");
let f = "apps/web/components/layout/portal-shell.tsx";
let c = fs.readFileSync(f, "utf8");
c = c.replace(/async function handlePasswordChange\(e\)/, "async function handlePasswordChange(e: any)");
fs.writeFileSync(f, c);
console.log("Fixed e type");

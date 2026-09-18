const fs = require("fs");
let f = "apps/web/components/layout/portal-shell.tsx";
let c = fs.readFileSync(f, "utf8");
c = c.replace(/catch\(err\)/, "catch(err: any)");
fs.writeFileSync(f, c);
console.log("Fixed err type");

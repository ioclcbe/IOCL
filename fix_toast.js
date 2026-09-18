const fs = require("fs");
let f = "apps/web/components/layout/portal-shell.tsx";
let c = fs.readFileSync(f, "utf8");
c = c.replace(/import \{ changePassword \} from "\.\.\/\.\.\/lib\/api";/, "import { changePassword } from \"../../lib/api\";\\nimport { toast } from \"sonner\";");
fs.writeFileSync(f, c);
console.log("Added toast import");

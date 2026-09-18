const fs = require("fs");
let f = "apps/web/components/layout/portal-shell.tsx";
let c = fs.readFileSync(f, "utf8");
c = c.replace(/import \{ cn \} from "\.\.\/\.\.\/lib\/utils";/, "import { cn } from \"../../lib/utils\";\nimport { toast } from \"sonner\";\nimport { changePassword } from \"../../lib/api\";");
fs.writeFileSync(f, c);
console.log("Added imports");

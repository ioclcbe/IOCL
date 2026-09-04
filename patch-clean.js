
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "apps", "web", "components", "entry", "entry-wizard.tsx");
let content = fs.readFileSync(file, "utf-8");

content = content.replace(
  /crewType: \(d\.crewType as any\) \|\| p\.crewType,\s*crewType: \(d\.crewType as any\) \|\| p\.crewType,/g,
  "crewType: (d.crewType as any) || p.crewType,"
);

fs.writeFileSync(file, content);
console.log("Cleaned duplicates");


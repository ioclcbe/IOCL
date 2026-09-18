const fs = require("fs");
let f = "apps/web/app/(portal)/admin/reports/page.tsx";
let c = fs.readFileSync(f, "utf8");

c = c.replace(/\{products\.filter\(\(p\) => p\.value > 0\)\.map\(\(p\) => \(/g, "{products.map((p) => (");

// Remove the every zero check block entirely
const everyZeroBlockRegex = /\{products\.every\(\(p\) => p\.value === 0\) && \(\s*<tr>\s*<td colSpan=\{3\} className="px-5 py-8 text-center text-slate-400">\s*No product quantities recorded for this date\s*<\/td>\s*<\/tr>\s*\)\}/g;
c = c.replace(everyZeroBlockRegex, "");

fs.writeFileSync(f, c);
console.log("Fixed reports products filter");

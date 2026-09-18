const fs = require("fs");
let f = "apps/web/app/(portal)/admin/trucks/page.tsx";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  /<input type="date" className="field-input" value=\{expireDate\} onChange=\{\(e\) => setExpireDate\(e\.target\.value\)\} \/>/g,
  `<input type="text" inputMode="text" className="field-input" value={expireDate} onChange={(e) => setExpireDate(e.target.value)} placeholder="e.g. 31-12-2025 or Any text" />`
);

fs.writeFileSync(f, c);
console.log("Fixed trucks input type");

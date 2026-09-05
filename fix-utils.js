const fs = require('fs');
let file = fs.readFileSync('apps/web/lib/utils.ts', 'utf8');

file = file.replace(/export function formatIndiaDate[\s\S]*?\}\n/, 
export function formatIndiaDate(value: string | Date | null | undefined, withTime = false) {
  if (!value) return "Missing";
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
  }).format(date);
}
);

fs.writeFileSync('apps/web/lib/utils.ts', file);

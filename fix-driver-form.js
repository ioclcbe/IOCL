const fs = require('fs');
let file = fs.readFileSync('apps/web/app/(portal)/admin/drivers/page.tsx', 'utf8');

file = file.replace(/function parseDate[\s\S]*?return input;\n\s*\}/, '');
file = file.replace(/const handleDateInput[\s\S]*?\}\;\n/, '');
file = file.replace(/inputMode="numeric"/g, 'inputMode="text"');

fs.writeFileSync('apps/web/app/(portal)/admin/drivers/page.tsx', file);

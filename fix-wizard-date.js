const fs = require('fs');
let file = fs.readFileSync('apps/web/components/entry/entry-wizard.tsx', 'utf8');

file = file.replace(/<input readOnly type="date"/g, '<input readOnly type="text"');

fs.writeFileSync('apps/web/components/entry/entry-wizard.tsx', file);

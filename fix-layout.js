const fs = require('fs');
let file = fs.readFileSync('apps/web/app/(portal)/layout.tsx', 'utf8');

file = 'import { Suspense } from "react";\nimport { LoadingScreen } from "../../components/ui/loading-screen";\n' + file;
file = file.replace(
  /<PortalShell>\{children\}<\/PortalShell>/,
  '<Suspense fallback={<LoadingScreen />}><PortalShell>{children}</PortalShell></Suspense>'
);

fs.writeFileSync('apps/web/app/(portal)/layout.tsx', file);

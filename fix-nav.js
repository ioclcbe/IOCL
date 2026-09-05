const fs = require('fs');
let file = fs.readFileSync('apps/web/components/layout/portal-shell.tsx', 'utf8');

file = file.replace(
  /import \{ usePathname, useRouter \} from "next\/navigation";/,
  'import { usePathname, useRouter, useSearchParams } from "next/navigation";'
);

file = file.replace(
  /const pathname = usePathname\(\);/,
  'const pathname = usePathname();\n  const searchParams = useSearchParams();'
);

file = file.replace(
  /const activeExact = pathname === itemPath && \(\!itemQuery || \(typeof window \!\=\= "undefined" && window\.location\.search === \\?\$\{itemQuery\}\\)\);/g,
  'const activeExact = pathname === itemPath && (!itemQuery || searchParams.toString() === itemQuery);'
);

fs.writeFileSync('apps/web/components/layout/portal-shell.tsx', file);

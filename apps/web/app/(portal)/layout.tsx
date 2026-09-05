import { Suspense } from "react";
import { LoadingScreen } from "../../components/ui/loading-screen";
import { PortalShell } from "../../components/layout/portal-shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}><PortalShell>{children}</PortalShell></Suspense>;
}

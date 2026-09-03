"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  DownloadCloud,
  FileClock,
  FileSpreadsheet,
  Gauge,
  LogOut,
  Menu,
  Plus,
  ScanLine,
  ShieldCheck,
  Truck,
  Users,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { cn } from "../../lib/utils";
import { LoadingScreen } from "../ui/loading-screen";

interface NavItem { href: string; label: string; icon: LucideIcon; roles: string[]; exact?: boolean }
const nav: NavItem[] = [
  { href: "/dashboard",    label: "Control Room",     icon: Gauge,            roles: ["SUPERVISOR", "ADMIN"] },
  { href: "/entries/new", label: "IN Gate Scanner",      icon: ScanLine,             roles: ["ENTRY_GATE_SECURITY", "SUPERVISOR"] },
  { href: "/out",         label: "OUT Gate Scanner",  icon: ScanLine,         roles: ["EXIT_GATE_SECURITY", "SUPERVISOR"] },
  { href: "/entries?tab=in",  label: "IN-Gate Record",   icon: ArrowDownToLine,  roles: ["ENTRY_GATE_SECURITY", "EXIT_GATE_SECURITY", "SUPERVISOR", "ADMIN"] },
  { href: "/entries?tab=out", label: "OUT-Gate Record",  icon: ArrowUpFromLine,  roles: ["ENTRY_GATE_SECURITY", "EXIT_GATE_SECURITY", "SUPERVISOR", "ADMIN"] },
  { href: "/admin/tracking",label: "Live Tracking",    icon: Truck,            roles: ["ADMIN", "SUPERVISOR"] },
  { href: "/admin/records", label: "Admin Register",   icon: FileSpreadsheet,  roles: ["ADMIN"] },
  { href: "/admin/trucks",  label: "Truck Database",   icon: Truck,            roles: ["ADMIN"] },
  { href: "/admin/drivers", label: "Driver Database",  icon: Users,            roles: ["ADMIN"] },
  { href: "/admin/helpers", label: "Helper Database",  icon: Users,            roles: ["ADMIN"] },
  { href: "/admin/reports", label: "Reports & Export", icon: DownloadCloud,    roles: ["ADMIN", "SUPERVISOR"] },
  { href: "/admin/users",   label: "User Management",  icon: Users,            roles: ["ADMIN"] },
  { href: "/audit",         label: "Audit Trail",      icon: FileClock,        roles: ["SUPERVISOR", "ADMIN"] },
];

const roleLabels = {
  ENTRY_GATE_SECURITY: "Entry Gate Security",
  EXIT_GATE_SECURITY: "Exit Gate Security",
  SUPERVISOR: "Gate Supervisor",
  ADMIN: "System Administrator",
} as const;

function Clock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => { setTime(new Date()); const id = window.setInterval(() => setTime(new Date()), 1000); return () => window.clearInterval(id); }, []);
  if (!time) return <span>--:--:--</span>;
  return <span>{new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(time)}</span>;
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const visibleNav = useMemo(() => user ? nav.filter((item) => item.roles.includes(user.role)) : [], [user]);
  useEffect(() => {
    if (!user || pathname === "/unauthorized") return;
    const restricted =
      (pathname === "/dashboard" && !["SUPERVISOR", "ADMIN"].includes(user.role)) ||
      (pathname.startsWith("/entries/new") && !["ENTRY_GATE_SECURITY", "SUPERVISOR", "ADMIN"].includes(user.role)) ||
      (pathname.startsWith("/out") && !["EXIT_GATE_SECURITY", "SUPERVISOR", "ADMIN"].includes(user.role)) ||
      (pathname.startsWith("/admin") && user.role !== "ADMIN" && !(pathname.startsWith("/admin/reports") && user.role === "SUPERVISOR") && !(pathname.startsWith("/admin/tracking") && user.role === "SUPERVISOR")) ||
      (pathname.startsWith("/audit") && !["SUPERVISOR", "ADMIN"].includes(user.role));
    if (restricted) router.replace("/unauthorized");
  }, [pathname, router, user]);

  if (!ready || !user) return <LoadingScreen />;
  const consoleName = user.role === "EXIT_GATE_SECURITY" ? "Exit Security Console" : user.role === "ADMIN" ? "Administration Console" : "Gate Operations Console";

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-[286px] -translate-x-full bg-iocl-navy text-white shadow-2xl transition-transform duration-300 lg:translate-x-0", open && "translate-x-0")}> 
        <div className="navy-grid relative flex h-full flex-col overflow-hidden">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-iocl-orange/20 blur-3xl" />
          <div className="relative flex h-24 items-center gap-3 border-b border-white/10 px-6">
            <Image src="/indian-oil-logo.jpeg" alt="Indian Oil" width={58} height={58} className="rounded-full border-2 border-white/80" priority />
            <div><p className="text-lg font-black tracking-tight">Lorry Gate</p><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">Management System</p></div>
            <button type="button" aria-label="Close navigation" className="ml-auto rounded-xl p-2 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
          </div>
          <div className="mx-5 mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Terminal clock</span><span className={cn("inline-flex items-center gap-1.5 text-xs font-bold", online ? "text-emerald-300" : "text-amber-300")}><span className={cn("h-2 w-2 rounded-full", online ? "animate-pulse bg-emerald-400" : "bg-amber-400")} />{online ? "Connected" : "Offline"}</span></div>
            <p className="mt-3 text-2xl font-black"><Clock /></p><p className="mt-1 text-xs text-white/55">Indian Standard Time</p>
          </div>
          <nav className="relative mt-5 flex-1 space-y-1.5 overflow-y-auto px-4" aria-label="Primary navigation">
            {visibleNav.map((item) => {
              const [itemPath, itemQuery] = item.href.split("?");
              const activeExact = pathname === itemPath && (!itemQuery || (typeof window !== "undefined" && window.location.search === `?${itemQuery}`));
              const activeFuzzy = !itemQuery && item.href !== "/dashboard" && pathname.startsWith(item.href);
              const active = activeExact || activeFuzzy;
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} className={cn("flex min-h-13 items-center gap-3 rounded-2xl px-4 text-sm font-bold transition", active ? "bg-iocl-orange text-white shadow-lg shadow-orange-950/20" : "text-white/70 hover:bg-white/10 hover:text-white")}><Icon className="h-5 w-5" />{item.label}</Link>;
            })}
          </nav>
          <div className="relative border-t border-white/10 p-4">
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-black">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user.name}</p><p className="truncate text-xs text-white/50">{user.employeeCode} · {roleLabels[user.role]}</p></div>
            </div>
            <button type="button" onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white/65 transition hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /> Secure logout</button>
          </div>
        </div>
      </aside>
      {open ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} /> : null}
      <div className="lg:pl-[286px]">
        <header className="sticky top-0 z-30 flex h-18 items-center border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button type="button" aria-label="Open navigation" onClick={() => setOpen(true)} className="mr-3 rounded-xl p-2.5 text-iocl-navy hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-2 text-sm font-bold text-iocl-navy"><ShieldCheck className="h-5 w-5 text-iocl-orange" />{consoleName}</div>
          <div className="ml-auto"><span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold", online ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800")}>{online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{online ? "Network online" : "Network offline"}</span></span></div>
        </header>
        {!online ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-bold text-amber-900">Network unavailable. Do not submit a gate movement until connectivity is restored.</div> : null}
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">{children}</main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {visibleNav
          .filter(item => !(user?.role === "ENTRY_GATE_SECURITY" && item.href === "/dashboard"))
          .slice(0, 3)
          .map((item) => { 
            const Icon = item.icon; 
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)); 
            return <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold", active ? "bg-iocl-orange text-white" : "text-slate-500")}><Icon className="h-5 w-5" />{item.label.replace("Gate ", "")}</Link>; 
          })}
      </nav>
    </div>
  );
}

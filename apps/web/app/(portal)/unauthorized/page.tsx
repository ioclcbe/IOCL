"use client";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useAuth } from "../../../lib/auth-context";

export default function UnauthorizedPage() {
  const { user } = useAuth();
  const home = user?.role === "EXIT_GATE_SECURITY" ? "/out" : user?.role === "ENTRY_GATE_SECURITY" ? "/entries/new" : user?.role === "ADMIN" ? "/admin/records" : "/dashboard";
  return <div className="mx-auto max-w-xl py-16"><div className="panel p-8 text-center"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-600"><ShieldX className="h-10 w-10" /></span><h1 className="mt-6 text-3xl font-black text-iocl-navy">Access not authorized</h1><p className="mt-3 text-sm leading-6 text-slate-500">Your assigned gate role does not permit this page. The attempt was stopped before protected data was loaded.</p><Link href={home} className="mt-6 inline-block"><Button>Return to My Console</Button></Link></div></div>;
}

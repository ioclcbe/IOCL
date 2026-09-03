"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LogOut as ExitIcon,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Truck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import type { DashboardSummary } from "@iocl/shared";
import { getDashboard } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { formatIndiaDate, formatIndiaTime } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { PageHeader } from "../../../components/ui/page-header";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDashboard());
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Dashboard could not be loaded";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = [
    { label: "Today's entries", value: data?.total ?? 0, icon: Truck, tone: "bg-blue-50 text-blue-700", note: "All recorded movements" },
    { label: "Currently inside", value: data?.open ?? 0, icon: UsersRound, tone: "bg-emerald-50 text-emerald-700", note: "Open IN movements" },
    { label: "Exited today", value: data?.exited ?? 0, icon: ExitIcon, tone: "bg-slate-100 text-slate-700", note: "Locked after OUT" },
    { label: "TT mismatches", value: data?.mismatches ?? 0, icon: AlertTriangle, tone: "bg-orange-50 text-orange-700", note: "Requires verification" },
    { label: "Safety exceptions", value: data?.safetyExceptions ?? 0, icon: ShieldAlert, tone: "bg-red-50 text-red-700", note: "Checklist deviations" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={data ? `${data.facilityCode} · ${data.gateCode} · ${formatIndiaDate(data.businessDate)}` : "Operations overview"}
        title="IN Gate Control Room"
        description="Live operational snapshot for today's lorry entries, verification alerts and vehicle movement status."
        action={
          user?.role !== "ADMIN" ? (
            <Link href="/entries/new">
              <Button icon={<Plus className="h-5 w-5" />} className="w-full sm:w-auto">Create IN Entry</Button>
            </Link>
          ) : undefined
        }
      />

      {error ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-black">Live data unavailable</p><p className="mt-1 text-xs text-red-700">{error}</p></div>
          <Button type="button" variant="secondary" onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="panel relative overflow-hidden p-5">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-100/80" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-iocl-navy">{loading ? "—" : stat.value}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">{stat.note}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.tone}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </section>      <section className="mt-6 flex flex-col xl:grid gap-6 xl:grid-cols-[.85fr_1.5fr]">
        <div className="space-y-6">
          {user?.role !== "ADMIN" && (
            <div className="panel relative overflow-hidden bg-iocl-navy p-6 text-white">
              <div className="navy-grid absolute inset-0 opacity-60" />
              <div className="relative">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-iocl-orange">
                  <ScanLine className="h-6 w-6" />
                </span>
                <h2 className="mt-5 text-2xl font-black">Ready for next truck?</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">Scan the driver or crew pass and complete the safety verification in a guided workflow.</p>
                <Link href="/entries/new" className="mt-6 block">
                  <Button className="w-full bg-white text-iocl-navy shadow-none hover:bg-orange-50" icon={<ScanLine className="h-5 w-5" />}>
                    Open QR Scanner
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {["ADMIN", "SUPERVISOR"].includes(user?.role || "") && data && (
            <div className="panel p-0 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-black text-iocl-navy">Daily Volume Outflow (Liters)</h2>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="p-5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Petrol</p>
                    <p className="text-2xl font-black text-iocl-orange">{data.quantities.petrol} L</p>
                    <div className="mt-3 text-xs text-slate-600 flex flex-col gap-1.5">
                      <div className="flex justify-between border-b border-slate-50 pb-1"><span>MS</span> <span className="font-mono">{data.quantities.ms}</span></div>
                      <div className="flex justify-between border-b border-slate-50 pb-1"><span>XP95</span> <span className="font-mono">{data.quantities.xpms}</span></div>
                      <div className="flex justify-between pb-1"><span>EBMS</span> <span className="font-mono">{data.quantities.ebms}</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Diesel</p>
                    <p className="text-2xl font-black text-blue-600">{data.quantities.diesel} L</p>
                    <div className="mt-3 text-xs text-slate-600 flex flex-col gap-1.5">
                      <div className="flex justify-between border-b border-slate-50 pb-1"><span>HSD</span> <span className="font-mono">{data.quantities.hsd}</span></div>
                      <div className="flex justify-between pb-1"><span>BIO HSD</span> <span className="font-mono">{data.quantities.bioHsd}</span></div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Other Products</p>
                    <div className="mt-1 text-xs text-slate-600 flex flex-col gap-1">
                      <div className="flex justify-between"><span>SKO</span> <span className="font-mono">{data.quantities.sko}</span></div>
                      <div className="flex justify-between"><span>FO</span> <span className="font-mono">{data.quantities.fo}</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">&nbsp;</p>
                    <div className="mt-1 text-xs text-slate-600 flex flex-col gap-1">
                      <div className="flex justify-between"><span>LDO</span> <span className="font-mono">{data.quantities.ldo}</span></div>
                      <div className="flex justify-between"><span>XG</span> <span className="font-mono">{data.quantities.xg}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="panel p-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${data && !error ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {data && !error ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <div>
                <p className="font-black text-iocl-navy">{data && !error ? "Core services responding" : "Service check pending"}</p>
                <p className="mt-0.5 text-xs text-slate-500">Status is based on the latest authenticated database response</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              {[
                ["Authenticated API", data && !error ? "Responding" : "Unknown"],
                ["PostgreSQL query", data && !error ? "Responding" : "Unknown"],
                ["Audit policy", "Enabled"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-slate-500">{label}</span>
                  <span className={`font-bold ${value === "Unknown" ? "text-amber-700" : "text-emerald-700"}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-lg font-black text-iocl-navy">Today’s open IN entries</h2>
              <p className="mt-1 text-xs text-slate-500">Open vehicles currently inside the terminal</p>
            </div>
            <Link href="/entries" className="inline-flex items-center gap-1 text-sm font-bold text-iocl-orange hover:underline">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse bg-gradient-to-r from-white via-slate-50 to-white" />) : null}
            {!loading && (data?.recent ?? []).map((entry) => (
              <Link key={entry.id} href={`/entries/${entry.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[1.1fr_1fr_.8fr_auto] sm:items-center sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-iocl-navy">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-black tracking-wide text-iocl-navy">{entry.actualTankTruckNumber}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{entry.displaySerial}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{entry.driverName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{entry.customerDestination}</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <Clock3 className="h-4 w-4" /> {formatIndiaTime(entry.timeIn)}
                </div>
                <div className="flex gap-2">
                  <Badge tone={entry.ttNumberMatch ? "green" : "red"}>{entry.ttNumberMatch ? "TT Matched" : "Mismatch"}</Badge>
                  <Badge tone={entry.status === "IN" ? "blue" : "slate"}>{entry.status}</Badge>
                </div>
              </Link>
            ))}
            {!loading && data && data.recent.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Truck className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-bold text-slate-600">No vehicle entries today</p>
                <p className="mt-1 text-sm text-slate-400">Create the first IN entry from the scanner.</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

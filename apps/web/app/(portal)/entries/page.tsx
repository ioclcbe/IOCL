"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GateEntryRecord } from "@iocl/shared";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  Clock3,
  LogIn,
  LogOut,
  RefreshCw,
  ScanLine,
  Search,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { listEntries } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { formatIndiaDate, formatIndiaTime } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { PageHeader } from "../../../components/ui/page-header";

function useEntriesPanel(status?: "IN" | "OUT") {
  const [entries, setEntries] = useState<GateEntryRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void listEntries({ search: search || undefined, status, page: 1, pageSize: 50 })
        .then((result) => { if (active) { setEntries(result.items); } })
        .catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : "Failed to load"); setEntries([]); } })
        .finally(() => active && setLoading(false));
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, status, reload]);

  return { entries, search, setSearch, loading, error, reload: () => setReload((v) => v + 1) };
}

function EntryRow({ entry }: { entry: GateEntryRecord }) {
  const isIn = entry.status === "IN";
  return (
    <Link
      href={`/entries/${entry.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 transition hover:border-orange-200 hover:bg-orange-50 hover:shadow-sm"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isIn ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"} transition group-hover:bg-iocl-orange group-hover:text-white`}>
        {isIn ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black tracking-wide text-iocl-navy">{entry.actualTankTruckNumber}</p>
        <p className="truncate text-xs text-slate-500">{entry.driverName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          <Clock3 className="h-3 w-3 shrink-0" />
          <span className="whitespace-nowrap">{formatIndiaTime(entry.timeIn)}</span>
          {entry.timeOut ? <><span className="shrink-0">→</span><span className="whitespace-nowrap">{formatIndiaTime(entry.timeOut)}</span></> : null}
          <span className="ml-1 text-slate-300 shrink-0">•</span>
          <span className="whitespace-nowrap">{formatIndiaDate(entry.entryDate)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {entry.invoiceNumber ? (
          <Badge tone="slate">Inv: ...{entry.invoiceNumber.slice(-4)}</Badge>
        ) : null}
        <p className="text-[10px] font-bold text-slate-400">{entry.displaySerial}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-iocl-orange" />
    </Link>
  );
}

function Panel({
  title, subtitle, icon, gradientFrom, gradientTo, borderColor, entries, search, onSearch, loading, error, onReload, emptyText, emptySubtext,
}: {
  title: string; subtitle: string; icon: React.ReactNode;
  gradientFrom: string; gradientTo: string; borderColor: string;
  entries: GateEntryRecord[]; search: string; onSearch: (v: string) => void;
  loading: boolean; error: string | null; onReload: () => void;
  emptyText: string; emptySubtext: string;
}) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-3xl border-2 ${borderColor} bg-white shadow-sm`}>
      {/* Header */}
      <div className={`bg-gradient-to-br ${gradientFrom} ${gradientTo} px-5 py-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-white shadow-inner">
              {icon}
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/70">Today's Records</p>
              <p className="text-lg font-black text-white leading-tight">{title}</p>
              <p className="text-xs text-white/60 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="flex h-12 min-w-12 flex-col items-center justify-center rounded-2xl bg-white/20 px-3">
            <span className="text-xl font-black text-white leading-none">{loading ? "…" : entries.length}</span>
            <span className="text-[9px] font-bold text-white/60 uppercase">Records</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field-input py-2.5 pl-10 text-sm"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search truck, driver, destination…"
          />
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="m-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</div>
          <Button type="button" variant="secondary" onClick={onReload} icon={<RefreshCw className="h-3.5 w-3.5" />}>Retry</Button>
        </div>
      ) : null}

      {/* List */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 340px)", minHeight: "200px" }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)
          : entries.length === 0
          ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Truck className="h-12 w-12 text-slate-200" />
              <p className="mt-3 text-sm font-black text-slate-500">{emptyText}</p>
              <p className="mt-1 text-xs text-slate-400">{emptySubtext}</p>
            </div>
          )
          : entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)
        }
      </div>
    </div>
  );
}

export default function EntriesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab"); // "in" | "out" | null
  const inRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the panel specified by ?tab= on first load
  useEffect(() => {
    if (tab === "in") inRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (tab === "out") outRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [tab]);

  const inPanel = useEntriesPanel("IN");
  const outPanel = useEntriesPanel("OUT");

  return (
    <div>
      <PageHeader
        eyebrow="Today's operations"
        title={tab === "in" ? "IN-Gate Records" : tab === "out" ? "OUT-Gate Records" : "Gate Records"}
        description={tab === "in" ? "Vehicles currently inside the facility. Click any record to view details or edit." : tab === "out" ? "Vehicles that have completed the exit process. Click any record to view full details." : "Click any record to view full details or edit."}
        action={
          user?.role !== "ADMIN" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {user?.role !== "EXIT_GATE_SECURITY"
                ? <Link href="/entries/new"><Button icon={<ScanLine className="h-5 w-5" />}>IN Scanner</Button></Link>
                : <Link href="/out"><Button icon={<Truck className="h-5 w-5" />}>Process Vehicle OUT</Button></Link>
              }
            </div>
          ) : undefined
        }
      />

      <div className={tab ? "mx-auto max-w-5xl" : "grid gap-5 lg:grid-cols-2"}>
        {/* IN-GATE PANEL */}
        {(tab === "in" || !tab) && (
          <div ref={inRef} id="panel-in">
            <Panel
              title="IN-Gate Records"
              subtitle="Vehicles that have entered the facility"
              icon={<ArrowDownToLine className="h-6 w-6" />}
              gradientFrom="from-blue-700"
              gradientTo="to-blue-500"
              borderColor="border-blue-200"
              entries={inPanel.entries}
              search={inPanel.search}
              onSearch={inPanel.setSearch}
              loading={inPanel.loading}
              error={inPanel.error}
              onReload={inPanel.reload}
              emptyText="No vehicles have been checked IN today"
              emptySubtext="Scan a crew QR to create a new IN entry"
            />
          </div>
        )}

        {/* OUT-GATE PANEL */}
        {(tab === "out" || !tab) && (
          <div ref={outRef} id="panel-out">
            <Panel
              title="OUT-Gate Records"
              subtitle="Vehicles that have exited with invoice"
              icon={<ArrowUpFromLine className="h-6 w-6" />}
              gradientFrom="from-emerald-700"
              gradientTo="to-emerald-500"
              borderColor="border-emerald-200"
              entries={outPanel.entries}
              search={outPanel.search}
              onSearch={outPanel.setSearch}
              loading={outPanel.loading}
              error={outPanel.error}
              onReload={outPanel.reload}
              emptyText="No vehicles have exited today"
              emptySubtext="OUT records appear here after invoice scan"
            />
          </div>
        )}
      </div>
    </div>
  );
}

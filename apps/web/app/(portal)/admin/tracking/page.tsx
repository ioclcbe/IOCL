"use client";

import { useEffect, useState } from "react";
import type { GateEntryRecord, DashboardSummary } from "@iocl/shared";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { listEntries, getDashboard } from "../../../../lib/api";
import { formatIndiaDate, formatIndiaTime, todayIndiaKey } from "../../../../lib/utils";
import { PageHeader } from "../../../../components/ui/page-header";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";

export default function LiveTrackingPage() {
  const [inEntries, setInEntries] = useState<GateEntryRecord[]>([]);
  const [outEntries, setOutEntries] = useState<GateEntryRecord[]>([]);
  const [summaryData, setSummaryData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const today = todayIndiaKey();
      // Fetch both IN and OUT status. The backend typically defaults to today's date
      const [inRes, outRes, dashRes] = await Promise.all([
        listEntries({ status: "IN", pageSize: 100, dateFrom: today, dateTo: today }),
        listEntries({ status: "OUT", pageSize: 100, dateFrom: today, dateTo: today }),
        getDashboard()
      ]);
      
      setInEntries(inRes.items || []);
      setOutEntries(outRes.items || []);
      setSummaryData(dashRes);
    } catch (err) {
      toast.error("Failed to load tracking data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const TrackingRow = ({ item }: { item: GateEntryRecord }) => (
    <tr className="hover:bg-slate-50/50 group transition-colors">
      <td className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-slate-400" />
          <span className="font-black text-iocl-navy uppercase tracking-wider">{item.actualTankTruckNumber}</span>
        </div>
      </td>
      <td className="p-4 border-b border-slate-100 font-medium text-sm text-slate-700">
        {item.driverName}
      </td>
      <td className="p-4 border-b border-slate-100 text-xs font-mono text-slate-500">
        <div className="flex flex-col gap-1">
          <span>IN: {formatIndiaTime(item.timeIn)}</span>
          {item.timeOut ? <span>OUT: {formatIndiaTime(item.timeOut)}</span> : null}
        </div>
      </td>
      <td className="p-4 border-b border-slate-100 text-right">
        {item.status === "OUT" ? (
          <Badge tone="slate">EXITED</Badge>
        ) : (
          <Badge tone="blue" className="animate-pulse">INSIDE</Badge>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Admin A Control Room"
        title="Live Gate Tracking"
        description={`Monitoring live gate activity for ${formatIndiaDate(new Date())}`}
        action={<Button onClick={load} loading={loading} icon={<RefreshCw className="h-4 w-4" />}>Refresh Data</Button>}
      />

      
      {summaryData && (
        <div className="panel p-0 overflow-hidden mt-6">
          <div className="bg-slate-50 border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-black text-iocl-navy">Daily Volume Outflow (Liters)</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Petrol</p>
                <p className="text-2xl font-black text-iocl-orange">{summaryData.quantities.petrol} L</p>
                <div className="mt-3 text-xs text-slate-600 flex flex-col gap-1.5">
                  <div className="flex justify-between border-b border-slate-50 pb-1"><span>MS</span> <span className="font-mono">{summaryData.quantities.ms}</span></div>
                  <div className="flex justify-between border-b border-slate-50 pb-1"><span>XP95</span> <span className="font-mono">{summaryData.quantities.xpms}</span></div>
                  <div className="flex justify-between pb-1"><span>EBMS</span> <span className="font-mono">{summaryData.quantities.ebms}</span></div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Diesel</p>
                <p className="text-2xl font-black text-blue-600">{summaryData.quantities.diesel} L</p>
                <div className="mt-3 text-xs text-slate-600 flex flex-col gap-1.5">
                  <div className="flex justify-between border-b border-slate-50 pb-1"><span>HSD</span> <span className="font-mono">{summaryData.quantities.hsd}</span></div>
                  <div className="flex justify-between pb-1"><span>BIO HSD</span> <span className="font-mono">{summaryData.quantities.bioHsd}</span></div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Other Products</p>
                <div className="mt-1 text-xs text-slate-600 flex flex-col gap-1">
                  <div className="flex justify-between"><span>SKO</span> <span className="font-mono">{summaryData.quantities.sko}</span></div>
                  <div className="flex justify-between"><span>FO</span> <span className="font-mono">{summaryData.quantities.fo}</span></div>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">&nbsp;</p>
                <div className="mt-1 text-xs text-slate-600 flex flex-col gap-1">
                  <div className="flex justify-between"><span>LDO</span> <span className="font-mono">{summaryData.quantities.ldo}</span></div>
                  <div className="flex justify-between"><span>XG</span> <span className="font-mono">{summaryData.quantities.xg}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="grid gap-6 lg:grid-cols-2 mt-4">
        {/* IN-GATE PANEL */}
        <section className="panel overflow-hidden flex flex-col">
          <div className="bg-blue-50 border-b border-blue-100 p-4 flex items-center justify-between">
            <h2 className="font-black text-blue-900 flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-blue-600" /> Currently In-Gate
            </h2>
            <Badge tone="blue">{inEntries.length} Trucks</Badge>
          </div>
          <div className="flex-1 overflow-auto max-h-[600px]">
            {loading ? (
              <div className="p-10 text-center text-slate-400">Loading...</div>
            ) : inEntries.length === 0 ? (
              <div className="p-10 text-center text-slate-400">No trucks currently inside the terminal.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <tbody>
                  {inEntries.map(item => <TrackingRow key={item.id} item={item} />)}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* OUT-GATE PANEL */}
        <section className="panel overflow-hidden flex flex-col">
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
            <h2 className="font-black text-slate-700 flex items-center gap-2">
              <ArrowUpFromLine className="h-5 w-5 text-slate-400" /> Completed Today (Exit)
            </h2>
            <Badge tone="slate">{outEntries.length} Trucks</Badge>
          </div>
          <div className="flex-1 overflow-auto max-h-[600px]">
            {loading ? (
              <div className="p-10 text-center text-slate-400">Loading...</div>
            ) : outEntries.length === 0 ? (
              <div className="p-10 text-center text-slate-400">No exits recorded today.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <tbody>
                  {outEntries.map(item => <TrackingRow key={item.id} item={item} />)}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

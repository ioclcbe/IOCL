"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../../../../lib/api";
import { formatIndiaDate } from "../../../../lib/utils";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/ui/page-header";
import { Badge } from "../../../../components/ui/badge";

export default function DriversPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", drivingLicenseNumber: "", drivingLicenseExpiryDate: "", passValidUntil: "" });

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/masters/drivers");
      setItems(res);
    } catch (e) { toast.error("Could not load drivers"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function addDriver() {
    if (!form.name || !form.drivingLicenseNumber || !form.drivingLicenseExpiryDate || !form.passValidUntil) {
      return toast.error("Please fill all fields");
    }
    setBusy(true);
    try {
      await apiFetch("/masters/drivers", { method: "POST", body: JSON.stringify({ ...form, isActive: true }) });
      toast.success("Driver added");
      setForm({ name: "", drivingLicenseNumber: "", drivingLicenseExpiryDate: "", passValidUntil: "" });
      setShowCreate(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteDriver(id: string) {
    if (!confirm("Are you sure you want to delete this driver?")) return;
    setBusy(true);
    try {
      await apiFetch(`/masters/drivers/${id}`, { method: "DELETE" });
      toast.success("Driver deleted");
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader 
        eyebrow="Admin · Master Data" 
        title="Drivers Database" 
        description="Manage the database of valid drivers for manual entry." 
        action={<Button type="button" onClick={() => setShowCreate(!showCreate)} icon={<Plus className="h-5 w-5" />}>Add Driver</Button>} 
      />

      {showCreate && (
        <section className="panel mb-6 p-5">
          <h2 className="text-lg font-black text-iocl-navy">Add New Driver</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label><span className="field-label">Driver Name</span><input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="RAMESH KUMAR" /></label>
            <label><span className="field-label">DL Number</span><input className="field-input" value={form.drivingLicenseNumber} onChange={(e) => setForm({ ...form, drivingLicenseNumber: e.target.value })} placeholder="TN7420210005690" /></label>
            <label><span className="field-label">DL Expiry Date</span><input type="date" className="field-input" value={form.drivingLicenseExpiryDate} onChange={(e) => setForm({ ...form, drivingLicenseExpiryDate: e.target.value })} /></label>
            <label><span className="field-label">Pass Valid Until</span><input type="date" className="field-input" value={form.passValidUntil} onChange={(e) => setForm({ ...form, passValidUntil: e.target.value })} /></label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button type="button" loading={busy} onClick={addDriver}>Save Driver</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </section>
      )}

      <div className="panel overflow-hidden">
        {loading ? <div className="p-10 text-center text-slate-500">Loading drivers...</div> : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="p-4">Driver Name</th>
                <th className="p-4">DL Number</th>
                <th className="p-4">DL Expiry</th>
                <th className="p-4">Pass Validity</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-bold text-iocl-navy">{item.name}</td>
                  <td className="p-4 font-mono text-xs">{item.drivingLicenseNumber}</td>
                  <td className="p-4">{formatIndiaDate(item.drivingLicenseExpiryDate)}</td>
                  <td className="p-4">{formatIndiaDate(item.passValidUntil)}</td>
                  <td className="p-4 text-right">
                    <button type="button" onClick={() => deleteDriver(item.id)} className="text-red-500 hover:text-red-700 transition" disabled={busy}>
                      <Trash2 className="h-4 w-4 inline-block" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">No drivers found in database.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

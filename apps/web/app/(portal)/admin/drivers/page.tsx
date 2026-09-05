"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getAccessToken } from "../../../../lib/api";
import { formatIndiaDate } from "../../../../lib/utils";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/ui/page-header";
import { Badge } from "../../../../components/ui/badge";

export default function DriversPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", drivingLicenseNumber: "", drivingLicenseExpiryDate: "", passValidUntil: "", crewId: "" });

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/masters/drivers");
      setItems(res);
      setSelectedIds([]);
    } catch (e) { toast.error("Could not load drivers"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setBusy(true);
    try {
      const token = getAccessToken();
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/masters/drivers/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Successfully imported ${data.inserted} drivers`);
        load();
      } else {
        toast.error(data.error?.message || "Upload failed");
      }
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
      e.target.value = ""; // Reset input
    }
  }

  function parseDate(input: string) {
    const parts = input.split(/[-/]/);
    if (parts.length === 3 && parts[2] && parts[1] && parts[0] && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return input;
  }

  const handleDateInput = (val: string, field: 'drivingLicenseExpiryDate' | 'passValidUntil') => {
    const digits = val.replace(/\D/g, '').substring(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.substring(0,2)}-${digits.substring(2,4)}-${digits.substring(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.substring(0,2)}-${digits.substring(2)}`;
    }
    setForm(prev => ({ ...prev, [field]: formatted }));
  };

  async function addDriver() {
    if (!form.name || !form.drivingLicenseNumber || !form.drivingLicenseExpiryDate || !form.passValidUntil) {
      return toast.error("Please fill all fields");
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        drivingLicenseExpiryDate: parseDate(form.drivingLicenseExpiryDate),
        passValidUntil: parseDate(form.passValidUntil),
        isActive: true
      };
      await apiFetch("/masters/drivers", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Driver added");
      setForm({ name: "", drivingLicenseNumber: "", drivingLicenseExpiryDate: "", passValidUntil: "", crewId: "" });
      setShowCreate(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function bulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;
    setBusy(true);
    try {
      await apiFetch('/masters/drivers/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: selectedIds }) });
      toast.success(`Deleted ${selectedIds.length} items`);
      setSelectedIds([]);
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
      <h1 className="text-2xl font-black tracking-tight text-iocl-navy">Driver Management</h1>
      <p className="mt-1 text-sm text-slate-500">Manage the master list of authorized drivers.</p>

      <PageHeader 
        eyebrow="Admin · Master Data" 
        title="Drivers Database" 
        description="Manage the database of valid drivers for manual entry." 
        action={
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-500">Total Drivers: <span className="font-black text-iocl-navy">{items.length}</span></span>
            <div className="flex gap-2">
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700">
                Upload Excel
              </span>
              <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} disabled={busy} />
            </label>
            {selectedIds.length > 0 && (
              <Button type="button" variant="ghost" onClick={bulkDelete} disabled={busy} className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200">
                <Trash2 className="h-4 w-4 mr-2" /> Delete Selected ({selectedIds.length})
              </Button>
            )}
            <Button type="button" onClick={() => setShowCreate(!showCreate)} icon={<Plus className="h-5 w-5" />}>Add Driver</Button>
            </div>
          </div>
        } 
      />

      {showCreate && (
        <section className="panel mb-6 p-5">
          <h2 className="text-lg font-black text-iocl-navy">Add New Driver</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label><span className="field-label">Driver Name</span><input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="RAMESH KUMAR" /></label>
            <label><span className="field-label">DL Number</span><input className="field-input" value={form.drivingLicenseNumber} onChange={(e) => setForm({ ...form, drivingLicenseNumber: e.target.value })} placeholder="TN7420210005690" /></label>
            <label><span className="field-label">DL Expiry Date (DD-MM-YYYY)</span><input type="text" inputMode="numeric" className="field-input" value={form.drivingLicenseExpiryDate} onChange={(e) => handleDateInput(e.target.value, 'drivingLicenseExpiryDate')} placeholder="31-12-2025" /></label>
            <label><span className="field-label">Pass Valid Until (DD-MM-YYYY)</span><input type="text" inputMode="numeric" className="field-input" value={form.passValidUntil} onChange={(e) => handleDateInput(e.target.value, 'passValidUntil')} placeholder="31-12-2025" /></label>
            <label className="md:col-span-2"><span className="field-label">Crew ID (Optional)</span><input type="text" className="field-input uppercase" value={form.crewId} onChange={(e) => setForm({ ...form, crewId: e.target.value.toUpperCase() })} placeholder="e.g. M-TN74AZ8730" /></label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button type="button" loading={busy} onClick={addDriver}>Save Driver</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </section>
      )}

      <div className="panel overflow-hidden">
        {loading ? <div className="p-10 text-center text-slate-500">Loading drivers...</div> : (
          <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="p-4 w-12"><input type="checkbox" className="h-4 w-4 accent-iocl-orange" checked={items.length > 0 && selectedIds.length === items.length} onChange={(e) => setSelectedIds(e.target.checked ? items.map(i => i.id) : [])} /></th>
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
                  <td className="p-4"><input type="checkbox" className="h-4 w-4 accent-iocl-orange" checked={selectedIds.includes(item.id)} onChange={(e) => { if (e.target.checked) setSelectedIds(s => [...s, item.id]); else setSelectedIds(s => s.filter(id => id !== item.id)); }} /></td>
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
                  <td colSpan={10} className="p-10 text-center text-slate-500">No drivers found in database.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}


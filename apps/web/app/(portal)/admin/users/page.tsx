"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserRecord, UserRole } from "@iocl/shared";
import { KeyRound, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserCheck, UserX, Trash } from "lucide-react";
import { toast } from "sonner";
import { createUser, listUsers, resetUserPassword, updateUser, deleteUser, ApiClientError } from "../../../../lib/api";
import { formatIndiaDate } from "../../../../lib/utils";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/ui/page-header";

const roles: Array<{ value: UserRole; label: string }> = [
  { value: "ENTRY_GATE_SECURITY", label: "Entry Gate Security" },
  { value: "EXIT_GATE_SECURITY", label: "Exit Gate Security" },
  { value: "SUPERVISOR", label: "Gate Supervisor" },
  { value: "ADMIN", label: "Administrator" },
];
const empty = { employeeCode: "", name: "", role: "ENTRY_GATE_SECURITY" as UserRole, password: "" };

export default function UsersPage() {
  const [items, setItems] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await listUsers({ search: search || undefined, page: 1, pageSize: 100 }); setItems(result.items); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Users could not be loaded"); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => { const id = window.setTimeout(() => void load(), 200); return () => window.clearTimeout(id); }, [load]);

  async function addUser() {
    setBusy(true);
    setFormErrors({});
    try { 
      await createUser(form); 
      toast.success("User created"); 
      setForm(empty); 
      setShowCreate(false); 
      await load(); 
    }
    catch (error: any) { 
      if (error instanceof ApiClientError && error.fieldErrors) {
        setFormErrors(error.fieldErrors);
        const msgs = Object.values(error.fieldErrors).flat();
        toast.error(msgs.length > 0 ? msgs.join(", ") : error.message);
      } else {
        toast.error(error instanceof Error ? error.message : "User could not be created"); 
      }
    }
    finally { setBusy(false); }
  }

  async function removeUser(user: UserRecord) {
    if (!window.confirm(`Are you sure you want to permanently delete user ${user.employeeCode}? This cannot be undone.`)) return;
    setBusy(true);
    try { 
      await deleteUser(user.id); 
      toast.success("User deleted completely"); 
      await load(); 
    }
    catch (error) { 
      toast.error(error instanceof Error ? error.message : "User could not be deleted"); 
    }
    finally { setBusy(false); }
  }

  async function toggle(user: UserRecord) {
    setBusy(true);
    try { await updateUser(user.id, { isActive: !user.isActive }); toast.success(user.isActive ? "User disabled" : "User enabled"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "User could not be updated"); }
    finally { setBusy(false); }
  }
  async function changeRole(user: UserRecord, role: UserRole) {
    setBusy(true);
    try { await updateUser(user.id, { role }); toast.success("Role updated; existing sessions revoked"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Role could not be updated"); }
    finally { setBusy(false); }
  }
  async function editIdentity(user: UserRecord) {
    const name = window.prompt(`Update the full name for ${user.employeeCode}:`, user.name);
    if (name === null) return;
    if (!name.trim()) return toast.error("Name cannot be empty");
    setBusy(true);
    try { await updateUser(user.id, { name: name.trim() }); toast.success("User identity updated"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "User identity could not be updated"); }
    finally { setBusy(false); }
  }
  async function resetPassword(user: UserRecord) {
    setResetTarget(user);
    setNewPassword("");
  }

  async function confirmResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget || !newPassword) return;
    setBusy(true);
    try {
      await resetUserPassword(resetTarget.id, { password: newPassword });
      toast.success("Password reset successfully; all active sessions revoked.");
      setResetTarget(null);
    } catch (error) {
      if (error instanceof ApiClientError && error.fieldErrors?.password) {
        toast.error(error.fieldErrors.password[0]);
      } else {
        toast.error(error instanceof Error ? error.message : "Password reset failed");
      }
    } finally {
      setBusy(false);
    }
  }
  async function unlock(user: UserRecord) {
    setBusy(true);
    try { await updateUser(user.id, { unlock: true }); toast.success("Account unlocked"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Account unlock failed"); }
    finally { setBusy(false); }
  }

  return <div>
    <PageHeader eyebrow="Admin & Access control" title="Gate User Management" description="Create operators, edit employee identity, change roles, disable accounts, unlock failed-login lockouts and reset passwords." action={<Button type="button" onClick={() => setShowCreate((value) => !value)} icon={<Plus className="h-5 w-5" />}>Add User</Button>} />

    {showCreate ? <section className="panel mb-6 p-5 sm:p-6"><h2 className="text-lg font-black text-iocl-navy">Create security user</h2><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label><span className="field-label">Employee Code</span><input className={`field-input uppercase ${formErrors.employeeCode ? 'border-red-500 ring-1 ring-red-500' : ''}`} value={form.employeeCode} onChange={(event) => setForm((current) => ({ ...current, employeeCode: event.target.value }))} placeholder="SEC1002" /></label>
      <label><span className="field-label">Full Name</span><input className={`field-input ${formErrors.name ? 'border-red-500 ring-1 ring-red-500' : ''}`} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
      <label><span className="field-label">Role</span><select className={`field-input ${formErrors.role ? 'border-red-500 ring-1 ring-red-500' : ''}`} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
      <label><span className="field-label">Temporary Password</span><input type="password" className={`field-input ${formErrors.password ? 'border-red-500 ring-1 ring-red-500' : ''}`} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Min 8 chars, Aa1@" /></label>
    </div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button><Button type="button" loading={busy} onClick={() => void addUser()} icon={<UserCheck className="h-4 w-4" />}>Create User</Button></div></section> : null}

    <section className="panel mb-5 p-4"><div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input className="field-input pl-12" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or employee code" /></label><Button type="button" variant="secondary" onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button></div></section>

    <section className="panel overflow-hidden"><div className="hidden grid-cols-[1.2fr_1fr_1fr_.8fr_auto] gap-4 border-b bg-slate-50 px-6 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 lg:grid"><span>User</span><span>Role</span><span>Login status</span><span>Created</span><span>Actions</span></div><div className="divide-y divide-slate-100">
      {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse bg-slate-50" />) : items.map((user) => <div key={user.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1.2fr_1fr_1fr_.8fr_auto] lg:items-center lg:px-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-iocl-orange"><ShieldCheck className="h-5 w-5" /></span><div><p className="font-black text-iocl-navy">{user.name}</p><p className="text-xs font-semibold text-slate-400">{user.employeeCode}</p></div></div><select className="field-input min-h-10 py-2 text-sm" value={user.role} disabled={busy} onChange={(event) => void changeRole(user, event.target.value as UserRole)}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select><div className="flex flex-wrap gap-2"><Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Disabled"}</Badge>{user.lockedUntil ? <Badge tone="orange">Locked</Badge> : null}<span className="text-xs text-slate-400">Failed: {user.failedLoginAttempts}</span></div><div><p className="text-sm font-bold text-slate-700">{formatIndiaDate(user.createdAt)}</p><p className="text-xs text-slate-400">Last login {user.lastLoginAt ? formatIndiaDate(user.lastLoginAt, true) : "Never"}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" className="min-h-10 px-3" disabled={busy} onClick={() => void editIdentity(user)} icon={<Pencil className="h-4 w-4" />}>Edit</Button><Button type="button" variant="secondary" className="min-h-10 px-3" disabled={busy} onClick={() => void resetPassword(user)} icon={<KeyRound className="h-4 w-4" />}>Reset</Button>{user.lockedUntil ? <Button type="button" variant="secondary" className="min-h-10 px-3" disabled={busy} onClick={() => void unlock(user)}>Unlock</Button> : null}<Button type="button" variant={user.isActive ? "danger" : "success"} className="min-h-10 px-3" disabled={busy} onClick={() => void toggle(user)} icon={user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}>{user.isActive ? "Disable" : "Enable"}</Button><Button type="button" variant="danger" className="min-h-10 px-3" disabled={busy} onClick={() => void removeUser(user)} icon={<Trash className="h-4 w-4" />}>Delete</Button></div></div>)}
      {!loading && items.length === 0 ? <div className="px-6 py-16 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-black text-slate-600">No users found</p></div> : null}
    </div></section>
  </div>;
}

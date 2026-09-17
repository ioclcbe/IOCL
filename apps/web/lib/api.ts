import type {
  ApiResponse,
  AuditLogRecord,
  BulkDeleteInput,
  CreateGateEntryInput,
  CreateUserInput,
  CrewPass,
  DashboardSummary,
  DeleteEntryInput,
  EntryFilter,
  ExitResolveResult,
  GateEntryRecord,
  ResetPasswordInput,
  SubmitExitInput,
  UpdateExitQuantitiesInput,
  UpdateGateEntryInput,
  UpdateUserInput,
  UserListFilter,
  UserRecord,
  UserRole,
} from "@iocl/shared";
import {
  createDemoEntry,
  demoLogin,
  getDemoAudits,
  getDemoDashboard,
  getDemoDestinations,
  getDemoEntries,
  getDemoEntry,
  getDemoUsers,
  resolveDemoInvoice,
  resolveDemoPass,
  submitDemoExit,
  updateDemoEntry,
  updateDemoExitQuantities,
} from "./demo-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export interface DestinationOption { id: string; code: string; name: string }
export interface SessionUser { id: string; employeeCode: string; name: string; role: UserRole }

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code = "REQUEST_FAILED",
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

let accessTokenMemory: string | null = null;
let refreshPromise: Promise<{ accessToken: string; user: SessionUser }> | null = null;

export function setAccessToken(value: string | null) {
  accessTokenMemory = value;
  if (DEMO_MODE && typeof window !== "undefined") {
    if (value) sessionStorage.setItem("iocl_access_token", value);
    else sessionStorage.removeItem("iocl_access_token");
  }
}
export function getAccessToken() {
  if (accessTokenMemory) return accessTokenMemory;
  if (DEMO_MODE && typeof window !== "undefined") return sessionStorage.getItem("iocl_access_token");
  return null;
}

async function parsePayload<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiClientError(
      response.ok ? "The server returned an unexpected response" : `Request failed with status ${response.status}`,
      "INVALID_SERVER_RESPONSE",
      undefined,
      response.headers.get("x-request-id") ?? undefined,
    );
  }
  return await response.json() as ApiResponse<T>;
}

async function refreshAccess(): Promise<{ accessToken: string; user: SessionUser }> {
  if (DEMO_MODE) throw new ApiClientError("Demo session expired", "DEMO_SESSION_EXPIRED");
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, cache: "no-store",
    }).then(async (response) => {
      const payload = await parsePayload<{ accessToken: string; user: SessionUser }>(response);
      if (!response.ok || !payload.success) {
        const failure = payload.success ? undefined : payload.error;
        throw new ApiClientError(failure?.message ?? "Your session has expired. Please sign in again.", failure?.code ?? "SESSION_EXPIRED", failure?.fieldErrors, failure?.requestId);
      }
      setAccessToken(payload.data.accessToken);
      return payload.data;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}, canRefresh = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  const accessToken = getAccessToken();
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include", cache: "no-store" });
  } catch {
    throw new ApiClientError("Cannot reach the gate server. Check the network connection.", "NETWORK_ERROR");
  }
  if (response.status === 401 && canRefresh && !path.startsWith("/auth/")) {
    try { await refreshAccess(); return apiFetch<T>(path, init, false); }
    catch (error) {
      setAccessToken(null);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("iocl-session-expired"));
      throw error;
    }
  }
  const payload = await parsePayload<T>(response);
  if (!payload.success) throw new ApiClientError(payload.error.message, payload.error.code, payload.error.fieldErrors, payload.error.requestId);
  if (!response.ok) throw new ApiClientError("The request could not be completed", "REQUEST_FAILED");
  return payload.data;
}

async function download(path: string, filename: string) {
  async function run(canRefresh: boolean): Promise<Response> {
    const accessToken = getAccessToken();
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
        credentials: "include", cache: "no-store",
      });
    } catch { throw new ApiClientError("Cannot reach the gate server.", "NETWORK_ERROR"); }
    if (response.status === 401 && canRefresh) { await refreshAccess(); return run(false); }
    return response;
  }
  const response = await run(true);
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await parsePayload<never>(response);
      if (!payload.success) throw new ApiClientError(payload.error.message, payload.error.code, payload.error.fieldErrors, payload.error.requestId);
    }
    throw new ApiClientError("Download failed", "DOWNLOAD_FAILED");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  } finally { URL.revokeObjectURL(url); }
}

export async function restoreSession() { if (DEMO_MODE) return null; return refreshAccess(); }
export async function logoutSession() {
  setAccessToken(null);
  if (DEMO_MODE) return;
  try { await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include", cache: "no-store" }); } catch { /* local logout still succeeds */ }
}
export async function login(employeeCode: string, password: string) {
  if (DEMO_MODE) { await new Promise((resolve) => setTimeout(resolve, 350)); return demoLogin(employeeCode, password); }
  return apiFetch<{ accessToken: string; user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify({ employeeCode, password }) });
}

export async function resolvePass(qrToken: string): Promise<CrewPass> {
  if (DEMO_MODE) return resolveDemoPass(qrToken);
  return apiFetch<CrewPass>("/crew-passes/resolve", { method: "POST", body: JSON.stringify({ qrToken }) });
}
export async function createManualCrewPass(input: {
  driverName: string;
  ttNumberOnPass: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiryDate: string;
  passValidUntil: string;
  crewType: string;
  crewId?: string;
}): Promise<CrewPass> {
  if (DEMO_MODE) throw new ApiClientError("Manual driver entry is not available in demo mode", "DEMO_MANUAL_DISABLED");
  return apiFetch<CrewPass>("/crew-passes/manual", { method: "POST", body: JSON.stringify(input) });
}
export async function createEntry(input: CreateGateEntryInput): Promise<GateEntryRecord> {
  if (DEMO_MODE) return createDemoEntry(input);
  return apiFetch<GateEntryRecord>("/gate-entries", { method: "POST", body: JSON.stringify(input) });
}
export async function updateEntry(id: string, input: UpdateGateEntryInput): Promise<GateEntryRecord> {
  if (DEMO_MODE) return updateDemoEntry(id, input);
  return apiFetch<GateEntryRecord>(`/gate-entries/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function resolveExitInvoice(rawInvoiceQr: string): Promise<ExitResolveResult> {
  if (DEMO_MODE) return resolveDemoInvoice(rawInvoiceQr);
  return apiFetch<ExitResolveResult>("/gate-entries/exit/resolve", { method: "POST", body: JSON.stringify({ rawInvoiceQr }) });
}
export async function submitExit(id: string, input: SubmitExitInput): Promise<GateEntryRecord> {
  if (DEMO_MODE) return submitDemoExit(id, input);
  return apiFetch<GateEntryRecord>(`/gate-entries/${id}/exit`, { method: "POST", body: JSON.stringify(input) });
}
export async function updateExitQuantities(id: string, input: UpdateExitQuantitiesInput): Promise<GateEntryRecord> {
  if (DEMO_MODE) return updateDemoExitQuantities(id, input);
  return apiFetch<GateEntryRecord>(`/gate-entries/${id}/exit-quantities`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function listEntries(filter: Partial<EntryFilter> = {}) {
  if (DEMO_MODE) {
    let items = getDemoEntries();
    if (filter.search) {
      const query = filter.search.toLowerCase();
      items = items.filter((entry) => [entry.actualTankTruckNumber, entry.ttNumberOnPass, entry.driverName, entry.crewId, entry.mobileTokenNumber, entry.customerDestination, entry.challanNumber, entry.invoiceNumber].join(" ").toLowerCase().includes(query));
    }
    if (filter.status) items = items.filter((entry) => entry.status === filter.status);
    if (filter.match === "matched") items = items.filter((entry) => entry.ttNumberMatch);
    if (filter.match === "mismatched") items = items.filter((entry) => !entry.ttNumberMatch);
    return { items, page: 1, pageSize: 1000, total: items.length, totalPages: 1 };
  }
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => value !== undefined && params.set(key, String(value)));
  return apiFetch<{ items: GateEntryRecord[]; page: number; pageSize: number; total: number; totalPages: number }>(`/gate-entries?${params}`);
}
export async function getEntry(id: string) { if (DEMO_MODE) return getDemoEntry(id); return apiFetch<GateEntryRecord>(`/gate-entries/${id}`); }
export async function getDashboard(): Promise<DashboardSummary> { if (DEMO_MODE) return getDemoDashboard(); return apiFetch<DashboardSummary>("/dashboard/summary"); }
export async function getAudits(filter: { action?: string; entityId?: string; limit?: number } = {}): Promise<AuditLogRecord[]> {
  if (DEMO_MODE) return getDemoAudits().filter((item) => !filter.action || item.action === filter.action).slice(0, filter.limit ?? 50);
  const params = new URLSearchParams(); Object.entries(filter).forEach(([key, value]) => value !== undefined && params.set(key, String(value)));
  return apiFetch<AuditLogRecord[]>(`/audit-logs?${params}`);
}
export async function getDestinations(): Promise<DestinationOption[]> { if (DEMO_MODE) return getDemoDestinations(); return apiFetch<DestinationOption[]>("/masters/destinations"); }

export async function softDeleteEntry(id: string, input: DeleteEntryInput) {
  if (DEMO_MODE) throw new ApiClientError("Record deletion is disabled in the standalone demo", "DEMO_DELETE_DISABLED");
  return apiFetch<GateEntryRecord>(`/gate-entries/${id}`, { method: "DELETE", body: JSON.stringify(input) });
}
export async function restoreEntry(id: string) {
  if (DEMO_MODE) throw new ApiClientError("Record restore is disabled in the standalone demo", "DEMO_RESTORE_DISABLED");
  return apiFetch<GateEntryRecord>(`/gate-entries/${id}/restore`, { method: "POST" });
}
export async function bulkDeleteEntries(input: BulkDeleteInput) {
  if (DEMO_MODE) throw new ApiClientError("Bulk deletion is disabled in the standalone demo", "DEMO_DELETE_DISABLED");
  return apiFetch<{ count: number }>("/gate-entries/bulk-delete", { method: "POST", body: JSON.stringify(input) });
}

export async function listUsers(filter: Partial<UserListFilter> = {}) {
  if (DEMO_MODE) { const items = getDemoUsers(); return { items, total: items.length, page: 1, pageSize: 1000, totalPages: 1 }; }
  const params = new URLSearchParams(); Object.entries(filter).forEach(([key, value]) => value !== undefined && params.set(key, String(value)));
  return apiFetch<{ items: UserRecord[]; total: number; page: number; pageSize: number; totalPages: number }>(`/users?${params}`);
}
export async function createUser(input: CreateUserInput) {
  if (DEMO_MODE) throw new ApiClientError("User changes are disabled in the standalone demo", "DEMO_USERS_READ_ONLY");
  return apiFetch<UserRecord>("/users", { method: "POST", body: JSON.stringify(input) });
}
export async function updateUser(id: string, input: UpdateUserInput) {
  if (DEMO_MODE) throw new ApiClientError("User changes are disabled in the standalone demo", "DEMO_USERS_READ_ONLY");
  return apiFetch<UserRecord>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function resetUserPassword(id: string, input: ResetPasswordInput) {
  if (DEMO_MODE) throw new ApiClientError("Password reset is disabled in the standalone demo", "DEMO_USERS_READ_ONLY");
  return apiFetch<UserRecord>(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify(input) });
}

export async function downloadCsv(filter: Partial<EntryFilter> = {}) {
  if (DEMO_MODE) throw new ApiClientError("CSV export is available in the connected build", "DEMO_EXPORT_DISABLED");
  const params = new URLSearchParams(); Object.entries(filter).forEach(([key, value]) => value !== undefined && params.set(key, String(value)));
  await download(`/gate-entries/export.csv?${params}`, `iocl-gate-${filter.date ?? new Date().toISOString().slice(0, 10)}.csv`);
}
export async function downloadExcel(dateFrom?: string, dateTo?: string) {
  if (DEMO_MODE) throw new ApiClientError("Excel export is available in the connected build", "DEMO_EXPORT_DISABLED");
  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const fileName = dateFrom && dateTo && dateFrom !== dateTo ? `iocl-gate-${dateFrom}-to-${dateTo}.xlsx` : `iocl-gate-${dateFrom || new Date().toISOString().slice(0, 10)}.xlsx`;
  await download(`/gate-entries/export.xlsx?${params}`, fileName);
}
export async function getReportSummary(dateFrom: string, dateTo?: string) {
  if (DEMO_MODE) {
    const summary = getDemoDashboard();
    return {
      date: dateFrom,
      total: summary.total,
      in: summary.open,
      out: summary.exited,
      cancelled: 0,
      quantities: summary.quantities,
    };
  }
  const params = new URLSearchParams();
  params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  return apiFetch<{ date: string; total: number; in: number; out: number; cancelled: number; quantities: DashboardSummary["quantities"] }>(`/reports/summary?${params}`);
}
// ============================================================================
// Master Data API
// ============================================================================

export async function getMasterTrucks() {
  const res = await apiFetch('/masters/trucks');
  return (res as any)?.data ?? res;
}
export async function getMasterDrivers() {
  const res = await apiFetch('/masters/drivers');
  return (res as any)?.data ?? res;
}
export async function getMasterHelpers() {
  const res = await apiFetch('/masters/helpers');
  return (res as any)?.data ?? res;
}



export async function deleteUser(id: string) {
  if (DEMO_MODE) throw new ApiClientError("User deletion is disabled in the standalone demo", "DEMO_USERS_READ_ONLY");
  return apiFetch<{ success: boolean; message: string }>(/users/ + id, { method: "DELETE" });
}

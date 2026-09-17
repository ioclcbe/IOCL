"use client";

import Image from "next/image";
import { useState } from "react";
import { Eye, EyeOff, Fingerprint, LockKeyhole, ShieldCheck, UserRound, Wifi, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../lib/auth-context";
import { DEMO_MODE } from "../../../lib/api";
import { Button } from "../../../components/ui/button";

export default function LoginPage() {
  const { login, ready, user } = useAuth();
  const [employeeCode, setEmployeeCode] = useState(DEMO_MODE ? "SEC1001" : "");
  const [password, setPassword] = useState(DEMO_MODE ? "Gate@123" : "");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ready || user) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!employeeCode.trim() || password.length < 8) {
      toast.error("Enter a valid employee code and password");
      return;
    }
    setLoading(true);
    try {
      await login(employeeCode, password);
      toast.success("Gate console unlocked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-iocl-navy">
      <div className="navy-grid absolute inset-0 opacity-80" />
      <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-iocl-orange/30 blur-[110px]" />
      <div className="absolute -bottom-44 right-[-8rem] h-[35rem] w-[35rem] rounded-full bg-blue-500/20 blur-[120px]" />

      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
        <section className="hidden flex-col justify-between px-12 py-10 text-white lg:flex xl:px-20">
          <div className="flex items-center gap-3">
            <Image src="/indian-oil-logo.jpeg" alt="Indian Oil" width={62} height={62} className="rounded-full border-2 border-white/90" priority />
            <div>
              <p className="text-lg font-black tracking-tight">Indian Oil</p>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Truck Gate Management</p>
            </div>
          </div>

          <div className="max-w-2xl pb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-200 backdrop-blur">
              <ShieldCheck className="h-4 w-4" /> Secure Operations Platform
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.08] tracking-[-0.04em] xl:text-6xl">
              Faster, safer truck entry at every gate.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
              Verify crew passes, inspect tank trucks, capture safety checks and create auditable IN records from one tablet-ready console.
            </p>
            <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
              {[
                { icon: Zap, value: "< 60 sec", label: "Target entry time" },
                { icon: Fingerprint, value: "100%", label: "Auditable actions" },
                { icon: Wifi, value: "Live", label: "Gate connectivity" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                  <item.icon className="h-5 w-5 text-iocl-orange" />
                  <p className="mt-4 text-lg font-black">{item.value}</p>
                  <p className="mt-1 text-xs leading-5 text-white/50">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/35">Authorized personnel only · All access attempts are logged</p>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-[#fffaf6] px-4 py-8 sm:px-8 lg:rounded-l-[3rem] lg:px-14 xl:px-24">
          <div className="w-full max-w-[520px] animate-fade-up">
            <div className="mb-8 flex flex-col items-center lg:hidden">
              <Image src="/indian-oil-logo.jpeg" alt="Indian Oil" width={96} height={96} className="rounded-full border-4 border-white shadow-xl" priority />
              <p className="mt-4 text-sm font-extrabold uppercase tracking-[0.2em] text-iocl-orange">Truck Gate System</p>
            </div>

            <div className="panel overflow-hidden border-white bg-white/95 p-6 sm:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-iocl-orange">Security Login</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-iocl-navy">Welcome to Truck Gate</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Sign in with your assigned employee credentials. Your role is resolved securely by the server.</p>
                </div>
                <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-iocl-orange sm:flex">
                  <LockKeyhole className="h-6 w-6" />
                </div>
              </div>

              <form className="mt-8 space-y-5" onSubmit={submit}>
                <div>
                  <label className="field-label" htmlFor="employeeCode">Employee Code</label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="employeeCode"
                      autoComplete="username"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                      className="field-input pl-12 font-semibold uppercase tracking-wide"
                      placeholder="e.g. SEC1001"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold text-iocl-navy" htmlFor="password">Password</label>
                    <span className="text-xs font-bold text-slate-500">Admin-managed reset</span>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field-input pl-12 pr-12"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-iocl-navy"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" loading={loading} className="mt-2 w-full min-h-14 text-base">
                  Secure Login
                </Button>
              </form>


            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
              <ShieldCheck className="h-4 w-4 text-iocl-green" /> Encrypted session · Role-based access · Audit logging
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

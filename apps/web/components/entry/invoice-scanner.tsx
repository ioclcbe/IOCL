
"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DEMO_MODE } from "../../lib/api";
import { Button } from "../ui/button";

export const DEMO_INVOICE_QR = "Inv:0793356259 Dt:06.06.25 Val:1143122.00 Veh:TN59CL2839 Prd/Qty:BULK-MS/8;BULK-HSD/4 Con:203031(VASUGI AGENCIES)";

export function InvoiceScanner({ onDetected, loading }: { onDetected: (value: string) => void; loading?: boolean }) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function startCamera() {
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      const preferred = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices.at(-1);
      if (!preferred) throw new Error("No camera was detected");
      setCameraActive(true);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (!videoRef.current) throw new Error("Camera preview is not ready");
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 180 });
      controlsRef.current = await reader.decodeFromVideoDevice(preferred.deviceId, videoRef.current, (result) => {
        if (!result) return;
        controlsRef.current?.stop(); controlsRef.current = null; setCameraActive(false);
        const text = result.getText(); onDetected(text);
      });
    } catch (error) {
      controlsRef.current?.stop(); controlsRef.current = null; setCameraActive(false);
      toast.error(error instanceof Error ? error.message : "Camera could not be started");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="relative min-h-[280px] overflow-hidden rounded-3xl bg-iocl-navy shadow-xl">
          <div className="navy-grid absolute inset-0 opacity-60" />
          <video ref={videoRef} muted playsInline className={`absolute inset-0 h-full w-full object-cover ${cameraActive ? "opacity-100" : "opacity-0"}`} />
          {cameraActive ? (
            <>
              <div className="pointer-events-none absolute inset-7 rounded-3xl border-2 border-white/70">
                <div className="absolute left-4 right-4 top-5 h-0.5 animate-scan bg-iocl-orange" />
              </div>
              <button type="button" onClick={() => { controlsRef.current?.stop(); controlsRef.current = null; setCameraActive(false); }} className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950/75 px-4 py-2.5 text-sm font-bold text-white">
                <CameraOff className="h-4 w-4" /> Stop camera
              </button>
            </>
          ) : (
            <div className="relative flex min-h-[280px] flex-col items-center justify-center p-8 text-center text-white">
              <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10"><ScanLine className="h-10 w-10 text-iocl-orange" /></span>
              <h3 className="mt-5 text-2xl font-black">Scan Invoice QR</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-white/55">Point the camera at the dispatch invoice QR code. Vehicle number is matched to today&apos;s open IN record.</p>
              <Button type="button" onClick={startCamera} disabled={loading} icon={<Camera className="h-5 w-5" />} className="mt-6">Start Camera</Button>
            </div>
          )}
        </div>
        {DEMO_MODE ? (
          <button type="button" onClick={() => { onDetected(DEMO_INVOICE_QR); }} className="flex w-full h-max items-center gap-3 rounded-3xl border border-orange-200 bg-orange-50 p-5 text-left">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-iocl-orange"><Sparkles className="h-5 w-5" /></span>
            <span><span className="block text-sm font-black text-orange-900">Load sample invoice QR</span><span className="text-xs text-orange-700">Vehicle TN59CL2839 A MS and HSD</span></span>
          </button>
        ) : null}
      </div>
    </div>
  );
}


"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard, ScanLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DEMO_MODE } from "../../lib/api";
import { Button } from "../ui/button";

export const DEMO_INVOICE_QR = "Inv:0793356259 Dt:06.06.25 Val:1143122.00 Veh:TN59CL2839 Prd/Qty:BULK-MS/8;BULK-HSD/4 Con:203031(VASUGI AGENCIES)";

export function InvoiceScanner({ onDetected, loading }: { onDetected: (value: string) => void; loading?: boolean }) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [raw, setRaw] = useState("");
  const [inputMode, setInputMode] = useState<"camera" | "keyboard">("camera");

  useEffect(() => () => controlsRef.current?.stop(), []);

  // Focus hardware scanner input whenever keyboard mode is active
  useEffect(() => { if (inputMode === "keyboard") inputRef.current?.focus(); }, [inputMode]);

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
        const text = result.getText(); setRaw(text); onDetected(text);
      });
    } catch (error) {
      controlsRef.current?.stop(); controlsRef.current = null; setCameraActive(false);
      toast.error(error instanceof Error ? error.message : "Camera could not be started");
    }
  }

  function submit() {
    if (!raw.trim()) return toast.error("Scan or enter an invoice QR");
    onDetected(raw.trim());
  }

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
        <button
          type="button"
          onClick={() => { setInputMode("camera"); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition ${inputMode === "camera" ? "bg-iocl-orange text-white shadow-sm" : "text-slate-500 hover:text-iocl-navy"}`}
        >
          <Camera className="h-4 w-4" /> Camera Scan
        </button>
        <button
          type="button"
          onClick={() => { setInputMode("keyboard"); if (cameraActive) { controlsRef.current?.stop(); controlsRef.current = null; setCameraActive(false); } }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition ${inputMode === "keyboard" ? "bg-iocl-orange text-white shadow-sm" : "text-slate-500 hover:text-iocl-navy"}`}
        >
          <Keyboard className="h-4 w-4" /> Scanner / Type
        </button>
      </div>

      {inputMode === "camera" ? (
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
          {/* Demo shortcut */}
          {DEMO_MODE ? (
            <button type="button" onClick={() => { setRaw(DEMO_INVOICE_QR); onDetected(DEMO_INVOICE_QR); }} className="flex w-full items-center gap-3 rounded-3xl border border-orange-200 bg-orange-50 p-5 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-iocl-orange"><Sparkles className="h-5 w-5" /></span>
              <span><span className="block text-sm font-black text-orange-900">Load sample invoice QR</span><span className="text-xs text-orange-700">Vehicle TN59CL2839 · MS and HSD</span></span>
            </button>
          ) : (
            <div className="flex flex-col justify-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              <p className="font-black text-slate-700">Using a hardware scanner?</p>
              <p className="text-xs leading-5">If you have a barcode/QR gun, switch to <strong>Scanner / Type</strong> tab above and scan directly into the text box.</p>
            </div>
          )}
        </div>
      ) : (
        /* Hardware scanner / manual text input mode */
        <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-200 text-slate-600"><Keyboard className="h-6 w-6" /></span>
            <div>
              <p className="font-black text-slate-800">Hardware scanner or manual input</p>
              <p className="text-xs text-slate-500">Scan the QR gun into the box below, or type the invoice details manually</p>
            </div>
          </div>
          <textarea
            ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
            className="field-input min-h-[120px] w-full resize-y font-mono text-sm"
            placeholder="Scan QR gun here, or type: Inv:12345 Dt:26.08.26 Val:100000 Veh:TN74AZ8730 Prd/Qty:BULK-MS/8000 Con:CONSIGNEE NAME"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => {
              // Hardware scanners often end with Enter — auto-submit
              if (e.key === "Enter" && raw.trim().length > 20) { e.preventDefault(); onDetected(raw.trim()); }
            }}
          />
          <Button type="button" loading={loading} onClick={submit} icon={<ScanLine className="h-5 w-5" />}>
            Resolve Invoice
          </Button>
        </div>
      )}
    </div>
  );
}

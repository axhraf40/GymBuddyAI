"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight, X, ZoomIn } from "lucide-react";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

type DetectedCode = { rawValue: string };
type Detector = { detect: (source: CanvasImageSource) => Promise<DetectedCode[]> };

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

// Zoom levels tried in turn while nothing is found (hardware zoom when the camera supports it)
const AUTO_ZOOM_STEPS = [1, 2, 1.5, 2.5];
const ZOOM_STEP_MS = 2200;
const SCAN_INTERVAL_MS = 120;

type ZoomCaps = { min: number; max: number; step: number };

/** Native BarcodeDetector (Chrome / Android) when it supports our formats, else the ZXing-C++ WebAssembly ponyfill. */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (Native?.getSupportedFormats) {
    try {
      const supported = await Native.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.includes("ean_13")) return new Native({ formats });
    } catch {
      /* fall through to the ponyfill */
    }
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  // Serve the ZXing WebAssembly file from our own site (copied to /public by `postinstall`), not a CDN
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path),
    },
  });
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
}

/**
 * Live camera barcode scanner (Yuka style).
 *
 * - Scans the WHOLE camera frame, so the barcode does not need to sit inside a box.
 * - Every other frame it also decodes a 2x enlarged centre crop (software zoom) so small
 *   or distant barcodes are read on every phone, including iPhones without zoom control.
 * - If the camera exposes hardware zoom, it cycles through zoom levels automatically while
 *   nothing is found, and the user can also set the zoom with a slider. Torch when available.
 *
 * Decoding: ZXing-C++ (github.com/zxing-cpp/zxing-cpp) compiled to WebAssembly through the
 * `barcode-detector` package (github.com/Sec-ant/barcode-detector), or the browser's native
 * BarcodeDetector API when it exists.
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const doneRef = useRef(false);
  const manualZoomRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [zoomCaps, setZoomCaps] = useState<ZoomCaps | null>(null);
  const [zoom, setZoom] = useState(1);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [found, setFound] = useState<string | null>(null);

  const applyZoom = async (value: number) => {
    const track = trackRef.current;
    if (!track || !zoomCaps) return;
    const z = Math.min(zoomCaps.max, Math.max(zoomCaps.min, value));
    try {
      await track.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] });
      setZoom(z);
    } catch {
      /* zoom not applied, ignore */
    }
  };

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const stop = () => {
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
        setStarting(false);
        setError(
          /permission|denied|NotAllowed/i.test(msg)
            ? "Camera permission denied. Allow camera access in your browser settings and try again."
            : "Could not start the camera. Make sure the page uses HTTPS and no other app is using the camera."
        );
        return;
      }
      if (cancelled) return stop();

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        zoom?: { min: number; max: number; step: number };
        torch?: boolean;
        focusMode?: string[];
      };
      if (caps.focusMode?.includes("continuous")) {
        track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => undefined);
      }
      let hwZoom: ZoomCaps | null = null;
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        hwZoom = { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 };
        setZoomCaps(hwZoom);
      }
      if (caps.torch) setTorchSupported(true);

      let detector: Detector;
      try {
        detector = await createDetector();
      } catch {
        setStarting(false);
        setError("Could not load the barcode reader. Check your internet connection and try again.");
        return stop();
      }
      if (cancelled) return stop();
      setStarting(false);

      let frame = 0;
      let zoomStep = 0;
      let lastZoomChange = performance.now();

      const tick = async () => {
        if (cancelled || doneRef.current) return;
        try {
          if (video.readyState >= 2 && video.videoWidth > 0 && ctx) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            // Even frames: the full picture. Odd frames: the centre half enlarged 2x (software zoom).
            const crop = frame % 2 === 1;
            const sw = crop ? vw / 2 : vw;
            const sh = crop ? vh / 2 : vh;
            const scale = Math.min(1, 1280 / Math.max(sw * (crop ? 2 : 1), 1));
            canvas.width = Math.round(sw * (crop ? 2 : 1) * scale);
            canvas.height = Math.round(sh * (crop ? 2 : 1) * scale);
            ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
            const codes = await detector.detect(canvas);
            const code = codes.find((c) => c.rawValue && c.rawValue.trim());
            if (code && !doneRef.current) {
              doneRef.current = true;
              setFound(code.rawValue);
              if (navigator.vibrate) navigator.vibrate(60);
              stop();
              onDetected(code.rawValue.trim());
              return;
            }
            frame++;
          }
          // Auto-zoom: step through zoom levels while nothing is detected (unless the user took over)
          if (hwZoom && !manualZoomRef.current && performance.now() - lastZoomChange > ZOOM_STEP_MS) {
            zoomStep = (zoomStep + 1) % AUTO_ZOOM_STEPS.length;
            const z = Math.min(hwZoom.max, Math.max(hwZoom.min, AUTO_ZOOM_STEPS[zoomStep]));
            track.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] }).then(() => setZoom(z)).catch(() => undefined);
            lastZoomChange = performance.now();
          }
        } catch {
          /* a single failed frame is fine */
        }
        timer = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((t) => !t);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-dark p-5 text-white shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime text-forest-deep">
              <Camera className="h-4 w-4" />
            </span>
            <div>
              <div className="font-display text-base font-bold">Scan a product barcode</div>
              <div className="text-[11px] text-[#9AA5A0]">Point the camera at the product. It finds and reads the barcode by itself.</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#9AA5A0] hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
          {/* Visual hint only: detection uses the whole frame */}
          {!starting && !error && !found && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[38%] w-[72%] rounded-xl border-2 border-lime/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]">
                <div className="mx-auto mt-[18%] h-0.5 w-[90%] animate-pulse bg-lime/80" />
              </div>
            </div>
          )}
          {starting && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-[#9AA5A0]">Starting camera...</div>
          )}
          {found && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold text-lime">
              Found {found}
            </div>
          )}
          {torchSupported && (
            <button
              onClick={toggleTorch}
              title="Flashlight"
              className={`absolute right-2 top-2 rounded-full p-2 ${torchOn ? "bg-lime text-forest-deep" : "bg-black/50 text-white"}`}
            >
              <Flashlight className="h-4 w-4" />
            </button>
          )}
        </div>

        {zoomCaps && (
          <label className="mt-3 flex items-center gap-2 text-[11px] text-[#9AA5A0]">
            <ZoomIn className="h-4 w-4 shrink-0" />
            <input
              type="range"
              min={zoomCaps.min}
              max={Math.min(zoomCaps.max, 5)}
              step={zoomCaps.step}
              value={zoom}
              onChange={(e) => {
                manualZoomRef.current = true;
                applyZoom(Number(e.target.value));
              }}
              className="w-full accent-lime"
            />
            <span className="w-9 text-right">{zoom.toFixed(1)}x</span>
          </label>
        )}

        {error && <p className="mt-3 rounded-xl bg-[#F16060]/15 p-2.5 text-xs text-red-200">{error}</p>}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-white/15 bg-white/5 py-2 text-xs font-bold text-white hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

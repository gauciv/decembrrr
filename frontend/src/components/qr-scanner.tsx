import { useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Upload } from "lucide-react";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Use refs for callbacks to avoid re-running the effect on every render
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!containerRef.current) return;

    // Generate a unique ID to avoid collisions with stale elements
    const scannerId = "qr-scanner-region";
    // Clean up any leftover DOM content from prior mounts (React StrictMode)
    const container = containerRef.current;
    container.innerHTML = "";
    const scannerDiv = document.createElement("div");
    scannerDiv.id = scannerId;
    container.appendChild(scannerDiv);

    let cancelled = false;
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (hasScanned.current || cancelled) return;
          hasScanned.current = true;
          scanner
            .stop()
            .then(() => onScanRef.current(decodedText))
            .catch(() => onScanRef.current(decodedText));
        },
        () => {}
      )
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        onErrorRef.current?.(msg);
      });

    return () => {
      cancelled = true;
      // Always attempt to stop — covers race conditions during start
      scanner.stop().catch(() => {});
      // Also explicitly stop any media tracks to release the camera
      try {
        const video = container.querySelector("video");
        if (video?.srcObject) {
          (video.srcObject as MediaStream)
            .getTracks()
            .forEach((t) => t.stop());
          video.srcObject = null;
        }
      } catch { /* ignore */ }
      container.innerHTML = "";
      scannerRef.current = null;
    };
  }, []); // No dependencies — runs once on mount, cleans up on unmount

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || hasScanned.current) return;

      // Stop the live scanner first if running
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
      }

      try {
        // Create a temporary off-screen element for file scanning
        const tempId = "qr-file-scanner-temp";
        let tempEl = document.getElementById(tempId);
        if (!tempEl) {
          tempEl = document.createElement("div");
          tempEl.id = tempId;
          tempEl.style.display = "none";
          document.body.appendChild(tempEl);
        }
        const fileScanner = new Html5Qrcode(tempId);
        const result = await fileScanner.scanFile(file, false);
        hasScanned.current = true;
        onScanRef.current(result);
        tempEl.remove();
      } catch {
        onErrorRef.current?.("No QR code found in the uploaded image");
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    []
  );

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg" ref={containerRef} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <Upload className="h-4 w-4" />
        Upload QR image instead
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}

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
  const isRunning = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scannerId = "qr-scanner-region";
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (hasScanned.current) return;
          hasScanned.current = true;
          isRunning.current = false;
          scanner
            .stop()
            .then(() => onScan(decodedText))
            .catch(() => onScan(decodedText));
        },
        () => {}
      )
      .then(() => {
        isRunning.current = true;
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(msg);
      });

    return () => {
      if (isRunning.current) {
        isRunning.current = false;
        scanner.stop().catch(() => {});
      }
    };
  }, [onScan, onError]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || hasScanned.current) return;

      // Stop the live scanner first if running
      if (scannerRef.current && isRunning.current) {
        isRunning.current = false;
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
      }

      try {
        const scanner = new Html5Qrcode("qr-scanner-region");
        const result = await scanner.scanFile(file, /* showImage */ false);
        hasScanned.current = true;
        onScan(result);
      } catch {
        onError?.("No QR code found in the uploaded image");
      }

      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onScan, onError]
  );

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg">
        <div id="qr-scanner-region" ref={containerRef} />
      </div>
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

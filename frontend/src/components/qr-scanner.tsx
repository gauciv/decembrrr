import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);

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
          scanner
            .stop()
            .then(() => onScan(decodedText))
            .catch(() => onScan(decodedText));
        },
        () => {}
      )
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(msg);
      });

    return () => {
      scanner
        .stop()
        .catch(() => {});
    };
  }, [onScan, onError]);

  return (
    <div className="overflow-hidden rounded-lg">
      <div id="qr-scanner-region" ref={containerRef} />
    </div>
  );
}

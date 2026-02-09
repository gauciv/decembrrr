import { useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import { getStudentById, recordDeposit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import QrScanner from "@/components/qr-scanner";

type ScanStep = "scanning" | "confirm" | "amount" | "success" | "error";

interface DetectedStudent {
  id: string;
  name: string;
  avatar_url: string | null;
  balance: number;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

interface ScanFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export default function ScanFlow({ open, onOpenChange, onComplete }: ScanFlowProps) {
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<ScanStep>("scanning");
  const [student, setStudent] = useState<DetectedStudent | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setStep("scanning");
    setStudent(null);
    setAmount("");
    setNote("");
    setErrorMsg("");
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (!profile?.class_id) return;

      // The QR code contains the student's profile ID
      const studentId = decodedText.trim();
      setLoading(true);
      try {
        const data = await getStudentById(studentId, profile.class_id);
        setStudent(data);
        setStep("confirm");
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
        setStep("error");
      } finally {
        setLoading(false);
      }
    },
    [profile?.class_id]
  );

  const handleScanError = useCallback((error: string) => {
    setErrorMsg(error);
    setStep("error");
  }, []);

  async function handleDeposit() {
    if (!student || !amount || !profile?.class_id) return;
    setLoading(true);
    try {
      await recordDeposit(
        student.id,
        profile.class_id,
        parseFloat(amount),
        note || undefined
      );
      setStep("success");
      await refreshProfile();
      onComplete?.();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* Scanning */}
        {step === "scanning" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Scan Student QR
              </DialogTitle>
              <DialogDescription>
                Point at a student's QR code to record payment
              </DialogDescription>
            </DialogHeader>
            <div className="pt-2">
              {loading ? (
                <div className="flex flex-col items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Looking up student…
                  </p>
                </div>
              ) : (
                <QrScanner onScan={handleScan} onError={handleScanError} />
              )}
            </div>
          </>
        )}

        {/* Confirm student */}
        {step === "confirm" && student && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Student Found
              </DialogTitle>
              <DialogDescription>
                Confirm this is the right student
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-4 space-y-3">
              <Avatar className="h-16 w-16">
                <AvatarImage src={student.avatar_url || undefined} />
                <AvatarFallback className="text-lg">{initials(student.name)}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-lg font-semibold">{student.name}</p>
                <p className="text-sm text-muted-foreground">
                  Current balance: ₱{student.balance.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2 w-full pt-2">
                <Button variant="outline" className="flex-1" onClick={reset}>
                  Wrong Student
                </Button>
                <Button className="flex-1" onClick={() => setStep("amount")}>
                  Continue
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Amount input */}
        {step === "amount" && student && (
          <>
            <DialogHeader>
              <DialogTitle>Enter Amount</DialogTitle>
              <DialogDescription>
                <span className="flex items-center gap-2 mt-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={student.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {initials(student.name)}
                    </AvatarFallback>
                  </Avatar>
                  {student.name} · Balance: ₱{student.balance.toFixed(2)}
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium">Amount (₱)</label>
                <Input
                  type="number"
                  placeholder="e.g. 50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="1"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                {[10, 50, 100, 200].map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(String(preset))}
                    className="flex-1"
                  >
                    ₱{preset}
                  </Button>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium">Note (optional)</label>
                <Input
                  placeholder="e.g. Week 3 payment"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleDeposit}
                disabled={loading || !amount || parseFloat(amount) <= 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Recording…
                  </>
                ) : (
                  `Confirm ₱${amount || "0"}`
                )}
              </Button>
            </div>
          </>
        )}

        {/* Success */}
        {step === "success" && student && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">
                Payment Recorded
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center py-6 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold">₱{amount}</p>
              <p className="text-sm text-muted-foreground">
                Recorded for {student.name}
              </p>
              <div className="flex gap-2 w-full pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                >
                  Done
                </Button>
                <Button className="flex-1" onClick={reset}>
                  Scan Another
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Error */}
        {step === "error" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">
                Something went wrong
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center py-6 space-y-3">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {errorMsg}
              </p>
              <Button className="w-full" onClick={reset}>
                Try Again
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

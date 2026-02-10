import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bug,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { submitBugReport, uploadBugScreenshot } from "@/lib/api";

const CATEGORIES = [
  { value: "ui" as const, label: "UI / Visual" },
  { value: "payment" as const, label: "Payments / Deposits" },
  { value: "account" as const, label: "Account / Login" },
  { value: "performance" as const, label: "Performance / Speed" },
  { value: "other" as const, label: "Other" },
];

const SEVERITIES = [
  { value: "low" as const, label: "Low", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "medium" as const, label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "high" as const, label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "critical" as const, label: "Critical", color: "bg-red-100 text-red-700 border-red-200" },
];

interface BugReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
  const [category, setCategory] = useState<typeof CATEGORIES[number]["value"]>("ui");
  const [severity, setSeverity] = useState<typeof SEVERITIES[number]["value"]>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setCategory("ui");
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setStepsToReproduce("");
    setExpectedBehavior("");
    setFiles([]);
    setError("");
    setSubmitted(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) resetForm();
    onOpenChange(v);
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    // Max 3 files, 5MB each
    const valid = newFiles.filter((f) => f.size <= 5 * 1024 * 1024);
    if (valid.length < newFiles.length) {
      setError("Some files were skipped (max 5MB per file)");
    }
    setFiles((prev) => [...prev, ...valid].slice(0, 3));
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!title.trim()) { setError("Please enter a title"); return; }
    if (!description.trim()) { setError("Please describe the issue"); return; }

    setSubmitting(true);
    setError("");

    try {
      // Upload screenshots first
      const screenshotUrls: string[] = [];
      for (const file of files) {
        const url = await uploadBugScreenshot(file);
        screenshotUrls.push(url);
      }

      await submitBugReport({
        category,
        severity,
        title: title.trim(),
        description: description.trim(),
        steps_to_reproduce: stepsToReproduce.trim() || undefined,
        expected_behavior: expectedBehavior.trim() || undefined,
        screenshot_urls: screenshotUrls,
      });

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Report Submitted!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Thank you for helping us improve. We'll look into this as soon as possible.
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="mt-2">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Report a Bug
          </DialogTitle>
          <DialogDescription>
            Help us fix issues by describing what went wrong. Be as specific as possible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    category === c.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Severity</label>
            <div className="flex gap-1.5">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSeverity(s.value)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    severity === s.value
                      ? s.color
                      : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Brief summary of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              What happened? <span className="text-red-500">*</span>
            </label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="Describe the issue in detail. What were you doing when it happened?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>

          {/* Steps to Reproduce */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Steps to reproduce <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder={"1. Go to ...\n2. Click on ...\n3. See the error"}
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              maxLength={2000}
            />
          </div>

          {/* Expected Behavior */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              What did you expect? <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="Describe what you expected to happen instead"
              value={expectedBehavior}
              onChange={(e) => setExpectedBehavior(e.target.value)}
              maxLength={1000}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Screenshots <span className="text-muted-foreground font-normal">(optional, max 3)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileAdd}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2.5 py-1.5 text-xs"
                >
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <span className="text-muted-foreground">
                    ({(f.size / 1024).toFixed(0)}KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {files.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-md border border-dashed border-muted-foreground/30 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Add image
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

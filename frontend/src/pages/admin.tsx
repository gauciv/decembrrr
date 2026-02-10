import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth";
import {
  getAllBugReports,
  updateBugReport,
  type BugReport,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bug,
  ArrowLeft,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  MessageSquare,
  ChevronDown,
} from "lucide-react";

const STATUS_CONFIG = {
  open: { label: "Open", icon: Clock, color: "bg-blue-100 text-blue-700 border-blue-200" },
  "in-progress": { label: "In Progress", icon: Loader2, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200" },
  closed: { label: "Closed", icon: XCircle, color: "bg-gray-100 text-gray-600 border-gray-200" },
} as const;

const SEVERITY_CONFIG = {
  low: { label: "Low", color: "bg-blue-50 text-blue-600 border-blue-200" },
  medium: { label: "Medium", color: "bg-yellow-50 text-yellow-600 border-yellow-200" },
  high: { label: "High", color: "bg-orange-50 text-orange-600 border-orange-200" },
  critical: { label: "Critical", color: "bg-red-50 text-red-700 border-red-200" },
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  ui: "UI / Visual",
  payment: "Payments",
  account: "Account",
  performance: "Performance",
  other: "Other",
};

type StatusFilter = "all" | BugReport["status"];
type SeverityFilter = "all" | BugReport["severity"];

export default function AdminPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);

  const isPresident = profile?.is_president;

  const loadReports = useCallback(async () => {
    try {
      const data = await getAllBugReports();
      setReports(data);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPresident) {
      navigate("/", { replace: true });
      return;
    }
    loadReports();
  }, [isPresident, navigate, loadReports]);

  async function handleStatusChange(reportId: string, newStatus: BugReport["status"]) {
    setUpdatingStatus(reportId);
    try {
      await updateBugReport(reportId, { status: newStatus });
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: newStatus, resolved_at: newStatus === "resolved" || newStatus === "closed" ? new Date().toISOString() : r.resolved_at }
            : r
        )
      );
      if (selectedReport?.id === reportId) {
        setSelectedReport((r) => r ? { ...r, status: newStatus } : null);
      }
    } catch {
      // silent
    } finally {
      setUpdatingStatus(null);
      setStatusDropdown(null);
    }
  }

  async function handleSaveNotes() {
    if (!selectedReport) return;
    setUpdatingStatus(selectedReport.id);
    try {
      await updateBugReport(selectedReport.id, { admin_notes: adminNotes });
      setReports((prev) =>
        prev.map((r) =>
          r.id === selectedReport.id ? { ...r, admin_notes: adminNotes } : r
        )
      );
      setSelectedReport((r) => r ? { ...r, admin_notes: adminNotes } : null);
    } catch {
      // silent
    } finally {
      setUpdatingStatus(null);
    }
  }

  const filtered = reports.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (severityFilter !== "all" && r.severity !== severityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.reporter_name.toLowerCase().includes(q) ||
        r.reporter_email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: reports.length,
    open: reports.filter((r) => r.status === "open").length,
    "in-progress": reports.filter((r) => r.status === "in-progress").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    closed: reports.filter((r) => r.status === "closed").length,
  };

  if (!isPresident) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-3 h-14 px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Bug Reports</h1>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {counts.open} open
          </Badge>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["open", "in-progress", "resolved", "closed"] as const).map((s) => {
            const config = STATUS_CONFIG[s];
            const Icon = config.icon;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                className={`flex items-center gap-2 rounded-xl border p-3 transition-all ${
                  statusFilter === s ? "ring-2 ring-primary ring-offset-1" : "hover:bg-muted/50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <p className="text-xl font-bold leading-none">{counts[s]}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{config.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, description, or reporter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setSeverityFilter(
                  severityFilter === "all" ? "critical" :
                  severityFilter === "critical" ? "high" :
                  severityFilter === "high" ? "medium" :
                  severityFilter === "medium" ? "low" : "all"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                {severityFilter === "all" ? "Severity" : SEVERITY_CONFIG[severityFilter].label}
              </Button>
            </div>
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Bug className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No bug reports found</p>
            <p className="text-sm mt-1">
              {reports.length === 0
                ? "No reports have been submitted yet."
                : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((report) => {
              const statusConf = STATUS_CONFIG[report.status];
              const StatusIcon = statusConf.icon;
              const sevConf = SEVERITY_CONFIG[report.severity];
              return (
                <Card
                  key={report.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedReport(report);
                    setAdminNotes(report.admin_notes || "");
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 mt-0.5 shrink-0">
                        <AvatarFallback className="text-xs">
                          {report.reporter_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm truncate">{report.title}</h3>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusConf.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConf.label}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${sevConf.color}`}>
                            {sevConf.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {report.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span>{report.reporter_name}</span>
                          <span>•</span>
                          <span>{CATEGORY_LABELS[report.category] ?? report.category}</span>
                          <span>•</span>
                          <span>{new Date(report.created_at).toLocaleDateString()}</span>
                          {report.screenshot_urls.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <ImageIcon className="h-3 w-3" />
                                {report.screenshot_urls.length}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline status changer */}
                      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => setStatusDropdown(statusDropdown === report.id ? null : report.id)}
                          disabled={updatingStatus === report.id}
                        >
                          {updatingStatus === report.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                        {statusDropdown === report.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-background border rounded-lg shadow-lg py-1 min-w-[130px]">
                            {(Object.keys(STATUS_CONFIG) as BugReport["status"][]).map((s) => (
                              <button
                                key={s}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors ${
                                  report.status === s ? "font-medium" : ""
                                }`}
                                onClick={() => handleStatusChange(report.id, s)}
                              >
                                {STATUS_CONFIG[s].label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedReport}
        onOpenChange={(v) => { if (!v) setSelectedReport(null); }}
      >
        {selectedReport && (
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base">{selectedReport.title}</DialogTitle>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CONFIG[selectedReport.status].color}`}>
                  {STATUS_CONFIG[selectedReport.status].label}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${SEVERITY_CONFIG[selectedReport.severity].color}`}>
                  {SEVERITY_CONFIG[selectedReport.severity].label}
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {/* Reporter Info */}
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {selectedReport.reporter_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{selectedReport.reporter_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedReport.reporter_email}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedReport.created_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[selectedReport.category]}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Description</h4>
                <p className="whitespace-pre-wrap text-sm">{selectedReport.description}</p>
              </div>

              {/* Steps to Reproduce */}
              {selectedReport.steps_to_reproduce && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Steps to Reproduce</h4>
                  <p className="whitespace-pre-wrap text-sm">{selectedReport.steps_to_reproduce}</p>
                </div>
              )}

              {/* Expected Behavior */}
              {selectedReport.expected_behavior && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Expected Behavior</h4>
                  <p className="whitespace-pre-wrap text-sm">{selectedReport.expected_behavior}</p>
                </div>
              )}

              {/* Device Info */}
              {selectedReport.device_info && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Device Info</h4>
                  <p className="text-xs text-muted-foreground break-all bg-muted/30 rounded p-2 font-mono">
                    {selectedReport.device_info}
                  </p>
                </div>
              )}

              {/* Screenshots */}
              {selectedReport.screenshot_urls.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Screenshots ({selectedReport.screenshot_urls.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedReport.screenshot_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative group rounded-lg border overflow-hidden bg-muted/30 aspect-video flex items-center justify-center"
                      >
                        <img
                          src={url}
                          alt={`Screenshot ${i + 1}`}
                          className="object-cover w-full h-full"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div className="border-t pt-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Admin Notes
                </h4>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring resize-none"
                  placeholder="Add internal notes about this report…"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>

              {/* Status Change */}
              <div className="border-t pt-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Update Status</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(STATUS_CONFIG) as BugReport["status"][]).map((s) => {
                    const conf = STATUS_CONFIG[s];
                    const Icon = conf.icon;
                    return (
                      <button
                        key={s}
                        disabled={updatingStatus === selectedReport.id}
                        onClick={() => handleStatusChange(selectedReport.id, s)}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                          selectedReport.status === s
                            ? conf.color + " ring-2 ring-offset-1 ring-primary"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/60 border-transparent"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {conf.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedReport(null)}>
                Close
              </Button>
              <Button
                onClick={handleSaveNotes}
                disabled={updatingStatus === selectedReport.id || adminNotes === (selectedReport.admin_notes || "")}
              >
                {updatingStatus === selectedReport.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Save Notes
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

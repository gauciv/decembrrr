import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getNoClassDates,
  addNoClassDate,
  removeNoClassDate,
  type NoClassDate,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CalendarPage() {
  const { profile } = useAuth();
  const [dates, setDates] = useState<NoClassDate[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const isPresident = profile?.is_president ?? false;

  const loadDates = useCallback(async () => {
    if (!profile?.class_id) return;
    const data = await getNoClassDates(profile.class_id);
    setDates(data);
  }, [profile?.class_id]);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  async function handleAdd() {
    if (!newDate || !profile?.class_id) return;
    setLoading(true);
    try {
      await addNoClassDate(profile.class_id, newDate, reason || "No class");
      setShowAdd(false);
      setNewDate("");
      setReason("");
      loadDates();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(dateId: string) {
    await removeNoClassDate(dateId);
    loadDates();
  }

  const upcoming = dates.filter((d) => new Date(d.date) >= new Date());
  const past = dates.filter((d) => new Date(d.date) < new Date());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>No-Class Dates</CardTitle>
              <CardDescription>
                Deductions are skipped on these days
              </CardDescription>
            </div>
            {isPresident && (
              <Button size="sm" onClick={() => setShowAdd(true)}>
                + Add Date
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 && past.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No dates marked yet
            </p>
          ) : (
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    UPCOMING
                  </p>
                  {upcoming.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-lg border p-3 mb-2"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(d.date).toLocaleDateString("en-PH", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.reason}
                        </p>
                      </div>
                      {isPresident && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleRemove(d.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {past.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    PAST
                  </p>
                  {past.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-lg border p-3 mb-2 opacity-60"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(d.date).toLocaleDateString("en-PH", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark No-Class Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Input
                placeholder="e.g. Holiday, Typhoon"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleAdd}
              disabled={loading || !newDate}
            >
              {loading ? "Saving…" : "Mark as No Class"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

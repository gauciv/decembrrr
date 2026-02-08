import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth";
import {
  getMyTransactionsPaginated,
  exportMyTransactionsCsv,
  type Transaction,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, ChevronLeft, ChevronRight, FileText } from "lucide-react";

/**
 * Student Transactions Tab — paginated log of all deposits & deductions
 * with CSV export.
 */
export default function StudentTransactionsTab() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const pageSize = 20;

  const loadPage = useCallback(
    async (p: number) => {
      if (!profile) return;
      const result = await getMyTransactionsPaginated(profile.id, p, pageSize);
      setTransactions(result.transactions);
      setTotalPages(result.totalPages);
      setTotal(result.total);
      setPage(result.page);
    },
    [profile]
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  if (!profile) return null;

  async function handleExport() {
    if (!profile) return;
    setExporting(true);
    try {
      await exportMyTransactionsCsv(profile.id, profile.name);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Transaction Log</h2>
          <p className="text-sm text-muted-foreground">
            {total} total {total === 1 ? "entry" : "entries"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || total === 0}
        >
          <Download className="h-4 w-4 mr-1" />
          {exporting ? "Exporting…" : "CSV"}
        </Button>
      </div>

      {/* Transaction list */}
      <Card>
        <CardContent className="pt-4">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No transactions yet
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {transactions.map((txn, i) => (
                <div key={txn.id}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {txn.note || (txn.type === "deposit" ? "Payment received" : "Daily deduction")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleDateString("en-PH", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={txn.type === "deposit" ? "default" : "secondary"}
                      className={
                        txn.type === "deposit"
                          ? "bg-green-600 ml-2"
                          : "bg-red-100 text-red-700 ml-2"
                      }
                    >
                      {txn.type === "deposit" ? "+" : "-"}₱{txn.amount.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => loadPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => loadPage(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

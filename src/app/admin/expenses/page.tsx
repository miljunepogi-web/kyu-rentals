"use client";

import { useState, useEffect } from "react";
import {
  AdminExpenseListItem,
  AdminExpenseCategoryItem,
  getAdminExpenses,
  getAdminExpenseCategories,
} from "@/queries/admin-financial.queries";
import { createExpenseAction, deleteExpenseAction } from "@/actions/admin-expense.actions";
import { formatPHP } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Building,
} from "lucide-react";

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<AdminExpenseListItem[]>([]);
  const [categories, setCategories] = useState<AdminExpenseCategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form Sheet State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getAdminExpenses(), getAdminExpenseCategories()]).then(
      ([expData, catData]) => {
        if (isMounted) {
          setExpenses(expData);
          setCategories(catData);
          if (catData[0]?.id) setCategoryId(catData[0].id);
          setIsLoading(false);
        }
      }
    );
    return () => { isMounted = false; };
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMsg("Please enter a positive expense amount.");
      return;
    }

    setIsSubmitting(true);

    const result = await createExpenseAction({
      categoryId,
      amount: numAmount,
      expenseDate,
      vendor: vendor.trim() || undefined,
      description: description.trim(),
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      setErrorMsg(result.error || "Failed to create expense.");
      setIsSubmitting(false);
      return;
    }

    setSuccessMsg("Expense recorded successfully.");
    setIsSubmitting(false);
    setShowCreateSheet(false);

    // Reset Form
    setAmount("");
    setDescription("");
    setVendor("");
    setNotes("");

    // Refresh
    const updated = await getAdminExpenses();
    setExpenses(updated);
  };

  const handleDelete = async (expenseId: string) => {
    const reason = window.prompt("Reason for deleting expense record:");
    if (!reason || reason.trim().length < 3) return;

    const result = await deleteExpenseAction({ expenseId, reason: reason.trim() });
    if (!result.success) {
      alert(result.error || "Failed to delete expense.");
      return;
    }

    const updated = await getAdminExpenses();
    setExpenses(updated);
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight">
            Operating Expense Ledger
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track categorized business expenses, vendor receipts, and operational costs.
          </p>
        </div>
        <Button onClick={() => setShowCreateSheet(true)} className="font-bold text-xs h-10 px-5 gap-2">
          <Plus className="h-4 w-4" /> Record New Expense
        </Button>
      </div>

      {/* Summary KPI */}
      <div className="rounded-2xl border bg-card p-6 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
            Total Recorded Expenses
          </span>
          <div className="font-outfit text-3xl font-extrabold text-destructive mt-1">
            {formatPHP(totalExpenseAmount)}
          </div>
        </div>
        <FileText className="h-10 w-10 text-destructive/30" />
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-xs font-semibold text-destructive border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl bg-green-500/10 p-4 text-xs font-semibold text-green-600 border border-green-500/20">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Expenses Table */}
      <div className="rounded-3xl border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-secondary/50 font-bold text-muted-foreground uppercase tracking-wider">
                <th className="p-4">Ref ID</th>
                <th className="p-4">Date</th>
                <th className="p-4">Category</th>
                <th className="p-4">Description / Vendor</th>
                <th className="p-4">Payment</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading expense records...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No active expense records found.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 font-mono font-bold text-primary">{e.publicId}</td>
                    <td className="p-4 font-semibold">{e.expenseDate}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full bg-secondary font-bold text-[11px]">
                        {e.categoryName}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold block text-foreground">{e.description}</span>
                      {e.vendor && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Building className="h-3 w-3" /> {e.vendor}
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-semibold">{e.paymentMethod}</td>
                    <td className="p-4 text-right font-extrabold text-destructive">
                      {formatPHP(e.amount)}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(e.id)}
                        className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Expense Slide-over Form */}
      {showCreateSheet && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-card border-l h-full p-6 space-y-6 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="font-outfit text-xl font-bold">Record Operating Expense</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateSheet(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label htmlFor="exp-category" className="text-xs font-bold">Category</Label>
                <select
                  id="exp-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="exp-amount" className="text-xs font-bold">Amount (PHP)</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1500.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 text-xs h-10"
                  required
                />
              </div>

              <div>
                <Label htmlFor="exp-date" className="text-xs font-bold">Expense Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 text-xs h-10"
                  required
                />
              </div>

              <div>
                <Label htmlFor="exp-vendor" className="text-xs font-bold">Vendor / Supplier</Label>
                <Input
                  id="exp-vendor"
                  placeholder="e.g. Shell Gas Station"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 text-xs h-10"
                />
              </div>

              <div>
                <Label htmlFor="exp-desc" className="text-xs font-bold">Description</Label>
                <Input
                  id="exp-desc"
                  placeholder="e.g. Fuel for delivery van - City route"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 text-xs h-10"
                  required
                />
              </div>

              <div>
                <Label htmlFor="exp-payment" className="text-xs font-bold">Payment Method</Label>
                <select
                  id="exp-payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  <option value="CASH">CASH</option>
                  <option value="GCASH">GCASH</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="CREDIT_CARD">CREDIT CARD</option>
                </select>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full font-bold text-xs h-11 mt-4">
                {isSubmitting ? "Saving Expense..." : "Confirm & Save Expense"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

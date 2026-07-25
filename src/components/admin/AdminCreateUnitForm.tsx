"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { createInventoryUnitAction } from "@/actions/admin-inventory.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, AlertCircle, CheckCircle2 } from "lucide-react";

interface Package {
  id: string;
  name: string;
}

interface AdminCreateUnitFormProps {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function AdminCreateUnitForm({ onClose, onSuccess }: AdminCreateUnitFormProps) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [packageId, setPackageId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    supabase
      .from("packages")
      .select("id, name")
      .eq("is_deleted", false)
      .eq("is_published", true)
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (isMounted && data) {
          setPackages(data as Package[]);
          const first = (data as unknown as Package[])[0];
          if (first) setPackageId(first.id);
        }
      });

    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!packageId) { setErrorMsg("Please select a package."); return; }
    if (!serialNumber.trim() || serialNumber.trim().length < 2) {
      setErrorMsg("Serial number must be at least 2 characters.");
      return;
    }

    setIsSubmitting(true);

    const result = await createInventoryUnitAction({
      packageId,
      serialNumber: serialNumber.trim(),
      conditionNotes: conditionNotes.trim() || undefined,
    });

    if (!result.success) {
      setErrorMsg(result.error || "Failed to create unit.");
      setIsSubmitting(false);
      return;
    }

    setSuccessMsg(`Unit ${result.data?.publicId} created successfully.`);
    setSerialNumber("");
    setConditionNotes("");
    setIsSubmitting(false);

    // Await list refresh before closing so the user never sees stale data.
    await onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-card border-l h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6">
          <div>
            <span className="text-xs font-bold text-primary tracking-wider uppercase">New Unit</span>
            <h2 className="font-outfit text-xl font-bold mt-0.5">Create Inventory Unit</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 justify-between p-6 space-y-5">
          <div className="space-y-5">
            {errorMsg && (
              <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-xs font-semibold text-destructive border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />{errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-3 rounded-xl bg-green-500/10 p-4 text-xs font-semibold text-green-600 border border-green-500/20">
                <CheckCircle2 className="h-4 w-4 shrink-0" />{successMsg}
              </div>
            )}

            <div>
              <Label htmlFor="create-package-id" className="text-xs font-bold">
                Package <span className="text-destructive">*</span>
              </Label>
              <select
                id="create-package-id"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                disabled={isSubmitting || packages.length === 0}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {packages.length === 0 ? (
                  <option value="">Loading packages...</option>
                ) : (
                  packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <Label htmlFor="create-serial-number" className="text-xs font-bold">
                Serial Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-serial-number"
                placeholder="e.g. KYU-MINI-001"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 h-10 text-xs font-mono"
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">Must be unique per tenant.</p>
            </div>

            <div>
              <Label htmlFor="create-condition-notes" className="text-xs font-bold">
                Condition Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="create-condition-notes"
                rows={3}
                placeholder="Initial condition, accessories included, notes..."
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="rounded-xl bg-secondary/40 border p-4 text-xs text-muted-foreground">
              New units are created with status <span className="font-bold text-green-600">READY TO DEPLOY</span> by default.
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || packages.length === 0}
            className="w-full h-11 font-bold text-sm gap-2"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Creating Unit..." : "Create Inventory Unit"}
          </Button>
        </form>
      </div>
    </div>
  );
}

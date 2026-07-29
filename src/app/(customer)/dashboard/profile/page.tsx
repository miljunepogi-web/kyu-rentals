"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CustomerProfile, getCustomerProfile } from "@/queries/customer.queries";
import { updateCustomerProfileAction } from "@/actions/customer.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone, Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function CustomerProfilePage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && isMounted) {
        getCustomerProfile(user.id).then((p) => {
          if (p && isMounted) {
            setProfile(p);
            setFullName(p.fullName);
            setPhone(p.phone || "");
            setIsLoading(false);
          }
        });
      } else if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setErrorMsg("Full name is required.");
      return;
    }

    setIsSubmitting(true);

    const result = await updateCustomerProfileAction({
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
    });

    if (!result.success) {
      setErrorMsg(result.error || "Failed to update profile.");
      setIsSubmitting(false);
      return;
    }

    setSuccessMsg("Profile details updated successfully.");
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="py-16 text-center text-muted-foreground text-sm font-medium space-y-3"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" aria-hidden="true" />
        <span>Loading profile details...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-2xl mx-auto px-4 py-6 sm:py-8">
      <div>
        <span className="text-xs font-bold text-primary uppercase tracking-widest">
          Account Preferences
        </span>
        <h1 className="font-outfit text-2xl sm:text-3xl font-extrabold mt-1">My Customer Profile</h1>
      </div>

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-3 rounded-xl bg-destructive/10 p-3.5 sm:p-4 text-xs sm:text-sm font-semibold text-destructive border border-destructive/20"
        >
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 rounded-xl bg-green-500/10 p-3.5 sm:p-4 text-xs sm:text-sm font-semibold text-green-600 border border-green-500/20"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl sm:rounded-3xl border bg-card p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 shadow-xs">
        <div className="space-y-1.5">
          <Label htmlFor="profile-public-id" className="text-xs sm:text-sm font-bold text-muted-foreground">
            Customer Reference ID
          </Label>
          <Input
            id="profile-public-id"
            value={profile?.publicId || "USR-000000"}
            disabled
            className="h-11 sm:h-12 min-h-[44px] bg-secondary/50 font-mono text-xs sm:text-sm font-bold"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-email" className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Email Address
          </Label>
          <Input
            id="profile-email"
            value={profile?.email || ""}
            disabled
            className="h-11 sm:h-12 min-h-[44px] bg-secondary/50 text-xs sm:text-sm font-medium"
          />
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            Email address is tied to your login account and cannot be modified here.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-fullname" className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="profile-fullname"
            placeholder="e.g. Juan Dela Cruz"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isSubmitting}
            className="h-11 sm:h-12 min-h-[44px] text-xs sm:text-sm"
            required
            aria-required="true"
            aria-invalid={errorMsg && !fullName ? true : false}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-phone" className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Contact Phone
          </Label>
          <Input
            id="profile-phone"
            placeholder="e.g. 09171234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSubmitting}
            className="h-11 sm:h-12 min-h-[44px] text-xs sm:text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 sm:h-12 min-h-[44px] font-bold text-xs sm:text-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Changes...
            </>
          ) : (
            "Save Profile Changes"
          )}
        </Button>
      </form>
    </div>
  );
}

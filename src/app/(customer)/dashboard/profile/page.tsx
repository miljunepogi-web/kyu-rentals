"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CustomerProfile, getCustomerProfile } from "@/queries/customer.queries";
import { updateCustomerProfileAction } from "@/actions/customer.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone, Mail, CheckCircle2, AlertCircle } from "lucide-react";

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
      <div className="py-20 text-center text-muted-foreground text-sm font-medium">
        Loading profile details...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto px-4 py-8">
      <div>
        <span className="text-xs font-bold text-primary uppercase tracking-widest">
          Account Preferences
        </span>
        <h1 className="font-outfit text-3xl font-extrabold mt-1">My Customer Profile</h1>
      </div>

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

      <form onSubmit={handleSubmit} className="rounded-3xl border bg-card p-6 md:p-8 space-y-6 shadow-xs">
        <div>
          <Label htmlFor="profile-public-id" className="text-xs font-bold text-muted-foreground">
            Customer Reference ID
          </Label>
          <Input
            id="profile-public-id"
            value={profile?.publicId || "USR-000000"}
            disabled
            className="mt-1 bg-secondary/50 font-mono text-xs font-bold"
          />
        </div>

        <div>
          <Label htmlFor="profile-email" className="text-xs font-bold flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-primary" /> Email Address
          </Label>
          <Input
            id="profile-email"
            value={profile?.email || ""}
            disabled
            className="mt-1 bg-secondary/50 text-xs font-medium"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Email address is tied to your login account and cannot be modified here.
          </p>
        </div>

        <div>
          <Label htmlFor="profile-fullname" className="text-xs font-bold flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-primary" /> Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="profile-fullname"
            placeholder="e.g. Juan Dela Cruz"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isSubmitting}
            className="mt-1 text-xs h-10"
            required
          />
        </div>

        <div>
          <Label htmlFor="profile-phone" className="text-xs font-bold flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-primary" /> Contact Phone
          </Label>
          <Input
            id="profile-phone"
            placeholder="e.g. 09171234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSubmitting}
            className="mt-1 text-xs h-10"
          />
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full h-11 font-bold text-sm">
          {isSubmitting ? "Saving Changes..." : "Save Profile Changes"}
        </Button>
      </form>
    </div>
  );
}

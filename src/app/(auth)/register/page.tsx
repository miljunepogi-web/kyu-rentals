"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Sparkles, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { buildEmailConfirmationRedirect } from "@/lib/auth/redirects";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageSlug = searchParams.get("package");

  const showError = (message: string) => {
    setFormSuccess(null);
    setFormError(message);
    toast.error(message);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!email || !password || !fullName) {
      showError("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const bookingPath = packageSlug
      ? `/packages/${encodeURIComponent(packageSlug)}/book`
      : "/dashboard";

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: buildEmailConfirmationRedirect(window.location.origin, bookingPath),
        },
      });

      if (error) {
        const message = error.message?.toLowerCase().includes("rate limit")
          ? "Too many signup attempts. Please wait a few minutes, then try again."
          : error.message || "Failed to create customer account.";
        showError(message);
        return;
      }

      if (!data.user) {
        showError("We could not create your account. Please try again.");
        return;
      }

      if (!data.session) {
        const message =
          "Account created. Please check your email to confirm your account before booking.";
        setFormError(null);
        setFormSuccess(message);
        toast.success(message);
        return;
      }

      if (data.user) {
        const message = "Customer account created. Welcome to KYU Rentals.";
        setFormSuccess(message);
        toast.success("Customer Account Created! Welcome to KYU Rentals");
        router.push(bookingPath);
        router.refresh();
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during account creation.";
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <Card className="border-primary/20 w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="bg-primary text-primary-foreground font-outfit mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-extrabold shadow-md">
            K
          </div>
          <CardTitle className="font-outfit text-2xl font-bold tracking-tight">
            Customer Account Registration
          </CardTitle>
          <CardDescription className="text-xs">
            Create your KYU Rentals account to reserve karaoke packages & manage bookings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formError && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive mb-4 flex gap-3 rounded-md border p-3 text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{formError}</p>
            </div>
          )}

          {formSuccess && (
            <div
              role="status"
              className="border-primary/30 bg-primary/10 text-foreground mb-4 flex gap-3 rounded-md border p-3 text-sm"
            >
              <CheckCircle2 className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <p>{formSuccess}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="reg-fullname">Full Name</Label>
              <Input
                id="reg-fullname"
                type="text"
                placeholder="Juan Dela Cruz"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email Address</Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <Input
                id="reg-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full font-bold" disabled={isLoading}>
              <UserCheck className="mr-2 h-4 w-4" />
              {isLoading ? "Creating Account..." : "Register & Reserve Package"}
            </Button>
          </form>

          {packageSlug && (
            <p className="text-muted-foreground mt-4 flex items-center justify-center gap-1 text-center text-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Reserving package:{" "}
              <strong className="text-foreground capitalize">{packageSlug}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

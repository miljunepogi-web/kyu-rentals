"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageSlug = searchParams.get("package");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        toast.error(error.message || "Failed to create customer account");
        return;
      }

      if (data.user) {
        toast.success("Customer Account Created! Welcome to KYU Rentals");
        router.push(packageSlug ? `/packages/${packageSlug}` : "/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred during account creation");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold font-outfit text-xl shadow-md">
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
          <form onSubmit={handleRegister} className="space-y-4">
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
            <Button type="submit" className="w-full font-bold h-11" disabled={isLoading}>
              <UserCheck className="mr-2 h-4 w-4" />
              {isLoading ? "Creating Account..." : "Register & Reserve Package"}
            </Button>
          </form>

          {packageSlug && (
            <p className="mt-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Reserving package: <strong className="text-foreground capitalize">{packageSlug}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

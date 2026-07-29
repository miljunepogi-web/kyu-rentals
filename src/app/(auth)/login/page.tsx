"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getSafeAuthRedirectPath } from "@/lib/auth/redirects";
import { loginSchema, type LoginInput } from "@/schemas/auth.schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeAuthRedirectPath(searchParams.get("next"));
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace(nextPath);
      } else {
        setIsCheckingAuth(false);
      }
    });
  }, [nextPath, router, supabase]);

  const onSubmit = async (input: LoginInput) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(input);
      if (error) {
        toast.error(error.message || "Could not sign in to your customer account.");
        return;
      }

      toast.success("Welcome back to KYU Rentals.");
      router.push(nextPath);
      router.refresh();
    } catch {
      toast.error("An unexpected sign-in error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-muted-foreground">
        Checking your customer session...
      </div>
    );
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary font-outfit text-xl font-extrabold text-primary-foreground shadow-md">
            K
          </div>
          <CardTitle className="font-outfit text-2xl font-bold">Customer Sign In</CardTitle>
          <CardDescription className="text-xs">
            Access your bookings, payments, and rental status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email Address</Label>
              <Input
                id="customer-email"
                type="email"
                autoComplete="email"
                disabled={isLoading}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs font-medium text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-password">Password</Label>
              <Input
                id="customer-password"
                type="password"
                autoComplete="current-password"
                disabled={isLoading}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="h-11 w-full font-bold" disabled={isLoading}>
              <LogIn className="mr-2 h-4 w-4" />
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            New customer?{" "}
            <Link href="/register" className="font-semibold text-foreground underline underline-offset-2">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

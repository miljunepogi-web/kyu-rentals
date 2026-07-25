"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { loginSchema, LoginInput } from "@/schemas/auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Shield } from "lucide-react";

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace("/admin/dashboard");
      } else {
        setIsCheckingAuth(false);
      }
    });
  }, [router, supabase]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message || "Failed to sign in to Admin Portal");
        return;
      }

      toast.success("Welcome back to KYU Rentals Admin Portal!");
      router.replace("/admin/dashboard");
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred during authentication");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-muted-foreground">
        Verifying Admin Credentials...
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold font-outfit text-xl shadow-md">
            K
          </div>
          <CardTitle className="font-outfit text-2xl font-bold tracking-tight">
            KYU Rentals Admin Portal
          </CardTitle>
          <CardDescription className="text-xs">
            Enter your staff or administrator credentials to access management systems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@kyurentals.ph"
                disabled={isLoading}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs font-medium text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                disabled={isLoading}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full font-bold h-11" disabled={isLoading}>
              <Shield className="mr-2 h-4 w-4" />
              {isLoading ? "Signing in..." : "Sign In to Admin Portal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

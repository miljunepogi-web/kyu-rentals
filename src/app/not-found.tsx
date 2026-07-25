import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="font-outfit text-6xl font-bold tracking-tight text-primary">404</h1>
      <h2 className="mt-4 text-2xl font-semibold">Page Not Found</h2>
      <p className="mt-2 text-muted-foreground max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    </div>
  );
}

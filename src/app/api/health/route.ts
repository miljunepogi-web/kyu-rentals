import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: pkg.version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
    },
    { status: 200 }
  );
}

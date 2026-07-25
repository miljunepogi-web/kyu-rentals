import { NextResponse } from "next/server";
import { ErrorCode } from "./errors";

export type Result<T, E = string> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E; code: ErrorCode };

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, code: ErrorCode = ErrorCode.INTERNAL_ERROR, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      details,
    },
    { status }
  );
}

import { ErrorContext, ErrorSeverity, MonitoringUser } from "./types";
import { sentryCaptureException, sentryCaptureMessage, sentrySetUser } from "./sentry";

export type { ErrorContext, ErrorSeverity, MonitoringUser };

export function captureException(error: unknown, context?: ErrorContext): void {
  sentryCaptureException(error, context);
}

export function captureMessage(message: string, severity: ErrorSeverity = "info", context?: ErrorContext): void {
  sentryCaptureMessage(message, severity, context);
}

export function setUser(user: MonitoringUser | null): void {
  sentrySetUser(user);
}

export function startSpan<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
  // Placeholder span tracer (will map to Sentry/OTel in Phase 7)
  return fn();
}

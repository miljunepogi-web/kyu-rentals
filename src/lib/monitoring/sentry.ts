import { ErrorContext, ErrorSeverity, MonitoringUser } from "./types";
import { logger } from "@/utils/logger";

/**
 * Sentry Integration Stub (Phase 1.1)
 * Logs to structured logger in development.
 * Will be wired to @sentry/nextjs SDK in Phase 7.
 */

export function sentryCaptureException(error: unknown, context?: ErrorContext): void {
  logger.error(`[Sentry Stub] Exception captured`, { error, context });
}

export function sentryCaptureMessage(message: string, severity: ErrorSeverity = "info", context?: ErrorContext): void {
  logger.info(`[Sentry Stub] Message captured (${severity}): ${message}`, { context });
}

export function sentrySetUser(user: MonitoringUser | null): void {
  logger.info(`[Sentry Stub] User context set`, { userId: user?.id });
}

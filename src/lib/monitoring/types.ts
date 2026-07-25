export type ErrorSeverity = "fatal" | "error" | "warning" | "info" | "debug";

export interface ErrorContext {
  user?: {
    id: string;
    email?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface MonitoringUser {
  id: string;
  email?: string;
  role?: string;
}

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== "production";

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): LogPayload {
    return {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`, context || "");
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    const payload = this.formatMessage("info", message, context);
    // eslint-disable-next-line no-console
    console.info(`[INFO] ${payload.message}`, payload.context || "");
  }

  warn(message: string, context?: Record<string, unknown>) {
    const payload = this.formatMessage("warn", message, context);
    console.warn(`[WARN] ${payload.message}`, payload.context || "");
  }

  error(message: string, context?: Record<string, unknown>) {
    const payload = this.formatMessage("error", message, context);
    console.error(`[ERROR] ${payload.message}`, payload.context || "");
  }
}

export const logger = new Logger();

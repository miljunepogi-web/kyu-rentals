export enum ErrorCode {
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  AUTH_EXPIRED = "AUTH_EXPIRED",
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: ErrorCode = ErrorCode.INTERNAL_ERROR, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function createValidationError(message: string, details?: unknown): AppError {
  return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, details);
}

export function createUnauthorizedError(message = "Unauthorized access"): AppError {
  return new AppError(message, ErrorCode.UNAUTHORIZED, 401);
}

export function createNotFoundError(message = "Resource not found"): AppError {
  return new AppError(message, ErrorCode.NOT_FOUND, 404);
}

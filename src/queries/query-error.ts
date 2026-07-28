import { captureException } from "@/lib/monitoring";

export class QueryError extends Error {
  readonly operation: string;

  constructor(operation: string, cause: unknown) {
    super(`Query failed: ${operation}`, { cause });
    this.name = "QueryError";
    this.operation = operation;
  }
}

export function throwQueryError(operation: string, cause: unknown): never {
  const error = cause instanceof QueryError ? cause : new QueryError(operation, cause);

  captureException(error, {
    tags: { layer: "query", operation },
    extra: { databaseError: cause },
  });

  throw error;
}

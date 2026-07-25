export interface ApiRequestConfig extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  timeoutMs?: number;
}

export interface ApiClientResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

import { ApiError, ApiRequestConfig, ApiClientResponse } from "./types";
import { logger } from "@/utils/logger";

const DEFAULT_TIMEOUT_MS = 10000;

export async function apiRequest<T>(
  endpoint: string,
  config: ApiRequestConfig = {}
): Promise<ApiClientResponse<T>> {
  const { body, params, timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...customConfig } = config;

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      searchParams.append(key, String(val));
    });
    url += `?${searchParams.toString()}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  try {
    const response = await fetch(url, {
      ...customConfig,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      throw new ApiError(`API Request failed with status ${response.status}`, response.status, errorData);
    }

    const data = (await response.json()) as T;
    return {
      data,
      status: response.status,
      headers: response.headers,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) {
      throw error;
    }
    const err = error as Error;
    logger.error(`API Client Error: ${err.message}`, { endpoint, error: err });
    throw new ApiError(err.message || "Network request failed", 500);
  }
}

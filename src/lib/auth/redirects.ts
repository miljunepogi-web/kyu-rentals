const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function getSafeAuthRedirectPath(
  next: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  return next;
}

export function buildEmailConfirmationRedirect(origin: string, next?: string | null) {
  const callbackUrl = new URL("/api/auth/callback", origin);
  callbackUrl.searchParams.set("next", getSafeAuthRedirectPath(next));
  return callbackUrl.toString();
}

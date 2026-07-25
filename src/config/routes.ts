export const ROUTES = {
  PUBLIC: {
    HOME: "/",
    PACKAGES: "/packages",
    FAQ: "/faq",
    COVERAGE: "/coverage",
  },
  AUTH: {
    LOGIN: "/login",
    REGISTER: "/register",
    FORGOT_PASSWORD: "/forgot-password",
    CALLBACK: "/api/auth/callback",
  },
  CUSTOMER: {
    DASHBOARD: "/dashboard",
    BOOKINGS: "/dashboard/bookings",
    PROFILE: "/dashboard/profile",
  },
  ADMIN: {
    DASHBOARD: "/admin",
    BOOKINGS: "/admin/bookings",
    PACKAGES: "/admin/packages",
    INVENTORY: "/admin/inventory",
    DELIVERIES: "/admin/deliveries",
    REPORTS: "/admin/reports",
    SETTINGS: "/admin/settings",
  },
  API: {
    HEALTH: "/api/health",
  },
} as const;

export type RouteKey = typeof ROUTES;

export const FEATURE_FLAGS = {
  NOTIFICATIONS_SMS: false,
  NOTIFICATIONS_EMAIL: true,
  EXPENSE_MODULE: false,
  DELIVERY_GPS_TRACKING: false,
  SAAS_MULTI_TENANT: false,
  REVIEWS_MODULE: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Checks if a feature flag is enabled.
 * Evaluates in order:
 * 1. Environment variable override (e.g. FEATURE_NOTIFICATIONS_SMS=true)
 * 2. Default registry value
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const envVarName = `FEATURE_${flag}`;
  const envOverride = process.env[envVarName];

  if (envOverride !== undefined) {
    return envOverride === "true" || envOverride === "1";
  }

  return FEATURE_FLAGS[flag] ?? false;
}

export function getEnabledFeatures(): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(isFeatureEnabled);
}

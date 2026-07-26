import { getPayMongoConfig, createPayMongoCheckoutSession } from "@/lib/api/paymongo";

describe("Milestone 3.4 - PayMongo Integration Code Review Verification", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string>).NODE_ENV = originalEnv;
  });

  test("validates PayMongo environment configuration defaults", () => {
    const config = getPayMongoConfig();
    expect(config.appUrl).toBeDefined();
    expect(config.secretKey).toBeDefined();
  });

  test("prohibits mock checkout engine in production environment", () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.PAYMONGO_SECRET_KEY = "";
    expect(() => getPayMongoConfig()).toThrow("PAYMONGO_SECRET_KEY environment variable must be a valid live/test key in production environment.");
  });

  test("creates mock PayMongo checkout session in development/test environment", async () => {
    (process.env as Record<string, string>).NODE_ENV = "test";
    const result = await createPayMongoCheckoutSession({
      bookingId: "11111111-2222-3333-4444-555555555555",
      bookingPublicId: "BK-2026-99999",
      packageName: "KYU Party Pro",
      customerFullName: "Juan Dela Cruz",
      customerEmail: "juan@example.com",
      customerPhone: "09171234567",
      depositAmount: 999, // ₱999 deposit amount
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.checkoutSessionId).toContain("cs_mock_");
      expect(result.data.checkoutUrl).toContain("dashboard?booking=");
    }
  });
});

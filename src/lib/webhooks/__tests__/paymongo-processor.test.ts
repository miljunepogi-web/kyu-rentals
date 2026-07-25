import crypto from "crypto";
import { verifyPayMongoSignature } from "../paymongo-processor";

describe("Milestone 3.5 - PayMongo Webhook Processor", () => {
  const secret = "whsec_test_secret_key_12345";
  const body = JSON.stringify({
    data: {
      id: "evt_test_123",
      type: "event",
      attributes: {
        type: "checkout_session.payment.paid",
        livemode: false,
        data: {
          id: "pay_test_999",
          type: "payment",
          attributes: {
            amount: 99900, // ₱999 in centavos
            currency: "PHP",
            status: "paid",
            metadata: {
              booking_id: "11111111-2222-3333-4444-555555555555",
            },
          },
        },
      },
    },
  });

  test("verifies valid HMAC SHA-256 webhook signature", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadToSign = `${timestamp}.${body}`;
    const signature = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");
    const signatureHeader = `t=${timestamp},te=${signature}`;

    const isValid = verifyPayMongoSignature(body, signatureHeader, secret);
    expect(isValid).toBe(true);
  });

  test("rejects invalid webhook signature", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureHeader = `t=${timestamp},te=invalid_signature_hex`;

    const isValid = verifyPayMongoSignature(body, signatureHeader, secret);
    expect(isValid).toBe(false);
  });

  test("rejects webhook missing required signature header when secret is active", () => {
    const isValid = verifyPayMongoSignature(body, null, secret);
    expect(isValid).toBe(false);
  });
});

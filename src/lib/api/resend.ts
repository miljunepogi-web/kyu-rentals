import { logger } from "@/utils/logger";

/**
 * Resend Email API Client (Primary MVP Notification Channel)
 * Handles transactional emails for booking confirmations, invoices, receipts, and status updates.
 */
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
}

export interface EmailResponse {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Sends an email notification via Resend API.
 */
export async function sendEmailNotification(payload: EmailPayload): Promise<EmailResponse> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "re_your_resend_api_key") {
    logger.info(
      `[Email Dispatch Mock]: RESEND_API_KEY omitted in dev mode. Simulated email to ${payload.to}: ${payload.subject}`
    );
    return {
      success: true,
      emailId: `mock_email_${Date.now()}`,
    };
  }

  try {
    const fromAddress = payload.from || "KYU Rentals <notifications@kyurentals.com>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        attachments: payload.attachments,
      }),
    });

    if (!res.ok) {
      const errData = await res.json();
      logger.error("Resend API email error", { error: errData, recipient: payload.to });
      return { success: false, error: JSON.stringify(errData) };
    }

    const data = await res.json();
    logger.info("Resend email dispatched successfully", { emailId: data.id, recipient: payload.to });
    return { success: true, emailId: data.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Email dispatch failure";
    logger.error("Resend email dispatch exception", { error: errorMsg, recipient: payload.to });
    return { success: false, error: errorMsg };
  }
}

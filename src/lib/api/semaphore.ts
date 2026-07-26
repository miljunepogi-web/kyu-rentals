import { logger } from "@/utils/logger";

/**
 * Semaphore SMS API Client Abstraction.
 * 
 * MVP LAUNCH NOTICE:
 * SMS notifications via Semaphore are gracefully disabled for the MVP launch.
 * Email via Resend serves as the primary notification channel.
 * 
 * The abstraction, interfaces, and function signatures remain 100% preserved
 * and ready for instant activation in future phases when SEMAPHORE_API_KEY is configured.
 */
export interface SMSPayload {
  number: string;
  message: string;
  senderName?: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * Sends an SMS notification via Semaphore API.
 * Gracefully logs a warning and returns `{ success: true, disabled: true }` if SMS is disabled for MVP
 * or if SEMAPHORE_API_KEY is omitted, preventing any runtime errors or exceptions.
 */
export async function sendSMSNotification(payload: SMSPayload): Promise<SMSResponse> {
  const apiKey = process.env.SEMAPHORE_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_semaphore_api_key") {
    logger.warn(
      `[SMS Notification Bypassed]: Semaphore SMS is disabled for MVP launch. Skipping SMS dispatch to ${payload.number}.`,
      { recipient: payload.number }
    );
    return {
      success: true,
      disabled: true,
    };
  }

  try {
    const senderName = payload.senderName || process.env.SEMAPHORE_SENDER_NAME || "KYURentals";
    const res = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        apikey: apiKey,
        number: payload.number,
        message: payload.message,
        sendername: senderName,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.warn(`Semaphore API error response: ${errText}`, { recipient: payload.number });
      return { success: false, error: errText };
    }

    const data = await res.json();
    return { success: true, messageId: Array.isArray(data) ? data[0]?.message_id : undefined };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Semaphore SMS dispatch error";
    logger.warn(`SMS dispatch encountered non-fatal error: ${errorMsg}`, { recipient: payload.number });
    return { success: true, disabled: true, error: errorMsg };
  }
}

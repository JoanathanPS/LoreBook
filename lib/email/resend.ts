import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  from = process.env.RESEND_FROM_EMAIL || "LoreBook <onboarding@resend.dev>",
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("RESEND_API_KEY is not configured in .env.local. Email sending skipped:", {
      to,
      subject,
    });
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Resend email delivery exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email delivery failed",
    };
  }
}

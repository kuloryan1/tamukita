import "server-only";
import { getTransactionalEmailEndpoint } from "@/lib/email-transport";

type TransactionalEmail = { to: string; subject: string; html: string; text: string };

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  const response = await fetch(getTransactionalEmailEndpoint(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function sendAccountActionEmail({
  to,
  name,
  purpose,
  token,
}: {
  to: string;
  name: string | null;
  purpose: "VERIFY_EMAIL" | "PASSWORD_RESET";
  token: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const path = purpose === "VERIFY_EMAIL" ? "/verify-email" : "/reset-password";
  const link = new URL(path, appUrl);
  link.searchParams.set("token", token);
  const greeting = name ? `Halo ${name},` : "Halo,";
  const action = purpose === "VERIFY_EMAIL" ? "konfirmasi alamat email" : "mengatur kata sandi";
  const subject = purpose === "VERIFY_EMAIL" ? "Konfirmasi email TamuKita" : "Atur kata sandi TamuKita";
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#35473b"><p>${escapeHtml(greeting)}</p><p>Gunakan tautan berikut untuk ${action} akun TamuKita. Tautan berlaku selama 24 jam dan hanya dapat digunakan sekali.</p><p><a href="${escapeHtml(link.toString())}" style="display:inline-block;background:#35473b;color:#fff;padding:12px 18px;text-decoration:none">${purpose === "VERIFY_EMAIL" ? "Konfirmasi email" : "Atur kata sandi"}</a></p><p>Jika kamu tidak meminta tindakan ini, abaikan email ini.</p></div>`;
  const text = `${greeting}\n\nGunakan tautan berikut untuk ${action} akun TamuKita. Tautan berlaku selama 24 jam dan hanya dapat digunakan sekali.\n\n${link.toString()}\n\nJika kamu tidak meminta tindakan ini, abaikan email ini.`;
  return sendTransactionalEmail({ to, subject, html, text });
}

export function getTransactionalEmailEndpoint() {
  const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  const usesLocalE2eEmailMock = process.env.E2E_EMAIL_MOCK === "true"
    && appUrl.protocol === "http:"
    && ["127.0.0.1", "localhost", "::1"].includes(appUrl.hostname);
  return usesLocalE2eEmailMock ? "http://127.0.0.1:3140/emails" : "https://api.resend.com/emails";
}

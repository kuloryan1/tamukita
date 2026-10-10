import type { TestInfo } from "@playwright/test";

export function getCustomerCredentials(testInfo: Pick<TestInfo, "project">) {
  const prefix = testInfo.project.name === "mobile-webkit"
    ? "E2E_WEBKIT_CUSTOMER"
    : testInfo.project.name.startsWith("mobile-") ? "E2E_MOBILE_CUSTOMER" : "E2E_CUSTOMER";
  const projectEmail = process.env[`${prefix}_EMAIL`];
  const projectPassword = process.env[`${prefix}_PASSWORD`];

  if (projectEmail && projectPassword) {
    return { email: projectEmail, password: projectPassword };
  }

  return {
    email: process.env.E2E_CUSTOMER_EMAIL,
    password: process.env.E2E_CUSTOMER_PASSWORD,
  };
}

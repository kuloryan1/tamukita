import type { Metadata } from "next";
import "./globals.css";
import "./garden-invitation.css";
import "./manual-payments.css";
import "./paparazzi.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io"),
  title: {
    default: "TamuKita — Momen istimewa, jadi lebih dekat",
    template: "%s | TamuKita",
  },
  description: "Buat undangan digital yang personal, indah, dan mudah dibagikan bersama TamuKita.",
  applicationName: "TamuKita",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TamuKita — Momen istimewa, jadi lebih dekat",
    template: "%s | TamuKita",
  },
  description: "Buat undangan digital yang personal, indah, dan mudah dibagikan bersama TamuKita.",
  applicationName: "TamuKita",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

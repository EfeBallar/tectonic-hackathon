import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP } from "@/config/app";

export const metadata: Metadata = {
  title: `${APP.productName} · ${APP.assistantName} prototype`,
  description: APP.tagline,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a3561" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}

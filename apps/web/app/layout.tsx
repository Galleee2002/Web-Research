import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import "../styles/globals.scss";
import { AppShell } from "./_components/app-shell";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Business Lead Finder",
  description: "Dashboard and ingestion pipeline for local business leads."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={manrope.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

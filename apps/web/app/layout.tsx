import type { Metadata } from "next";

import "../styles/globals.scss";

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
      <body>{children}</body>
    </html>
  );
}

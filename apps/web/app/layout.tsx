import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import "../styles/globals.scss";
import { SidebarNav } from "./_components/sidebar-nav";

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
        <div className="dashboard-shell">
          <SidebarNav />
          <main id="main-content" className="dashboard-main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics | Business Lead Finder",
};

export default function AnalyticsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

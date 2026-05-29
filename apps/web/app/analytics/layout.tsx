import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics | leadScope",
};

export default function AnalyticsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

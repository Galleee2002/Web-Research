"use client";

import dynamic from "next/dynamic";

import { AnalyticsChartsSkeleton } from "./analytics-charts-skeleton";

const AnalyticsDashboard = dynamic(() => import("./analytics-dashboard"), {
  ssr: false,
  loading: () => (
    <section
      className="dashboard-content analytics-dashboard"
      aria-labelledby="analytics-title"
      aria-busy="true"
    >
      <header className="dashboard-content__header">
        <h2 id="analytics-title">Analytics</h2>
      </header>
      <AnalyticsChartsSkeleton />
    </section>
  ),
});

export default function AnalyticsDynamic() {
  return <AnalyticsDashboard />;
}

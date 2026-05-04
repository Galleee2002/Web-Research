"use client";

import dynamic from "next/dynamic";

const AnalyticsDashboard = dynamic(() => import("./analytics-dashboard"), {
  ssr: false,
  loading: () => (
    <section
      className="dashboard-content analytics-dashboard"
      aria-busy="true"
      aria-label="Loading analytics"
    >
      <header className="dashboard-content__header">
        <h2>Analytics</h2>
      </header>
      <div className="dashboard-empty-state" role="status">
        <p className="dashboard-empty-state__title">Loading charts…</p>
      </div>
    </section>
  ),
});

export default function AnalyticsDynamic() {
  return <AnalyticsDashboard />;
}

"use client";

export function AnalyticsChartsSkeleton() {
  const chartCards = (offset: number) =>
    [0, 1].map((i) => (
      <div key={offset + i} className="analytics-dashboard__chart-card">
        <span
          className="dashboard-home-shimmer analytics-dashboard__skel-chart-heading"
          aria-hidden
        />
        <div className="analytics-dashboard__chart-surface analytics-dashboard__chart-surface--skeleton">
          <div className="dashboard-home-shimmer analytics-dashboard__skel-donut" aria-hidden />
          <div className="analytics-dashboard__skel-legend" aria-hidden>
            <span className="dashboard-home-shimmer analytics-dashboard__skel-legend-pill" />
            <span
              className="dashboard-home-shimmer analytics-dashboard__skel-legend-pill analytics-dashboard__skel-legend-pill--short"
            />
            <span className="dashboard-home-shimmer analytics-dashboard__skel-legend-pill" />
          </div>
        </div>
      </div>
    ));

  return (
    <div
      className="analytics-dashboard__body analytics-dashboard__body--skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <section className="analytics-dashboard__group" aria-hidden>
        <span className="dashboard-home-shimmer analytics-dashboard__skel-group-title" />
        <span className="dashboard-home-shimmer analytics-dashboard__skel-group-meta" />
        <div className="analytics-dashboard__grid">{chartCards(0)}</div>
      </section>
      <section className="analytics-dashboard__group" aria-hidden>
        <span className="dashboard-home-shimmer analytics-dashboard__skel-group-title" />
        <span className="dashboard-home-shimmer analytics-dashboard__skel-group-meta" />
        <div className="analytics-dashboard__grid">{chartCards(2)}</div>
      </section>
    </div>
  );
}

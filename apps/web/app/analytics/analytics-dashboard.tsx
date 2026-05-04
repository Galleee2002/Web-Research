"use client";

import { ChartColumn } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";

import type { BusinessRead, LeadStatus, OpportunityRead } from "@shared/index";
import { MAX_PAGE_SIZE } from "@shared/index";
import { fetchBusinessesPage } from "@/lib/api/businesses-client";
import { fetchOpportunities } from "@/lib/api/opportunities-client";

type PieDatum = { name: string; value: number; fill: string };

const SLICE_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
];

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  contacted: "Contacted",
  discarded: "Discarded",
};

/** Pie slice fills — CSS vars defined on `.analytics-dashboard` (see globals.scss). */
const LEAD_STATUS_FILL: Record<LeadStatus, string> = {
  new: "var(--analytics-status-new-fill)",
  reviewed: "var(--analytics-status-reviewed-fill)",
  contacted: "var(--analytics-status-contacted-fill)",
  discarded: "var(--analytics-status-discarded-fill)",
};

function assignColors(entries: { name: string; value: number }[]): PieDatum[] {
  return entries.map((row, i) => ({
    ...row,
    fill: SLICE_COLORS[i % SLICE_COLORS.length]!,
  }));
}

function aggregateWebsite(businesses: BusinessRead[]): PieDatum[] {
  let withSite = 0;
  let without = 0;
  for (const b of businesses) {
    if (b.has_website) withSite += 1;
    else without += 1;
  }
  return [
    {
      name: "With website",
      value: withSite,
      fill: "var(--analytics-web-yes-fill)",
    },
    {
      name: "No website",
      value: without,
      fill: "var(--analytics-web-no-fill)",
    },
  ].filter((d) => d.value > 0);
}

function aggregateLeadStatus<T extends { status: LeadStatus }>(rows: T[]): PieDatum[] {
  const counts = new Map<LeadStatus, number>();
  for (const s of rows) {
    counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
  }
  const entries = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({
      name: LEAD_STATUS_LABEL[status],
      value,
      fill: LEAD_STATUS_FILL[status],
    }))
    .sort((a, b) => b.value - a.value);
  return entries;
}

function aggregateCategories(opportunities: OpportunityRead[]): PieDatum[] {
  const counts = new Map<string, number>();
  for (const o of opportunities) {
    const key = o.category?.trim() ? o.category : "Uncategorized";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entries = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  return assignColors(entries);
}

async function fetchAllBusinesses(): Promise<BusinessRead[]> {
  const pageSize = MAX_PAGE_SIZE;
  const acc: BusinessRead[] = [];
  let page = 1;
  for (;;) {
    const res = await fetchBusinessesPage({ page, page_size: pageSize }, { cache: "no-store" });
    acc.push(...res.items);
    if (acc.length >= res.total || res.items.length === 0) break;
    page += 1;
  }
  return acc;
}

async function fetchAllOpportunities(): Promise<OpportunityRead[]> {
  const pageSize = MAX_PAGE_SIZE;
  const acc: OpportunityRead[] = [];
  let page = 1;
  for (;;) {
    const res = await fetchOpportunities({ page, page_size: pageSize }, { cache: "no-store" });
    acc.push(...res.items);
    if (acc.length >= res.total || res.items.length === 0) break;
    page += 1;
  }
  return acc;
}

type LoadState = "idle" | "loading" | "ready" | "error";

function DonutChartCard({
  title,
  data,
  emptyHint,
}: {
  title: string;
  data: PieDatum[];
  emptyHint: string;
}) {
  const chartData = useMemo(() => data.filter((d) => d.value > 0), [data]);

  if (chartData.length === 0) {
    return (
      <div className="analytics-dashboard__chart-card">
        <h3 className="analytics-dashboard__chart-title">{title}</h3>
        <p className="analytics-dashboard__chart-empty">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard__chart-card">
      <h3 className="analytics-dashboard__chart-title">{title}</h3>
      <div className="analytics-dashboard__chart-surface">
        <div className="analytics-dashboard__chart-surface-inner">
          <PieChart responsive style={{ width: "100%", height: "100%" }}>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="92%"
              paddingAngle={5}
              cornerRadius="45%"
              stroke="none"
              isAnimationActive
            >
              {chartData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--surface-01)",
                border: "1px solid var(--border-soft)",
                borderRadius: "10px",
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-primary)" }}
            />
            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ paddingTop: "0.5rem", fontSize: "0.85rem" }}
              formatter={(value) => (
                <span className="analytics-dashboard__legend-label" title={value}>
                  {value.length > 36 ? `${value.slice(0, 34)}…` : value}
                </span>
              )}
            />
          </PieChart>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [businesses, setBusinesses] = useState<BusinessRead[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRead[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      const [b, o] = await Promise.all([fetchAllBusinesses(), fetchAllOpportunities()]);
      setBusinesses(b);
      setOpportunities(o);
      setLoadState("ready");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Could not load analytics.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const businessWebsiteData = useMemo(() => aggregateWebsite(businesses), [businesses]);
  const businessStatusData = useMemo(() => aggregateLeadStatus(businesses), [businesses]);
  const opportunityCategoryData = useMemo(
    () => aggregateCategories(opportunities),
    [opportunities],
  );
  const opportunityStatusData = useMemo(() => aggregateLeadStatus(opportunities), [opportunities]);

  const isEmptyDataset = businesses.length === 0 && opportunities.length === 0;

  return (
    <section className="dashboard-content analytics-dashboard" aria-labelledby="analytics-title">
      <header className="dashboard-content__header">
        <h2 id="analytics-title">Analytics</h2>
      </header>

      {loadState === "loading" ? (
        <div className="dashboard-empty-state" role="status" aria-live="polite">
          <div className="dashboard-empty-state__content">
            <ChartColumn className="dashboard-empty-state__icon" aria-hidden />
            <p className="dashboard-empty-state__title">Loading charts…</p>
          </div>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="dashboard-empty-state" role="alert">
          <div className="dashboard-empty-state__content">
            <p className="dashboard-empty-state__title">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {loadState === "ready" && isEmptyDataset ? (
        <div className="dashboard-empty-state" role="status" aria-live="polite">
          <div className="dashboard-empty-state__content">
            <ChartColumn className="dashboard-empty-state__icon" aria-hidden />
            <p className="dashboard-empty-state__title">No analytics available yet.</p>
          </div>
        </div>
      ) : null}

      {loadState === "ready" && !isEmptyDataset ? (
        <div className="analytics-dashboard__body">
          <section className="analytics-dashboard__group" aria-labelledby="analytics-businesses">
            <h3 id="analytics-businesses" className="analytics-dashboard__group-title">
              Businesses
            </h3>
            <p className="analytics-dashboard__group-meta">
              {businesses.length} total{businesses.length !== 1 ? " businesses" : " business"}
            </p>
            <div className="analytics-dashboard__grid">
              <DonutChartCard
                title="Website presence"
                data={businessWebsiteData}
                emptyHint="No businesses to chart yet."
              />
              <DonutChartCard
                title="Status"
                data={businessStatusData}
                emptyHint="No businesses to chart yet."
              />
            </div>
          </section>

          <section className="analytics-dashboard__group" aria-labelledby="analytics-opportunities">
            <h3 id="analytics-opportunities" className="analytics-dashboard__group-title">
              Opportunities
            </h3>
            <p className="analytics-dashboard__group-meta">
              {opportunities.length} total
              {opportunities.length !== 1 ? " opportunities" : " opportunity"}
            </p>
            <div className="analytics-dashboard__grid">
              <DonutChartCard
                title="Categories"
                data={opportunityCategoryData}
                emptyHint="No opportunities to chart yet."
              />
              <DonutChartCard
                title="Status"
                data={opportunityStatusData}
                emptyHint="No opportunities to chart yet."
              />
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

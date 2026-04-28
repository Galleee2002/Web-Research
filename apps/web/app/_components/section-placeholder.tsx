import type { ComponentType } from "react";
import {
  BriefcaseBusiness,
  ChartColumn,
  FolderOpen,
  LayoutDashboard,
  ScanSearch,
  Settings
} from "lucide-react";

export type SectionKey =
  | "dashboard"
  | "businesses"
  | "opportunities"
  | "scans"
  | "analytics"
  | "settings";

type SectionContent = {
  title: string;
  message: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const sectionContent: Record<SectionKey, SectionContent> = {
  dashboard: {
    title: "Dashboard",
    message: "No dashboard data available yet.",
    icon: LayoutDashboard
  },
  businesses: {
    title: "Businesses",
    message: "No businesses available yet.",
    icon: BriefcaseBusiness
  },
  opportunities: {
    title: "Opportunities",
    message: "No opportunities available yet.",
    icon: FolderOpen
  },
  scans: {
    title: "Scans",
    message: "No scans available yet.",
    icon: ScanSearch
  },
  analytics: {
    title: "Analytics",
    message: "No analytics available yet.",
    icon: ChartColumn
  },
  settings: {
    title: "Settings",
    message: "No settings available yet.",
    icon: Settings
  }
};

type SectionPlaceholderProps = {
  section: SectionKey;
};

export function SectionPlaceholder({ section }: SectionPlaceholderProps) {
  const content = sectionContent[section];
  const Icon = content.icon;

  return (
    <section className="dashboard-content" aria-labelledby="section-title">
      <header className="dashboard-content__header">
        <h2 id="section-title">{content.title}</h2>
      </header>
      <div className="dashboard-empty-state" role="status" aria-live="polite">
        <div className="dashboard-empty-state__content">
          <Icon className="dashboard-empty-state__icon" aria-hidden />
          <p className="dashboard-empty-state__title">{content.message}</p>
        </div>
      </div>
    </section>
  );
}

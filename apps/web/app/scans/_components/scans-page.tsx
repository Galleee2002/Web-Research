"use client";

import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Calendar,
  ChevronDown,
  Eye,
  Search,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  BusinessRead,
  PaginatedScansResponse,
  ScanListItem,
  SearchRunStatus
} from "@shared/index";
import { MAX_PAGE_SIZE } from "@shared/index";

import { fetchBusinessesPage } from "@/lib/api/businesses-client";

type ScansLoadState = "idle" | "loading" | "ready" | "error";

type ModalLoadState = "idle" | "loading" | "ready" | "error";

type OutcomeFilter = "all" | "ok" | "error";

function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  triggerClassName,
  triggerContent,
  ariaLabel,
  rootClassName
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  triggerClassName: string;
  triggerContent: ReactNode;
  ariaLabel: string;
  rootClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div
      className={["businesses-select", rootClassName].filter(Boolean).join(" ")}
      ref={rootRef}
    >
      <button
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        {triggerContent}
        <ChevronDown
          className={`businesses-select__chevron${open ? " businesses-select__chevron--open" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className="businesses-select__menu"
          role="listbox"
          aria-label={`${ariaLabel} options`}
        >
          {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                data-active={opt.value === value ? "true" : undefined}
                className="businesses-select__option"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function outcomeLabel(f: OutcomeFilter): string {
  switch (f) {
    case "all":
      return "All";
    case "ok":
      return "OK";
    case "error":
      return "Error";
    default:
      return f;
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}

function scanRunId(scan: ScanListItem): string | null {
  return scan.searchRunId ?? scan.id;
}

/** Card status: failed or any error code → Error; completed with no error → OK; else run state label. */
function scanStatusLine(scan: ScanListItem): {
  variant: "ok" | "error" | "running";
  primary: string;
} {
  const code = scan.errorCode?.trim() || null;
  if (scan.status === "failed" || code) {
    return { variant: "error", primary: "Error" };
  }
  if (scan.status === "completed") {
    return { variant: "ok", primary: "OK" };
  }
  return {
    variant: "running",
    primary: formatRunStatusLabel(scan.status)
  };
}

function formatRunStatusLabel(s: SearchRunStatus): string {
  switch (s) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "completed":
      return "OK";
    case "failed":
      return "Error";
    default:
      return s;
  }
}

function dayBoundaryIso(ymd: string, end: boolean): string {
  const parts = ymd.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return ymd;
  }
  const [y, m, d] = parts;
  const dt = end
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return dt.toISOString();
}

function matchesIdQuery(scan: ScanListItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle.length === 0) return true;
  const id = scanRunId(scan)?.toLowerCase() ?? "";
  const corr = scan.correlationId?.toLowerCase() ?? "";
  return id.includes(needle) || corr.includes(needle);
}

async function readJsonError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export function ScansPage() {
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [scansState, setScansState] = useState<ScansLoadState>("idle");
  const [scansError, setScansError] = useState<string | null>(null);

  const [idQuery, setIdQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  const [modalRunId, setModalRunId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalRows, setModalRows] = useState<BusinessRead[]>([]);
  const [modalTotal, setModalTotal] = useState(0);
  const [modalState, setModalState] = useState<ModalLoadState>("idle");
  const [modalError, setModalError] = useState<string | null>(null);

  const loadScans = useCallback(async () => {
    setScansState("loading");
    setScansError(null);
    try {
      const q = new URLSearchParams();
      q.set("page", "1");
      q.set("page_size", String(MAX_PAGE_SIZE));
      q.set("started_at_order", sortNewestFirst ? "desc" : "asc");
      if (dateFrom.trim()) q.set("from", dayBoundaryIso(dateFrom.trim(), false));
      if (dateTo.trim()) q.set("to", dayBoundaryIso(dateTo.trim(), true));
      if (outcomeFilter === "ok") q.set("status", "completed");
      if (outcomeFilter === "error") q.set("status", "failed");

      const res = await fetch(`/api/scans?${q.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await readJsonError(res));
      }
      const body = (await res.json()) as PaginatedScansResponse;
      setScans(body.items);
      setScansState("ready");
    } catch (e) {
      setScansError(e instanceof Error ? e.message : "Could not load scans.");
      setScansState("error");
    }
  }, [dateFrom, dateTo, outcomeFilter, sortNewestFirst]);

  useEffect(() => {
    void loadScans();
  }, [loadScans]);

  const visibleScans = useMemo(
    () => scans.filter((s) => matchesIdQuery(s, idQuery)),
    [scans, idQuery]
  );

  const openBusinessesModal = useCallback((scan: ScanListItem) => {
    const runId = scanRunId(scan);
    if (!runId) return;
    setModalRunId(runId);
    setModalTitle(scan.provider?.trim() || "Scan");
    setModalRows([]);
    setModalTotal(0);
    setModalState("loading");
    setModalError(null);
  }, []);

  useEffect(() => {
    if (!modalRunId) return;

    let cancelled = false;
    (async () => {
      try {
        const page = await fetchBusinessesPage({
          search_run_id: modalRunId,
          page: 1,
          page_size: MAX_PAGE_SIZE,
          order_by: "created_at"
        });
        if (cancelled) return;
        setModalRows(page.items);
        setModalTotal(page.total);
        setModalState("ready");
      } catch (e) {
        if (cancelled) return;
        setModalError(
          e instanceof Error ? e.message : "Could not load businesses for this scan."
        );
        setModalState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modalRunId]);

  useEffect(() => {
    if (!modalRunId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalRunId(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalRunId]);

  const copyText = useCallback(async (value: string) => {
    const v = value.trim();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
    } catch {
      void 0;
    }
  }, []);

  return (
    <section
      className="dashboard-content scans-page"
      aria-labelledby="scans-title"
    >
      <header className="dashboard-content__header">
        <h2 id="scans-title">Scans</h2>
      </header>

      <div className="scans-page__body">
        <div className="scans-toolbar" role="search" aria-label="Filter scans">
          <label className="scans-toolbar__search" htmlFor="scans-id-search">
            <Search className="scans-toolbar__search-icon" aria-hidden />
            <input
              id="scans-id-search"
              className="scans-toolbar__search-input"
              type="search"
              placeholder="Search by run or correlation ID"
              value={idQuery}
              onChange={(e) => setIdQuery(e.target.value)}
              autoComplete="off"
            />
          </label>

          <div className="scans-toolbar__dates">
            <div className="scans-toolbar__date-group">
              <span className="scans-toolbar__date-eyebrow">From</span>
              <div className="scans-toolbar__date-shell">
                <Calendar className="scans-toolbar__date-shell-icon" aria-hidden />
                <input
                  type="date"
                  className="scans-toolbar__date-input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="From date"
                />
              </div>
            </div>
            <div className="scans-toolbar__date-group">
              <span className="scans-toolbar__date-eyebrow">To</span>
              <div className="scans-toolbar__date-shell">
                <Calendar className="scans-toolbar__date-shell-icon" aria-hidden />
                <input
                  type="date"
                  className="scans-toolbar__date-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="To date"
                />
              </div>
            </div>
          </div>

          <div className="scans-toolbar__tail">
            <div className="scans-toolbar__outcome-wrap">
              <span className="scans-toolbar__outcome-eyebrow">Status</span>
              <SelectMenu<OutcomeFilter>
                ariaLabel="Filter by scan outcome"
                value={outcomeFilter}
                onChange={setOutcomeFilter}
                rootClassName="businesses-select--status-root scans-toolbar__outcome-select"
                triggerClassName="businesses-select__trigger businesses-select__trigger--status scans-toolbar__outcome-trigger"
                options={[
                  { value: "all", label: "All" },
                  { value: "ok", label: "OK" },
                  { value: "error", label: "Error" }
                ]}
                triggerContent={
                  <span className="businesses-select__trigger-label">
                    {outcomeLabel(outcomeFilter)}
                  </span>
                }
              />
            </div>

            <button
              type="button"
              className="scans-toolbar__sort"
              onClick={() => setSortNewestFirst((v) => !v)}
              aria-label={
                sortNewestFirst
                  ? "Sort by date: newest first. Activate to show oldest first."
                  : "Sort by date: oldest first. Activate to show newest first."
              }
              title={sortNewestFirst ? "Newest first — click for oldest first" : "Oldest first — click for newest first"}
            >
              {sortNewestFirst ? (
                <ArrowUpWideNarrow className="scans-toolbar__sort-icon" aria-hidden />
              ) : (
                <ArrowDownWideNarrow className="scans-toolbar__sort-icon" aria-hidden />
              )}
              <span className="scans-toolbar__sort-text">Date</span>
            </button>
          </div>
        </div>

        {scansState === "error" ? (
          <p className="businesses-empty" role="alert">
            {scansError}
          </p>
        ) : scansState === "loading" ? (
          <div
            className="scans-page__cards"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading scans"
          >
            <span className="visually-hidden">Loading scans…</span>
            {Array.from({ length: 3 }, (_, i) => (
              <article
                key={i}
                className="scan-card scan-card--skeleton"
                aria-hidden
              >
                <div className="scan-card__row">
                  <div className="scan-card__lead">
                    <div className="scan-card__skel scan-card__skel--title" />
                    <div className="scan-card__detail">
                      <div className="scan-card__skel scan-card__skel--label" />
                      <div className="scan-card__skel scan-card__skel--line scan-card__skel--line--run" />
                    </div>
                    <div className="scan-card__detail">
                      <div className="scan-card__skel scan-card__skel--label" />
                      <div className="scan-card__skel scan-card__skel--line scan-card__skel--line--corr" />
                    </div>
                  </div>

                  <div className="scan-card__times">
                    <div className="scan-card__time-row">
                      <div className="scan-card__skel scan-card__skel--label" />
                      <div className="scan-card__skel scan-card__skel--line scan-card__skel--line--time" />
                    </div>
                    <div className="scan-card__time-row">
                      <div className="scan-card__skel scan-card__skel--label" />
                      <div className="scan-card__skel scan-card__skel--line scan-card__skel--line--time" />
                    </div>
                  </div>

                  <div className="scan-card__status-block">
                    <div className="scan-card__skel scan-card__skel--label" />
                    <div className="scan-card__skel scan-card__skel--pill" />
                  </div>

                  <div
                    className="scan-card__details-cta scan-card__skeleton-cta"
                    aria-hidden
                  >
                    <div className="scan-card__skel scan-card__skel--eye" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : visibleScans.length === 0 ? (
          <p className="businesses-empty">
            {scans.length === 0
              ? "No scans match your filters."
              : "No scans match this ID search."}
          </p>
        ) : (
          <div className="scans-page__cards">
            {visibleScans.map((scan) => {
              const runId = scanRunId(scan);
              const providerName = scan.provider?.trim() || "—";
              const corr = scan.correlationId?.trim() || "—";
              const statusInfo = scanStatusLine(scan);
              const isErrorStatus = statusInfo.variant === "error";
              const detailsDisabled = !runId || isErrorStatus;
              return (
                <article key={scan.id} className="scan-card">
                  <div className="scan-card__row">
                    <div className="scan-card__lead">
                      <h3 className="scan-card__title">{providerName}</h3>
                      <div className="scan-card__detail">
                        <span className="scan-card__detail-label">Run ID</span>
                        <span className="scan-card__detail-value scan-card__detail-value--mono">
                          {runId ?? "—"}
                        </span>
                      </div>
                      <div className="scan-card__detail">
                        <span className="scan-card__detail-label">Correlation</span>
                        <span className="scan-card__detail-value scan-card__detail-value--mono">
                          {corr}
                        </span>
                      </div>
                    </div>

                    <div className="scan-card__times">
                      <div className="scan-card__time-row">
                        <span className="scan-card__time-label">Started</span>
                        <span className="scan-card__time-value">{formatWhen(scan.startedAt)}</span>
                      </div>
                      <div className="scan-card__time-row">
                        <span className="scan-card__time-label">Completed</span>
                        <span className="scan-card__time-value">{formatWhen(scan.completedAt)}</span>
                      </div>
                    </div>

                    <div className="scan-card__status-block">
                      <span className="scan-card__status-heading">Status</span>
                      <div className="scan-card__status-content">
                        <span
                          className={`scan-card__pill scan-card__pill--${statusInfo.variant}`}
                        >
                          {statusInfo.primary}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="businesses-icon-button scan-card__details-cta"
                      aria-label={
                        !runId
                          ? "Run id unavailable"
                          : isErrorStatus
                            ? "View details unavailable — scan failed"
                            : "View details"
                      }
                      disabled={detailsDisabled}
                      title={
                        !runId
                          ? "No run id for this scan"
                          : isErrorStatus
                            ? "Details unavailable for failed scans"
                            : undefined
                      }
                      onClick={() => openBusinessesModal(scan)}
                    >
                      <Eye className="businesses-icon-button__icon" aria-hidden />
                      <span className="scan-card__details-cta-label">View Details</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {modalRunId ? (
        <div
          className="business-modal-backdrop"
          role="presentation"
          onClick={() => setModalRunId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-businesses-title"
            aria-describedby="scan-modal-run-id"
            className="business-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="business-modal__header">
              <div className="business-modal__title-row">
                <h3 id="scan-businesses-title" className="business-modal__title">
                  Businesses — {modalTitle}
                </h3>
                <p id="scan-modal-run-id" className="scans-modal__run-id">
                  <span className="scans-modal__run-id-label">Run ID</span>
                  <span className="scans-modal__run-id-value">{modalRunId}</span>
                </p>
              </div>
              <button
                type="button"
                className="business-modal__close"
                aria-label="Close"
                onClick={() => setModalRunId(null)}
              >
                <X className="business-modal__close-icon" aria-hidden />
              </button>
            </header>
            <div className="business-modal__content">
              <p className="scans-modal-hint">
                Tap ID or name to copy. Showing up to {MAX_PAGE_SIZE} rows
                {modalState === "ready" && modalTotal > MAX_PAGE_SIZE
                  ? ` (${modalTotal} total)`
                  : null}
                .
              </p>
              {modalState === "loading" ? (
                <p className="businesses-empty">Loading businesses…</p>
              ) : modalState === "error" ? (
                <p className="businesses-empty" role="alert">
                  {modalError}
                </p>
              ) : modalRows.length === 0 ? (
                <p className="scans-modal-empty">No businesses linked to this scan.</p>
              ) : (
                <table className="scans-modal-list">
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <button
                            type="button"
                            className="scans-modal-copy scans-modal-copy--id"
                            title="Copy ID"
                            onClick={() => void copyText(row.id)}
                          >
                            {row.id}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="scans-modal-copy scans-modal-copy--name"
                            title="Copy name"
                            onClick={() => void copyText(row.name)}
                          >
                            {row.name}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

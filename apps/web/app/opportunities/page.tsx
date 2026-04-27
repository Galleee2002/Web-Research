"use client";

import { ChevronDown, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { OpportunityRead, PaginatedResponse } from "@shared/index";

type LoadState = "idle" | "loading" | "ready" | "error";

async function readResponseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.error?.message ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export default function OpportunitiesPage() {
  const [items, setItems] = useState<OpportunityRead[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusDraftById, setStatusDraftById] = useState<
    Record<string, OpportunityRead["status"]>
  >({});

  const loadOpportunities = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/opportunities", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response));
      }

      const body =
        (await response.json()) as PaginatedResponse<OpportunityRead>;
      setItems(body.items);
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load opportunities"
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadOpportunities();
  }, [loadOpportunities]);

  async function handleStatusChange(
    opportunityId: string,
    status: OpportunityRead["status"]
  ) {
    setPendingId(opportunityId);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response));
      }

      const updated = (await response.json()) as OpportunityRead;

      await loadOpportunities();
      setStatusDraftById((current) => {
        const next = { ...current };
        delete next[opportunityId];
        return next;
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update opportunity"
      );
    } finally {
      setPendingId(null);
    }
  }

  const showEmpty = loadState === "ready" && items.length === 0;

  return (
    <section
      className="dashboard-content opportunity-board"
      aria-labelledby="opportunities-title"
    >
      <header className="dashboard-content__header opportunity-board__header">
        <h2 id="opportunities-title">Opportunities</h2>
      </header>

      <div className="opportunity-board__body">
        {errorMessage ? (
          <p className="opportunity-board__feedback" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {loadState === "loading" || loadState === "idle" ? (
          <div
            className="opportunity-table"
            role="status"
            aria-live="polite"
            aria-label="Loading opportunities"
          >
            <div
              className="opportunity-table__head"
              role="rowgroup"
              aria-hidden
            >
              <div
                className="opportunity-table__row opportunity-table__row--head"
                role="row"
              >
                <span role="columnheader">Business</span>
                <span role="columnheader">Location</span>
                <span role="columnheader">Status</span>
              </div>
            </div>
            <div
              className="opportunity-table__body opportunity-table__body--skeleton"
              role="rowgroup"
              aria-hidden
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <article
                  key={index}
                  className="opportunity-table__row opportunity-table__row--skeleton"
                  role="row"
                >
                  <div className="opportunity-skeleton-lines opportunity-skeleton-lines--business">
                    <div className="opportunity-skeleton opportunity-skeleton--line opportunity-skeleton--line-lg" />
                    <div className="opportunity-skeleton opportunity-skeleton--line opportunity-skeleton--line-md" />
                    <div className="opportunity-skeleton opportunity-skeleton--line opportunity-skeleton--line-sm" />
                  </div>
                  <div className="opportunity-skeleton-lines opportunity-skeleton-lines--location">
                    <div className="opportunity-skeleton opportunity-skeleton--line opportunity-skeleton--line-md" />
                    <div className="opportunity-skeleton opportunity-skeleton--line opportunity-skeleton--line-lg" />
                  </div>
                  <div className="opportunity-skeleton opportunity-skeleton--status" />
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {loadState === "error" ? (
          <div
            className="dashboard-empty-state"
            role="status"
            aria-live="polite"
          >
            <div className="dashboard-empty-state__content">
              <p className="dashboard-empty-state__title">
                Could not load opportunities.
              </p>
            </div>
          </div>
        ) : null}

        {showEmpty ? (
          <div
            className="dashboard-empty-state"
            role="status"
            aria-live="polite"
          >
            <div className="dashboard-empty-state__content">
              <p className="dashboard-empty-state__title">
                No opportunities available yet.
              </p>
            </div>
          </div>
        ) : null}

        {loadState === "ready" && items.length > 0 ? (
          <div
            className="opportunity-table"
            role="table"
            aria-label="Opportunity list"
          >
            <div className="opportunity-table__head" role="rowgroup">
              <div
                className="opportunity-table__row opportunity-table__row--head"
                role="row"
              >
                <span role="columnheader">Business</span>
                <span role="columnheader">Location</span>
                <span role="columnheader">Status</span>
              </div>
            </div>

            <div className="opportunity-table__body" role="rowgroup">
              {items.map((opportunity) => {
                const isPending = pendingId === opportunity.id;
                const draftStatus = statusDraftById[opportunity.id];
                const displayStatus = draftStatus ?? opportunity.status;
                const hasUnsavedStatus =
                  draftStatus !== undefined &&
                  draftStatus !== opportunity.status;

                return (
                  <article
                    key={opportunity.id}
                    className="opportunity-table__row"
                    role="row"
                    aria-busy={isPending}
                  >
                    <div
                      className="opportunity-table__cell opportunity-table__cell--business"
                      role="cell"
                    >
                      <div className="opportunity-table__primary">
                        <h3>{opportunity.name}</h3>
                        <p>{opportunity.category ?? "Uncategorized"}</p>
                      </div>
                      <div className="opportunity-table__secondary">
                        <span>{opportunity.phone ?? "No phone"}</span>
                        {opportunity.maps_url ? (
                          <a
                            href={opportunity.maps_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open map
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="opportunity-table__cell" role="cell">
                      <p>{opportunity.city ?? "Unknown city"}</p>
                      <span>{opportunity.address ?? "No address"}</span>
                    </div>

                    <div className="opportunity-table__cell" role="cell">
                      <div className="opportunity-status-actions">
                        <StatusSelectMenu
                          value={displayStatus}
                          disabled={isPending}
                          ariaLabel={`Change status for ${opportunity.name}`}
                          onChange={(nextStatus) => {
                            setStatusDraftById((current) => ({
                              ...current,
                              [opportunity.id]: nextStatus,
                            }));
                          }}
                        />
                        {hasUnsavedStatus ? (
                          <button
                            type="button"
                            className="business-modal__save-notes"
                            onClick={() => {
                              void handleStatusChange(
                                opportunity.id,
                                displayStatus
                              );
                            }}
                            disabled={isPending}
                            aria-label={`Save new status for ${opportunity.name}`}
                            title={`Save new status for ${opportunity.name}`}
                          >
                            <Save
                              className="business-modal__save-notes-icon"
                              aria-hidden
                            />
                          </button>
                        ) : null}
                        {opportunity.status !== "discarded" ? (
                          <button
                            type="button"
                            className="opportunity-status-actions__discard"
                            onClick={() => {
                              void handleStatusChange(
                                opportunity.id,
                                "discarded"
                              );
                            }}
                            disabled={isPending}
                            aria-label={`Discard opportunity for ${opportunity.name}`}
                            title={`Discard opportunity for ${opportunity.name}`}
                          >
                            Discard
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatusSelectMenu({
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: OpportunityRead["status"];
  onChange: (next: OpportunityRead["status"]) => void;
  ariaLabel: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="businesses-select opportunity-status-select" ref={rootRef}>
      <button
        type="button"
        className="businesses-select__trigger businesses-select__trigger--status"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="businesses-select__trigger-label">
          <span
            className={`businesses-status-pill businesses-status-pill--${value}`}
          >
            {statusLabel(value)}
          </span>
        </span>
        <ChevronDown
          className={`businesses-select__chevron${
            open ? " businesses-select__chevron--open" : ""
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="businesses-select__menu" role="listbox">
          {(["new", "reviewed", "contacted"] as const).map((statusOption) => (
            <button
              key={statusOption}
              type="button"
              role="option"
              aria-selected={statusOption === value}
              data-active={statusOption === value ? "true" : undefined}
              className="businesses-select__option"
              onClick={() => {
                onChange(statusOption);
                setOpen(false);
              }}
            >
              {statusLabel(statusOption)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(status: OpportunityRead["status"]): string {
  switch (status) {
    case "new":
      return "New";
    case "reviewed":
      return "Reviewed";
    case "contacted":
      return "Contacted";
    case "discarded":
      return "Discarded";
    default:
      return status;
  }
}

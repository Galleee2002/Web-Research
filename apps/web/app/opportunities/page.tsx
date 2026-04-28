"use client";

import { ChevronDown, Ellipsis, FolderOpen, Save, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { OpportunityRead } from "@shared/index";
import {
  fetchOpportunities,
  patchOpportunityStatus,
} from "@/lib/api/opportunities-client";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function OpportunitiesPage() {
  const [items, setItems] = useState<OpportunityRead[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusDraftById, setStatusDraftById] = useState<
    Record<string, OpportunityRead["status"]>
  >({});
  const [discardPanelOpportunityId, setDiscardPanelOpportunityId] = useState<
    string | null
  >(null);

  const loadOpportunities = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const body = await fetchOpportunities({ cache: "no-store" });
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

  useEffect(() => {
    if (!discardPanelOpportunityId) return;
    const onDoc = (event: MouseEvent) => {
      const root = document.querySelector(
        `[data-opportunity-row="${CSS.escape(discardPanelOpportunityId)}"]`
      );
      if (root && !root.contains(event.target as Node)) {
        setDiscardPanelOpportunityId(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDiscardPanelOpportunityId(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [discardPanelOpportunityId]);

  async function handleStatusChange(
    opportunityId: string,
    status: OpportunityRead["status"]
  ) {
    setPendingId(opportunityId);
    setErrorMessage(null);

    try {
      await patchOpportunityStatus(opportunityId, status);

      await loadOpportunities();
      setDiscardPanelOpportunityId(null);
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
                <span
                  className="opportunity-table__head-overflow-spacer"
                  aria-hidden
                />
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
                  <div
                    className="opportunity-table__row-main"
                    role="presentation"
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
                    <div
                      className="opportunity-table__overflow-slot"
                      aria-hidden
                    />
                  </div>
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
              <FolderOpen
                className="dashboard-empty-state__icon"
                aria-hidden
                strokeWidth={1.5}
              />
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
                <span
                  className="opportunity-table__head-overflow-spacer"
                  aria-hidden
                />
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

                const discardPanelOpen =
                  discardPanelOpportunityId === opportunity.id;

                return (
                  <article
                    key={opportunity.id}
                    className="opportunity-table__row"
                    role="row"
                    aria-busy={isPending}
                    data-opportunity-row={opportunity.id}
                  >
                    <div
                      className="opportunity-table__row-main"
                      role="presentation"
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

                      <div
                        className="opportunity-table__cell opportunity-table__cell--status"
                        role="cell"
                      >
                        <span
                          className="opportunity-table__field-label opportunity-table__field-label--status"
                          aria-hidden
                        >
                          Status
                        </span>
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
                        </div>
                      </div>

                      {opportunity.status !== "discarded" ? (
                        <div
                          className="opportunity-table__overflow-slot"
                          role="presentation"
                        >
                          <button
                            type="button"
                            className={
                              discardPanelOpen
                                ? "opportunity-table__overflow opportunity-table__overflow--concealed"
                                : "opportunity-table__overflow"
                            }
                            aria-expanded={discardPanelOpen}
                            aria-controls={`opportunity-discard-sheet-${opportunity.id}`}
                            aria-haspopup="dialog"
                            disabled={isPending}
                            aria-label={`More actions for ${opportunity.name}`}
                            title={`More actions for ${opportunity.name}`}
                            onClick={() => {
                              setDiscardPanelOpportunityId((current) =>
                                current === opportunity.id
                                  ? null
                                  : opportunity.id
                              );
                            }}
                          >
                            <Ellipsis
                              className="opportunity-table__overflow-icon"
                              aria-hidden
                              strokeWidth={2}
                            />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {opportunity.status !== "discarded" ? (
                      <div className="opportunity-table__discard-sheet-clip">
                        <div
                          id={`opportunity-discard-sheet-${opportunity.id}`}
                          className={
                            discardPanelOpen
                              ? "opportunity-table__discard-sheet opportunity-table__discard-sheet--open"
                              : "opportunity-table__discard-sheet"
                          }
                          aria-hidden={!discardPanelOpen}
                        >
                          <button
                            type="button"
                            className="opportunity-table__discard-sheet-btn"
                            onClick={() => {
                              void handleStatusChange(
                                opportunity.id,
                                "discarded"
                              );
                            }}
                            disabled={isPending}
                            aria-label={`Remove opportunity ${opportunity.name} from the list`}
                            title={`Remove opportunity ${opportunity.name} from the list`}
                          >
                            <Trash2
                              className="opportunity-table__discard-sheet-icon"
                              aria-hidden
                              strokeWidth={2}
                            />
                            <span className="opportunity-table__discard-sheet-label">
                              Discard
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : null}
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
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuBox({
      top: r.bottom + 6,
      left: r.left,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const t = event.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const menuContent = open ? (
    <div
      ref={menuRef}
      className="businesses-select__menu opportunity-status-select__menu-portal"
      role="listbox"
      style={{
        top: menuBox.top,
        left: menuBox.left,
      }}
    >
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
  ) : null;

  return (
    <div className="businesses-select opportunity-status-select" ref={rootRef}>
      <button
        ref={triggerRef}
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

      {typeof document !== "undefined" && menuContent
        ? createPortal(menuContent, document.body)
        : null}
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

"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    let cancelled = false;

    async function loadOpportunities() {
      setLoadState("loading");
      setErrorMessage(null);

      try {
        const response = await fetch("/api/opportunities", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await readResponseError(response));
        }

        const body = (await response.json()) as PaginatedResponse<OpportunityRead>;

        if (!cancelled) {
          setItems(body.items);
          setLoadState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Could not load opportunities");
          setLoadState("error");
        }
      }
    }

    void loadOpportunities();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRatingChange(opportunityId: string, rating: number | null) {
    setPendingId(opportunityId);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response));
      }

      const updated = (await response.json()) as OpportunityRead;

      setItems((currentItems) =>
        [...currentItems]
          .map((item) => (item.id === updated.id ? updated : item))
          .sort(compareByRating),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update opportunity");
    } finally {
      setPendingId(null);
    }
  }

  const showEmpty = loadState === "ready" && items.length === 0;

  return (
    <section className="dashboard-content opportunity-board" aria-labelledby="opportunities-title">
      <header className="dashboard-content__header opportunity-board__header">
        <div>
          <p className="opportunity-board__eyebrow">Commercial Prioritization</p>
          <h2 id="opportunities-title">Opportunities</h2>
        </div>
        <div className="opportunity-board__meta">
          <span>{items.length} visible</span>
          <span>Sorted by stars</span>
        </div>
      </header>

      <div className="opportunity-board__body">
        {errorMessage ? (
          <p className="opportunity-board__feedback" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {loadState === "loading" || loadState === "idle" ? (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <div className="dashboard-empty-state__content">
              <p className="dashboard-empty-state__title">Loading opportunities...</p>
            </div>
          </div>
        ) : null}

        {loadState === "error" ? (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <div className="dashboard-empty-state__content">
              <p className="dashboard-empty-state__title">Could not load opportunities.</p>
            </div>
          </div>
        ) : null}

        {showEmpty ? (
          <div className="dashboard-empty-state" role="status" aria-live="polite">
            <div className="dashboard-empty-state__content">
              <p className="dashboard-empty-state__title">No opportunities available yet.</p>
            </div>
          </div>
        ) : null}

        {loadState === "ready" && items.length > 0 ? (
          <div className="opportunity-table" role="table" aria-label="Opportunity list">
            <div className="opportunity-table__head" role="rowgroup">
              <div className="opportunity-table__row opportunity-table__row--head" role="row">
                <span role="columnheader">Business</span>
                <span role="columnheader">Location</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Rating</span>
              </div>
            </div>

            <div className="opportunity-table__body" role="rowgroup">
              {items.map((opportunity) => {
                const isPending = pendingId === opportunity.id;

                return (
                  <article
                    key={opportunity.id}
                    className="opportunity-table__row"
                    role="row"
                    aria-busy={isPending}
                  >
                    <div className="opportunity-table__cell opportunity-table__cell--business" role="cell">
                      <div className="opportunity-table__primary">
                        <h3>{opportunity.name}</h3>
                        <p>{opportunity.category ?? "Uncategorized"}</p>
                      </div>
                      <div className="opportunity-table__secondary">
                        <span>{opportunity.phone ?? "No phone"}</span>
                        {opportunity.maps_url ? (
                          <a href={opportunity.maps_url} target="_blank" rel="noreferrer">
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
                      <span className={`opportunity-status opportunity-status--${opportunity.status}`}>
                        {opportunity.status}
                      </span>
                    </div>

                    <div className="opportunity-table__cell opportunity-table__cell--rating" role="cell">
                      <div
                        className="opportunity-rating"
                        role="radiogroup"
                        aria-label={`Set rating for ${opportunity.name}`}
                      >
                        {[1, 2, 3, 4, 5].map((value) => {
                          const isActive = (opportunity.rating ?? 0) >= value;

                          return (
                            <button
                              key={value}
                              type="button"
                              className="opportunity-rating__button"
                              onClick={() =>
                                void handleRatingChange(
                                  opportunity.id,
                                  opportunity.rating === value ? null : value,
                                )
                              }
                              disabled={isPending}
                              aria-label={
                                opportunity.rating === value
                                  ? `Clear ${value} star rating`
                                  : `Set ${value} star rating`
                              }
                              aria-checked={opportunity.rating === value}
                              role="radio"
                            >
                              <Star
                                className={`opportunity-rating__star${isActive ? " opportunity-rating__star--active" : ""}`}
                                aria-hidden
                              />
                            </button>
                          );
                        })}
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

function compareByRating(left: OpportunityRead, right: OpportunityRead): number {
  const leftRating = left.rating ?? -1;
  const rightRating = right.rating ?? -1;

  if (rightRating !== leftRating) {
    return rightRating - leftRating;
  }

  return right.created_at.localeCompare(left.created_at);
}

"use client";

import type { OpportunityRead } from "@shared/index";
import { Eye, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardWelcomeBanner } from "@/app/_components/dashboard-welcome-banner";
import { leadStatusLabel } from "@/app/shared/model/status-label";
import { fetchBusinessesPage } from "@/lib/api/businesses-client";
import { fetchOpportunities } from "@/lib/api/opportunities-client";
import { syncTodoCompleted, syncTodoCreated } from "@/lib/dashboard/todo-sync";
import type { DashboardTodoItem } from "@/lib/dashboard/todo-types";

const OPPORTUNITIES_PAGE_SIZE = 6;

function newTodoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function initialTodos(): DashboardTodoItem[] {
  return [
    {
      id: "dashboard-seed-todo-1",
      title: "Follow up on proposal",
      businessName: "Northside Bakery",
      statusLabel: leadStatusLabel("reviewed"),
      completed: false,
    },
    {
      id: "dashboard-seed-todo-2",
      title: "Send introductory email",
      businessName: "Harbor Dental",
      statusLabel: leadStatusLabel("new"),
      completed: true,
    },
    {
      id: "dashboard-seed-todo-3",
      title: "Schedule callback",
      businessName: "Elm Street Cafe",
      statusLabel: leadStatusLabel("contacted"),
      completed: true,
    },
  ];
}

type OppLoadState = "idle" | "loading" | "ready" | "error";

export function DashboardHome() {
  const [todos, setTodos] = useState<DashboardTodoItem[]>(initialTodos);
  const [nextTaskNumber, setNextTaskNumber] = useState(4);

  const [contactedTotal, setContactedTotal] = useState<number | null>(null);
  const [contactedError, setContactedError] = useState<string | null>(null);

  const [oppPage, setOppPage] = useState(1);
  const [oppLoadState, setOppLoadState] = useState<OppLoadState>("idle");
  const [oppItems, setOppItems] = useState<OpportunityRead[]>([]);
  const [oppTotal, setOppTotal] = useState(0);
  const [oppError, setOppError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContactedError(null);
    void fetchBusinessesPage(
      { status: "contacted", page: 1, page_size: 1 },
      { cache: "no-store" }
    )
      .then((body) => {
        if (!cancelled) setContactedTotal(body.total);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setContactedError(
            error instanceof Error ? error.message : "Could not load businesses count"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOppLoadState("loading");
    setOppError(null);
    void fetchOpportunities(
      { page: oppPage, page_size: OPPORTUNITIES_PAGE_SIZE },
      { cache: "no-store" }
    )
      .then((body) => {
        if (cancelled) return;
        setOppItems(body.items);
        setOppTotal(body.total);
        setOppLoadState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setOppError(
          error instanceof Error ? error.message : "Could not load opportunities"
        );
        setOppLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [oppPage]);

  const oppTotalPages = Math.max(1, Math.ceil(oppTotal / OPPORTUNITIES_PAGE_SIZE));

  useEffect(() => {
    if (oppPage > oppTotalPages && oppTotalPages >= 1 && oppLoadState === "ready") {
      setOppPage(oppTotalPages);
    }
  }, [oppLoadState, oppPage, oppTotalPages]);

  const handleToggleTodo = useCallback(async (id: string) => {
    let nextCompleted = false;
    let revertTo = false;
    let found = false;

    setTodos((prev) => {
      const current = prev.find((t) => t.id === id);
      if (!current) return prev;
      found = true;
      revertTo = current.completed;
      nextCompleted = !current.completed;
      return prev.map((t) =>
        t.id === id ? { ...t, completed: nextCompleted } : t
      );
    });

    if (!found) return;

    try {
      await syncTodoCompleted(id, nextCompleted);
    } catch {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: revertTo } : t))
      );
    }
  }, []);

  const handleAddTodo = useCallback(() => {
    const task: DashboardTodoItem = {
      id: newTodoId(),
      title: `Task ${nextTaskNumber}`,
      businessName: "Sample business",
      statusLabel: leadStatusLabel("new"),
      completed: false,
    };
    setNextTaskNumber((n) => n + 1);
    setTodos((prev) => [...prev, task]);
    void syncTodoCreated(task);
  }, [nextTaskNumber]);

  const listFeedback = useMemo(() => {
    if (contactedError && oppError) {
      return `${contactedError} · ${oppError}`;
    }
    if (contactedError) return contactedError;
    if (oppError) return oppError;
    return null;
  }, [contactedError, oppError]);

  return (
    <section className="dashboard-content dashboard-home" aria-labelledby="dashboard-title">
      <header className="dashboard-content__header dashboard-content__header--split">
        <h2 id="dashboard-title">Dashboard</h2>
        <DashboardWelcomeBanner variant="inline" />
      </header>

      <div className="dashboard-home__body">
        {listFeedback ? (
          <p className="dashboard-home-feedback" role="status">
            {listFeedback}
          </p>
        ) : null}

        <div className="dashboard-home__grid">
          <section
            className="dashboard-home-card dashboard-home__todo"
            aria-labelledby="dashboard-todo-heading"
          >
            <div className="dashboard-home-card__head">
              <h3 id="dashboard-todo-heading" className="dashboard-home-card__title">
                To Do
              </h3>
              <button
                type="button"
                className="dashboard-home-card__add"
                aria-label="Add task"
                onClick={handleAddTodo}
              >
                <Plus className="dashboard-home-card__add-icon" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
            {todos.length === 0 ? (
              <p className="dashboard-home-empty">No tasks yet. Tap + to add one.</p>
            ) : (
              <ul className="dashboard-home-list">
                {todos.map((task) => (
                  <li key={task.id}>
                    <div className="dashboard-home-task">
                      <div className="dashboard-home-task__text">
                        <p className="dashboard-home-task__title">{task.title}</p>
                        <p className="dashboard-home-task__subtitle">
                          {task.businessName ? `${task.businessName} — ` : ""}
                          {task.statusLabel}
                        </p>
                      </div>
                      <label className="dashboard-home-checkbox-wrap">
                        <input
                          type="checkbox"
                          className="dashboard-home-checkbox-native"
                          checked={task.completed}
                          onChange={() => void handleToggleTodo(task.id)}
                          aria-label={
                            task.completed
                              ? `Mark "${task.title}" as not done`
                              : `Complete "${task.title}"`
                          }
                        />
                        <span className="dashboard-home-checkbox-visual" aria-hidden>
                          <span className="dashboard-home-checkbox__dot" />
                        </span>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="dashboard-home-card dashboard-home-counter dashboard-home__counter"
            aria-labelledby="dashboard-contacted-heading"
          >
            <h3 id="dashboard-contacted-heading" className="dashboard-home-counter__label">
              Businesses contacted
            </h3>
            {contactedTotal === null && !contactedError ? (
              <div
                className="dashboard-home-skeleton dashboard-home-counter__skeleton-value"
                aria-hidden
              />
            ) : (
              <p
                className={`dashboard-home-counter__value${contactedError ? " dashboard-home-counter__value--muted" : ""}`}
                aria-live="polite"
              >
                {contactedError ? "—" : contactedTotal}
              </p>
            )}
          </section>

          <section
            className="dashboard-home-card dashboard-home__opps"
            aria-labelledby="dashboard-opps-heading"
          >
            <div className="dashboard-home-card__head">
              <h3 id="dashboard-opps-heading" className="dashboard-home-card__title">
                Opportunities
              </h3>
            </div>
            {oppLoadState === "loading" && oppItems.length === 0 ? (
              <ul className="dashboard-home-list" aria-busy="true" aria-label="Loading opportunities">
                {[0, 1, 2].map((k) => (
                  <li key={k}>
                    <div className="dashboard-home-skeleton" />
                  </li>
                ))}
              </ul>
            ) : null}

            {oppLoadState !== "loading" && oppItems.length === 0 ? (
              <p className="dashboard-home-empty">No opportunities to show.</p>
            ) : null}

            {oppItems.length > 0 ? (
              <>
                <ul className="dashboard-home-list">
                  {oppItems.map((opp) => (
                    <li key={opp.id}>
                      <Link
                        href="/opportunities"
                        className="dashboard-home-opp"
                        aria-label={`Open opportunities board for ${opp.name}`}
                      >
                        <div>
                          <p className="dashboard-home-opp__primary">{opp.name}</p>
                          <p className="dashboard-home-opp__secondary">
                            {leadStatusLabel(opp.status)} · View notes
                          </p>
                        </div>
                        <span className="dashboard-home-opp__icon" aria-hidden>
                          <Eye strokeWidth={2.25} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <nav className="dashboard-home-pagination" aria-label="Opportunities pagination">
                  <button
                    type="button"
                    className="dashboard-home-pagination__btn"
                    disabled={oppPage <= 1 || oppLoadState === "loading"}
                    onClick={() => setOppPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <p className="dashboard-home-pagination__meta">
                    Page {oppPage} of {oppTotalPages}
                  </p>
                  <button
                    type="button"
                    className="dashboard-home-pagination__btn"
                    disabled={
                      oppPage >= oppTotalPages || oppLoadState === "loading"
                    }
                    onClick={() =>
                      setOppPage((p) => (p < oppTotalPages ? p + 1 : p))
                    }
                  >
                    Next
                  </button>
                </nav>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}

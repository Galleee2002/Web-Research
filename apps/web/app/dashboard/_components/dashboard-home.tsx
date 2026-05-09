"use client";

import { MAX_PAGE_SIZE, type OpportunityRead } from "@shared/index";
import { Check, ChevronDown, Eye, Plus, X } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardWelcomeBanner } from "@/app/_components/dashboard-welcome-banner";
import { leadStatusLabel } from "@/app/shared/model/status-label";
import { fetchOpportunities } from "@/lib/api/opportunities-client";
import { syncTodoCompleted, syncTodoCreated } from "@/lib/dashboard/todo-sync";
import type { DashboardTodoItem } from "@/lib/dashboard/todo-types";

function opportunityHasNotes(opp: OpportunityRead): boolean {
  return Boolean(opp.notes?.trim());
}

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

type OppLoadState = "loading" | "ready" | "error";

type TodoLoadState = "loading" | "ready";

const TODO_SKELETON_ROWS = 3;

export function DashboardHome() {
  const [todos, setTodos] = useState<DashboardTodoItem[]>([]);
  const [todoLoadState, setTodoLoadState] = useState<TodoLoadState>("loading");

  const [oppLoadState, setOppLoadState] = useState<OppLoadState>("loading");
  const [oppItems, setOppItems] = useState<OpportunityRead[]>([]);
  const [oppError, setOppError] = useState<string | null>(null);
  const oppScrollRef = useRef<HTMLUListElement>(null);
  const [oppScrollHintVisible, setOppScrollHintVisible] = useState(false);
  const [pickBusinessForTodoId, setPickBusinessForTodoId] = useState<string | null>(
    null
  );
  const [notesModalOpportunity, setNotesModalOpportunity] =
    useState<OpportunityRead | null>(null);

  useEffect(() => {
    setTodos(initialTodos());
    setTodoLoadState("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOppLoadState("loading");
    setOppError(null);

    async function loadAllOpportunities(): Promise<void> {
      const page_size = MAX_PAGE_SIZE;
      const first = await fetchOpportunities(
        { page: 1, page_size },
        { cache: "no-store" }
      );
      if (cancelled) return;

      const merged = [...first.items];
      const totalPages = Math.max(1, Math.ceil(first.total / page_size));

      for (let p = 2; p <= totalPages; p++) {
        const body = await fetchOpportunities(
          { page: p, page_size },
          { cache: "no-store" }
        );
        if (cancelled) return;
        merged.push(...body.items);
      }

      if (cancelled) return;
      setOppItems(merged);
      setOppLoadState("ready");
    }

    void loadAllOpportunities().catch((error: unknown) => {
      if (cancelled) return;
      setOppError(
        error instanceof Error ? error.message : "Could not load opportunities"
      );
      setOppLoadState("error");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateOppScrollHint = useCallback(() => {
    const el = oppScrollRef.current;
    if (!el) {
      setOppScrollHintVisible(false);
      return;
    }
    const threshold = 8;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const hasOverflow = scrollHeight > clientHeight + threshold;
    const atBottom = scrollTop + clientHeight >= scrollHeight - threshold;
    setOppScrollHintVisible(hasOverflow && !atBottom);
  }, []);

  useEffect(() => {
    updateOppScrollHint();
  }, [oppItems, updateOppScrollHint]);

  useEffect(() => {
    const el = oppScrollRef.current;
    if (!el) return;

    updateOppScrollHint();
    el.addEventListener("scroll", updateOppScrollHint, { passive: true });

    const ro = new ResizeObserver(() => {
      updateOppScrollHint();
    });
    ro.observe(el);

    const onWinResize = () => {
      updateOppScrollHint();
    };
    window.addEventListener("resize", onWinResize, { passive: true });

    return () => {
      el.removeEventListener("scroll", updateOppScrollHint);
      ro.disconnect();
      window.removeEventListener("resize", onWinResize);
    };
  }, [updateOppScrollHint, oppItems.length]);

  useEffect(() => {
    if (!pickBusinessForTodoId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPickBusinessForTodoId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pickBusinessForTodoId]);

  useEffect(() => {
    if (!notesModalOpportunity) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotesModalOpportunity(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [notesModalOpportunity]);

  const handleToggleTodo = useCallback(async (id: string) => {
    let nextCompleted = false;
    let revertTo = false;
    let found = false;

    setTodos((prev) => {
      const current = prev.find((t) => t.id === id);
      if (!current || current.isDraft) return prev;
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
      title: "",
      businessName: null,
      statusLabel: "",
      completed: false,
      isDraft: true,
    };
    setTodos((prev) => [...prev, task]);
  }, []);

  const handleDraftTitleChange = useCallback((id: string, title: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id && t.isDraft ? { ...t, title } : t))
    );
  }, []);

  const handleSelectBusinessForTodo = useCallback(
    (todoId: string, opp: OpportunityRead) => {
      let created: DashboardTodoItem | undefined;
      setTodos((prev) =>
        prev.map((t) => {
          if (t.id !== todoId || !t.isDraft) return t;
          const title = t.title.trim() || "New task";
          created = {
            ...t,
            isDraft: false,
            title,
            businessName: opp.name,
            statusLabel: leadStatusLabel(opp.status),
          };
          return created;
        })
      );
      setPickBusinessForTodoId(null);
      if (created) {
        void syncTodoCreated(created);
      }
    },
    []
  );

  const handleDeleteCompleted = useCallback(() => {
    setTodos((prev) => prev.filter((t) => !t.completed));
  }, []);

  const cannotAddTask = useMemo(
    () =>
      todos.some(
        (t) =>
          t.isDraft &&
          (!t.title.trim() || t.businessName === null)
      ),
    [todos]
  );

  return (
    <section className="dashboard-content dashboard-home" aria-labelledby="dashboard-title">
      <header className="dashboard-content__header dashboard-content__header--split">
        <h2 id="dashboard-title">Dashboard</h2>
        <DashboardWelcomeBanner variant="inline" />
      </header>

      <div className="dashboard-home__body">
        {oppError ? (
          <p className="dashboard-home-feedback" role="status">
            {oppError}
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
                aria-label={
                  cannotAddTask
                    ? "Finish the task you're adding (title and business) before adding another"
                    : "Add task"
                }
                disabled={cannotAddTask}
                onClick={handleAddTodo}
              >
                <Plus className="dashboard-home-card__add-icon" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
            {todoLoadState === "loading" ? (
              <ul className="dashboard-home-list" aria-busy="true" aria-label="Loading tasks">
                {Array.from({ length: TODO_SKELETON_ROWS }, (_, k) => (
                  <li key={k}>
                    <div className="dashboard-home-task dashboard-home-task--skeleton">
                      <div className="dashboard-home-task__text">
                        <span className="dashboard-home-shimmer dashboard-home-shimmer--task-title" />
                        <span className="dashboard-home-shimmer dashboard-home-shimmer--task-sub" />
                      </div>
                      <span
                        className="dashboard-home-shimmer dashboard-home-shimmer--checkbox"
                        aria-hidden
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : todos.length === 0 ? (
              <p className="dashboard-home-empty">No tasks yet. Tap + to add one.</p>
            ) : (
              <>
                <ul className="dashboard-home-list">
                  {todos.map((task) =>
                    task.isDraft ? (
                      <li key={task.id}>
                        <div className="dashboard-home-task dashboard-home-task--draft">
                          <div className="dashboard-home-task__text">
                            <input
                              type="text"
                              className="dashboard-home-task__title-input"
                              placeholder="Task title"
                              value={task.title}
                              onChange={(e) =>
                                handleDraftTitleChange(task.id, e.target.value)
                              }
                              aria-label="Task title"
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              className="dashboard-home-task__select-business"
                              onClick={() => setPickBusinessForTodoId(task.id)}
                            >
                              Select Business
                            </button>
                          </div>
                          <div
                            className="dashboard-home-task__draft-slot"
                            aria-hidden
                          />
                        </div>
                      </li>
                    ) : (
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
                    )
                  )}
                </ul>
                {todos.some((t) => t.completed) ? (
                  <button
                    type="button"
                    className="dashboard-home-todo__clear-completed"
                    onClick={handleDeleteCompleted}
                  >
                    Delete completed tasks
                  </button>
                ) : null}
              </>
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
            {oppLoadState === "loading" ? (
              <div className="dashboard-home__opp-scroll-wrap">
                <ul
                  className="dashboard-home-list dashboard-home__opp-scroll"
                  aria-busy="true"
                  aria-label="Loading opportunities"
                >
                  {Array.from({ length: 6 }, (_, k) => (
                    <li key={k}>
                      <div className="dashboard-home-opp-skel">
                        <div className="dashboard-home-opp-skel__text">
                          <span className="dashboard-home-shimmer dashboard-home-shimmer--opp-primary" />
                          <span className="dashboard-home-shimmer dashboard-home-shimmer--opp-secondary" />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {oppLoadState === "ready" && oppItems.length === 0 ? (
              <p className="dashboard-home-empty">No opportunities to show.</p>
            ) : null}

            {oppItems.length > 0 ? (
              <div className="dashboard-home__opp-scroll-wrap">
                <ul
                  ref={oppScrollRef}
                  className="dashboard-home-list dashboard-home__opp-scroll"
                >
                  {oppItems.map((opp) => (
                    <li key={opp.id}>
                      <div className="dashboard-home-opp">
                        <div className="dashboard-home-opp__body">
                          <p className="dashboard-home-opp__primary">{opp.name}</p>
                          <div className="dashboard-home-opp__footer">
                            <span className="dashboard-home-opp__status">
                              {leadStatusLabel(opp.status)}
                            </span>
                            {opportunityHasNotes(opp) ? (
                              <>
                                <span className="dashboard-home-opp__sep" aria-hidden>
                                  {" "}
                                  ·{" "}
                                </span>
                                <button
                                  type="button"
                                  className="dashboard-home-opp__notes-btn"
                                  aria-label={`View notes for ${opp.name}`}
                                  onClick={() => setNotesModalOpportunity(opp)}
                                >
                                  View notes
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <Link
                          href={`/opportunities?focus=${encodeURIComponent(opp.id)}`}
                          className="dashboard-home-opp__view-link"
                          aria-label={`View ${opp.name} on the opportunities board`}
                        >
                          <Eye
                            className="dashboard-home-opp__view-icon"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
                <div
                  className={`dashboard-home__opp-scroll-hint${
                    oppScrollHintVisible ? "" : " dashboard-home__opp-scroll-hint--hidden"
                  }`}
                  aria-hidden
                >
                  <div className="dashboard-home__opp-scroll-fade" />
                  <ChevronDown
                    className="dashboard-home__opp-scroll-chevron"
                    strokeWidth={2.25}
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {pickBusinessForTodoId ? (
        <div
          className="dashboard-home-opp-picker-backdrop"
          role="presentation"
          onClick={() => setPickBusinessForTodoId(null)}
        >
          <div
            className="dashboard-home-opp-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-opp-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dashboard-home-opp-picker__header">
              <h2 id="dashboard-opp-picker-title" className="dashboard-home-opp-picker__title">
                Select Business
              </h2>
              <button
                type="button"
                className="dashboard-home-opp-picker__close"
                aria-label="Close"
                onClick={() => setPickBusinessForTodoId(null)}
              >
                <X className="dashboard-home-opp-picker__close-icon" strokeWidth={2.25} aria-hidden />
              </button>
            </header>
            <div className="dashboard-home-opp-picker__body">
              {oppLoadState === "loading" ? (
                <p className="dashboard-home-opp-picker__state">Loading opportunities…</p>
              ) : oppLoadState === "error" ? (
                <p className="dashboard-home-opp-picker__state dashboard-home-opp-picker__state--error">
                  {oppError ?? "Could not load opportunities."}
                </p>
              ) : oppItems.length === 0 ? (
                <p className="dashboard-home-opp-picker__state">No opportunities available.</p>
              ) : (
                <div className="dashboard-home-opp-picker__table-wrap">
                  <table className="dashboard-home-opp-picker__table">
                    <thead>
                      <tr>
                        <th scope="col">Business</th>
                        <th scope="col">Status</th>
                        <th scope="col">
                          <span className="visually-hidden">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {oppItems.map((opp) => (
                        <tr key={opp.id}>
                          <td className="dashboard-home-opp-picker__cell-name">{opp.name}</td>
                          <td className="dashboard-home-opp-picker__cell-status">
                            {leadStatusLabel(opp.status)}
                          </td>
                          <td className="dashboard-home-opp-picker__cell-action">
                            <button
                              type="button"
                              className="dashboard-home-opp-picker__select"
                              onClick={() => {
                                const tid = pickBusinessForTodoId;
                                if (tid) {
                                  handleSelectBusinessForTodo(tid, opp);
                                }
                              }}
                            >
                              <span className="dashboard-home-opp-picker__select-text">
                                Select
                              </span>
                              <Check
                                className="dashboard-home-opp-picker__select-icon"
                                strokeWidth={2.5}
                                aria-hidden
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {typeof document !== "undefined" && notesModalOpportunity
        ? createPortal(
            <div
              className="opportunity-notes-modal-backdrop"
              role="presentation"
              onClick={() => setNotesModalOpportunity(null)}
            >
              <div
                className="opportunity-notes-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dashboard-home-notes-modal-title"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <h3
                  id="dashboard-home-notes-modal-title"
                  className="opportunity-notes-modal__title"
                >
                  {notesModalOpportunity.name}
                </h3>
                <p className="opportunity-notes-modal__note">
                  {notesModalOpportunity.notes?.trim() ?? ""}
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}

"use client";

import {
  MAX_PAGE_SIZE,
  type DashboardTodoPriority,
  type OpportunityRead,
} from "@shared/index";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  FolderOpen,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardWelcomeBanner } from "@/app/_components/dashboard-welcome-banner";
import { leadStatusLabel } from "@/app/shared/model/status-label";
import { SelectMenu } from "@/app/shared/ui/select-menu";
import {
  createDashboardTodo,
  deleteCompletedDashboardTodos,
  fetchDashboardTodoAssignees,
  fetchDashboardTodos,
  patchDashboardTodo,
} from "@/lib/api/dashboard-todos-client";
import { fetchOpportunities } from "@/lib/api/opportunities-client";
import { syncDashboardTodo } from "@/lib/dashboard/todo-sync";
import type {
  DashboardTodoAssigneeOption,
  DashboardTodoItem,
} from "@/lib/dashboard/todo-types";
import { appToast } from "@/lib/ui/toast";

function opportunityHasNotes(opp: OpportunityRead): boolean {
  return Boolean(opp.notes?.trim());
}

function newTodoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const PRIORITY_LABEL: Record<DashboardTodoPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const DRAFT_PRIORITY_OPTIONS: {
  value: DashboardTodoPriority;
  label: string;
}[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function formatStartDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const START_DATE_PAST_ERROR = "Date must be today or later.";

const DESCRIPTION_COLLAPSE_CHAR_LIMIT = 96;

function normalizeTodoDescription(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function descriptionNeedsExpand(description: string): boolean {
  return (
    description.length > DESCRIPTION_COLLAPSE_CHAR_LIMIT ||
    description.includes("\n")
  );
}

function todayIsoDateLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isStartDateBeforeToday(isoDate: string): boolean {
  return isoDate < todayIsoDateLocal();
}

type OppLoadState = "loading" | "ready" | "error";

type TodoLoadState = "loading" | "ready" | "error";

const TODO_SKELETON_ROWS = 3;

const ASSIGNEE_UNASSIGNED = "";

type AssigneeAccent = "gael" | "manuel";

const ASSIGNEE_ACCENT_BY_NAME: Record<string, AssigneeAccent> = {
  "gael garcia": "gael",
  "manuel rodriguez garcia": "manuel",
};

function normalizeAssigneeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function getAssigneeAccent(name: string | null): AssigneeAccent | null {
  if (!name) {
    return null;
  }
  return ASSIGNEE_ACCENT_BY_NAME[normalizeAssigneeName(name)] ?? null;
}

function formatTodoBusinessLine(task: DashboardTodoItem): string | null {
  if (!task.businessName) {
    return null;
  }
  return task.businessStatusLabel
    ? `${task.businessName} — ${task.businessStatusLabel}`
    : task.businessName;
}

function DashboardHomeTaskDescription({
  task,
  disabled,
  onSaved,
}: {
  task: DashboardTodoItem;
  disabled: boolean;
  onSaved: (item: DashboardTodoItem) => void;
}) {
  const storedDescription = task.description?.trim() ?? "";
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(storedDescription);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(storedDescription);
    }
  }, [storedDescription, editing]);

  const hasDescription = storedDescription.length > 0;
  const canExpand = hasDescription && descriptionNeedsExpand(storedDescription);
  const showClamped = hasDescription && !expanded && canExpand;

  const openEditor = useCallback(() => {
    setDraft(storedDescription);
    setEditing(true);
    setExpanded(true);
  }, [storedDescription]);

  const closeEditor = useCallback(() => {
    setDraft(storedDescription);
    setEditing(false);
    if (!hasDescription) {
      setExpanded(false);
    }
  }, [hasDescription, storedDescription]);

  const handleSave = useCallback(async () => {
    const nextDescription = normalizeTodoDescription(draft);
    if (nextDescription === normalizeTodoDescription(storedDescription)) {
      closeEditor();
      return;
    }

    setSaving(true);
    try {
      const updated = await patchDashboardTodo(task.id, {
        description: nextDescription,
      });
      onSaved(updated);
      setEditing(false);
      setExpanded(
        nextDescription !== null && descriptionNeedsExpand(nextDescription)
      );
      appToast.success("Description saved.");
    } catch (error: unknown) {
      appToast.error(
        error instanceof Error ? error.message : "Could not save description"
      );
    } finally {
      setSaving(false);
    }
  }, [closeEditor, draft, onSaved, storedDescription, task.id]);

  if (editing) {
    return (
      <div className="dashboard-home-task__description">
        <label className="dashboard-home-task__description-form">
          <span className="dashboard-home-task__field-label">Description</span>
          <textarea
            className="dashboard-home-task__description-input"
            value={draft}
            rows={3}
            maxLength={500}
            placeholder="Brief notes for this task…"
            disabled={disabled || saving}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={`Description for ${task.name}`}
          />
        </label>
        <div className="dashboard-home-task__description-actions">
          <button
            type="button"
            className="dashboard-home-task__description-save"
            disabled={disabled || saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="dashboard-home-task__description-cancel"
            disabled={disabled || saving}
            onClick={closeEditor}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!hasDescription) {
    return (
      <div className="dashboard-home-task__description">
        <button
          type="button"
          className="dashboard-home-task__description-add"
          disabled={disabled}
          onClick={openEditor}
        >
          Add a brief description
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-home-task__description">
      <p
        className={[
          "dashboard-home-task__description-text",
          showClamped ? "dashboard-home-task__description-text--clamped" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {storedDescription}
      </p>
      <div className="dashboard-home-task__description-toolbar">
        {canExpand ? (
          <button
            type="button"
            className="dashboard-home-task__description-toggle"
            disabled={disabled}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
        <button
          type="button"
          className="dashboard-home-task__description-toggle"
          disabled={disabled}
          onClick={openEditor}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function DashboardHomeTaskSubtitle({ task }: { task: DashboardTodoItem }) {
  const businessLine = formatTodoBusinessLine(task);
  const assigneeAccent = getAssigneeAccent(task.assigneeName);

  if (!businessLine && !task.assigneeName) {
    return null;
  }

  return (
    <p className="dashboard-home-task__subtitle">
      {businessLine ? <span>{businessLine}</span> : null}
      {businessLine && task.assigneeName ? <span aria-hidden> · </span> : null}
      {task.assigneeName ? (
        <span
          className={[
            "dashboard-home-task__assignee",
            assigneeAccent ? `dashboard-home-task__assignee--${assigneeAccent}` : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {`Assigned to ${task.assigneeName}`}
        </span>
      ) : null}
    </p>
  );
}

function assigneeSelectValue(task: DashboardTodoItem): string {
  return task.assignedUserId ?? ASSIGNEE_UNASSIGNED;
}

export function DashboardHome() {
  const [todos, setTodos] = useState<DashboardTodoItem[]>([]);
  const [todoLoadState, setTodoLoadState] = useState<TodoLoadState>("loading");
  const [todoError, setTodoError] = useState<string | null>(null);

  const [oppLoadState, setOppLoadState] = useState<OppLoadState>("loading");
  const [oppItems, setOppItems] = useState<OpportunityRead[]>([]);
  const [oppError, setOppError] = useState<string | null>(null);
  const oppScrollRef = useRef<HTMLUListElement>(null);
  const [oppScrollHintVisible, setOppScrollHintVisible] = useState(false);
  const [pickBusinessForTodoId, setPickBusinessForTodoId] = useState<string | null>(
    null
  );
  const [assigneeOptions, setAssigneeOptions] = useState<DashboardTodoAssigneeOption[]>(
    []
  );
  const [assigneeLoadState, setAssigneeLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [notesModalOpportunity, setNotesModalOpportunity] =
    useState<OpportunityRead | null>(null);
  const [syncingTodoIds, setSyncingTodoIds] = useState<Set<string>>(() => new Set());
  const [isDeletingCompleted, setIsDeletingCompleted] = useState(false);
  const [draftStartDateErrors, setDraftStartDateErrors] = useState<
    Record<string, string>
  >({});

  const todosRef = useRef(todos);
  todosRef.current = todos;
  const pendingTodoSyncsRef = useRef(new Map<string, Promise<void>>());
  const todosFetchGenerationRef = useRef(0);

  const mergeServerTodos = useCallback((items: DashboardTodoItem[]) => {
    setTodos((prev) => {
      const drafts = prev.filter((t) => t.isDraft);
      return [...items, ...drafts];
    });
  }, []);

  const refreshTodosFromServer = useCallback(async () => {
    const generation = ++todosFetchGenerationRef.current;
    const items = await fetchDashboardTodos({ cache: "no-store" });
    if (generation !== todosFetchGenerationRef.current) {
      return;
    }
    mergeServerTodos(items);
  }, [mergeServerTodos]);

  useEffect(() => {
    let cancelled = false;
    setTodoLoadState("loading");
    setTodoError(null);

    void fetchDashboardTodos({ cache: "no-store" })
      .then((items) => {
        if (cancelled) return;
        setTodos(items);
        setTodoLoadState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setTodoError(
          error instanceof Error ? error.message : "Could not load tasks"
        );
        setTodos([]);
        setTodoLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAssigneeLoadState("loading");

    void fetchDashboardTodoAssignees({ cache: "no-store" })
      .then((items) => {
        if (cancelled) return;
        setAssigneeOptions(items);
        setAssigneeLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setAssigneeOptions([]);
        setAssigneeLoadState("error");
      });

    return () => {
      cancelled = true;
    };
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
    if (!pickBusinessForTodoId) return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
    };

    const scrollbarGap = window.innerWidth - html.clientWidth;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.paddingRight = prev.bodyPaddingRight;
      window.scrollTo(0, scrollY);
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

  const handleToggleTodo = useCallback(
    async (id: string) => {
      const current = todosRef.current.find((t) => t.id === id);
      if (!current || current.isDraft) {
        return;
      }

      const revertTo = current.status;
      const nextStatus =
        current.status === "completed" ? "pending" : "completed";

      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
      );

      setSyncingTodoIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      const syncPromise = (async () => {
        try {
          await syncDashboardTodo(id, { status: nextStatus });
          await refreshTodosFromServer();
          if (nextStatus === "completed") {
            appToast.success("Task marked as completed.");
          }
        } catch {
          setTodos((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: revertTo } : t))
          );
          appToast.error("Could not update task.");
        } finally {
          pendingTodoSyncsRef.current.delete(id);
          setSyncingTodoIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      })();

      pendingTodoSyncsRef.current.set(id, syncPromise);
    },
    [refreshTodosFromServer]
  );

  const clearDraftStartDateError = useCallback((id: string) => {
    setDraftStartDateErrors((prev) => {
      if (!prev[id]) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleTodoDescriptionSaved = useCallback((item: DashboardTodoItem) => {
    setTodos((prev) => prev.map((t) => (t.id === item.id ? item : t)));
  }, []);

  const handleAddTodo = useCallback(() => {
    const task: DashboardTodoItem = {
      id: newTodoId(),
      name: "",
      description: null,
      businessId: null,
      businessName: null,
      businessStatusLabel: "",
      assignedUserId: null,
      assigneeName: null,
      status: "pending",
      startDate: null,
      priority: "medium",
      isDraft: true,
    };
    setTodos((prev) => [...prev, task]);
  }, []);

  const handleDraftNameChange = useCallback((id: string, name: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id && t.isDraft ? { ...t, name } : t))
    );
  }, []);

  const handleDraftDescriptionChange = useCallback((id: string, value: string) => {
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id && t.isDraft
          ? { ...t, description: value.length > 0 ? value : null }
          : t
      )
    );
  }, []);

  const handleDraftPriorityChange = useCallback(
    (id: string, priority: DashboardTodoPriority) => {
      setTodos((prev) =>
        prev.map((t) => (t.id === id && t.isDraft ? { ...t, priority } : t))
      );
    },
    []
  );

  const handleDraftStartDateChange = useCallback(
    (id: string, value: string) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        clearDraftStartDateError(id);
        setTodos((prev) =>
          prev.map((t) => (t.id === id && t.isDraft ? { ...t, startDate: null } : t))
        );
        return;
      }
      if (isStartDateBeforeToday(trimmed)) {
        setDraftStartDateErrors((prev) => ({
          ...prev,
          [id]: START_DATE_PAST_ERROR,
        }));
        return;
      }
      clearDraftStartDateError(id);
      setTodos((prev) =>
        prev.map((t) => (t.id === id && t.isDraft ? { ...t, startDate: trimmed } : t))
      );
    },
    [clearDraftStartDateError]
  );

  const handleDraftAssigneeChange = useCallback(
    (id: string, assignedUserId: string) => {
      setTodos((prev) =>
        prev.map((t) => {
          if (t.id !== id || !t.isDraft) {
            return t;
          }
          if (assignedUserId === ASSIGNEE_UNASSIGNED) {
            return { ...t, assignedUserId: null, assigneeName: null };
          }
          const assignee = assigneeOptions.find((option) => option.id === assignedUserId);
          return {
            ...t,
            assignedUserId,
            assigneeName: assignee?.label ?? null,
          };
        })
      );
    },
    [assigneeOptions]
  );

  const handlePickBusinessForDraft = useCallback(
    (todoId: string, opp: OpportunityRead) => {
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todoId && t.isDraft
            ? {
                ...t,
                businessId: opp.business_id,
                businessName: opp.name,
                businessStatusLabel: leadStatusLabel(opp.status),
              }
            : t
        )
      );
      setPickBusinessForTodoId(null);
    },
    []
  );

  const handleSaveDraft = useCallback(
    async (todoId: string) => {
      const draft = todos.find((t) => t.id === todoId && t.isDraft);
      if (!draft) {
        return;
      }
      const name = draft.name.trim();
      if (!name) {
        return;
      }
      if (draft.startDate && isStartDateBeforeToday(draft.startDate)) {
        setDraftStartDateErrors((prev) => ({
          ...prev,
          [todoId]: START_DATE_PAST_ERROR,
        }));
        return;
      }

      setTodoError(null);
      try {
        const created = await createDashboardTodo({
          name,
          description: draft.description,
          business_id: draft.businessId,
          assigned_user_id: draft.assignedUserId,
          priority: draft.priority,
          start_date: draft.startDate,
        });
        clearDraftStartDateError(todoId);
        setTodos((prev) =>
          prev.map((t) => (t.id === todoId && t.isDraft ? created : t))
        );
        appToast.success("Task created.");
      } catch (error: unknown) {
        setTodoError(
          error instanceof Error ? error.message : "Could not save task"
        );
        appToast.error(
          error instanceof Error ? error.message : "Could not save task"
        );
      }
    },
    [clearDraftStartDateError, todos]
  );

  const handleSelectBusinessForTodo = useCallback(
    (todoId: string, opp: OpportunityRead) => {
      handlePickBusinessForDraft(todoId, opp);
    },
    [handlePickBusinessForDraft]
  );

  const handleDeleteCompleted = useCallback(async () => {
    setTodoError(null);
    setIsDeletingCompleted(true);
    const generation = ++todosFetchGenerationRef.current;

    try {
      await Promise.all([...pendingTodoSyncsRef.current.values()]);

      setTodos((prev) =>
        prev.filter((t) => t.isDraft || t.status !== "completed")
      );

      await deleteCompletedDashboardTodos();

      if (generation !== todosFetchGenerationRef.current) {
        return;
      }

      const items = await fetchDashboardTodos({ cache: "no-store" });
      if (generation !== todosFetchGenerationRef.current) {
        return;
      }
      mergeServerTodos(items);
      appToast.success("Completed tasks deleted.");
    } catch (error: unknown) {
      setTodoError(
        error instanceof Error ? error.message : "Could not delete completed tasks"
      );
      appToast.error(
        error instanceof Error ? error.message : "Could not delete completed tasks"
      );
      if (generation === todosFetchGenerationRef.current) {
        await refreshTodosFromServer();
      }
    } finally {
      setIsDeletingCompleted(false);
    }
  }, [mergeServerTodos, refreshTodosFromServer]);

  const hasCompletedTodos = useMemo(
    () => todos.some((t) => !t.isDraft && t.status === "completed"),
    [todos]
  );

  const canDeleteCompleted =
    hasCompletedTodos && syncingTodoIds.size === 0 && !isDeletingCompleted;

  const cannotAddTask = useMemo(
    () => todoLoadState === "error" || todos.some((t) => t.isDraft),
    [todos, todoLoadState]
  );

  const draftAssigneeSelectOptions = useMemo(
    () => [
      { value: ASSIGNEE_UNASSIGNED, label: "Select person in charge" },
      ...assigneeOptions.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    ],
    [assigneeOptions]
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
        {todoError ? (
          <p className="dashboard-home-feedback" role="status">
            {todoError}
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
                  todoLoadState === "error"
                    ? "Tasks could not be loaded; try refreshing the page"
                    : cannotAddTask
                      ? "Finish or save the task you're adding before adding another"
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
                      <div className="dashboard-home-task__main">
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
            ) : todoLoadState === "error" ? (
              <p className="dashboard-home-empty" role="status">
                Could not load tasks.
              </p>
            ) : todos.length === 0 ? (
              <div
                className="dashboard-home-empty-state"
                role="status"
                aria-live="polite"
              >
                <div className="dashboard-home-empty-state__icon-wrap" aria-hidden>
                  <FolderOpen
                    className="dashboard-home-empty-state__icon"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="dashboard-home-empty-state__title">No tasks yet</p>
              </div>
            ) : (
              <>
                <ul className="dashboard-home-list">
                  {todos.map((task) =>
                    task.isDraft ? (
                      <li key={task.id}>
                        <div className="dashboard-home-task dashboard-home-task--draft">
                          <div className="dashboard-home-task__draft-inner">
                            <label className="dashboard-home-task__field dashboard-home-task__field--name">
                              <span className="dashboard-home-task__field-label">
                                Task name
                              </span>
                              <input
                                type="text"
                                className="dashboard-home-task__name-input dashboard-home-task__name-input--draft"
                                placeholder="e.g. Call back lead"
                                value={task.name}
                                onChange={(e) =>
                                  handleDraftNameChange(task.id, e.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleSaveDraft(task.id);
                                  }
                                }}
                                aria-label="Task name"
                                autoComplete="off"
                              />
                            </label>
                            <label className="dashboard-home-task__field dashboard-home-task__field--description">
                              <span className="dashboard-home-task__field-label">
                                Description
                                <span className="dashboard-home-task__field-label-hint">
                                  optional
                                </span>
                              </span>
                              <textarea
                                className="dashboard-home-task__description-input dashboard-home-task__description-input--draft"
                                rows={2}
                                maxLength={500}
                                placeholder="Brief notes for this task…"
                                value={task.description ?? ""}
                                onChange={(event) =>
                                  handleDraftDescriptionChange(
                                    task.id,
                                    event.target.value
                                  )
                                }
                                aria-label="Task description"
                              />
                            </label>
                            <div className="dashboard-home-task__draft-controls">
                              <div className="dashboard-home-task__field">
                                <span className="dashboard-home-task__field-label">
                                  Priority
                                </span>
                                <SelectMenu<DashboardTodoPriority>
                                  ariaLabel="Task priority"
                                  value={task.priority}
                                  onChange={(next) =>
                                    handleDraftPriorityChange(task.id, next)
                                  }
                                  rootClassName="dashboard-home-priority-select"
                                  triggerClassName="businesses-select__trigger"
                                  triggerContent={
                                    <span className="businesses-select__trigger-label">
                                      {PRIORITY_LABEL[task.priority]}
                                    </span>
                                  }
                                  options={DRAFT_PRIORITY_OPTIONS}
                                  menuClassName="dashboard-home-priority-select__menu"
                                />
                              </div>
                              <label className="dashboard-home-task__field">
                                <span className="dashboard-home-task__field-label">
                                  Start date
                                </span>
                                <input
                                  type="date"
                                  className="dashboard-home-task__input dashboard-home-task__input--draft"
                                  value={task.startDate ?? ""}
                                  min={todayIsoDateLocal()}
                                  aria-invalid={Boolean(draftStartDateErrors[task.id])}
                                  aria-describedby={
                                    draftStartDateErrors[task.id]
                                      ? `dashboard-todo-start-date-error-${task.id}`
                                      : undefined
                                  }
                                  onChange={(e) =>
                                    handleDraftStartDateChange(
                                      task.id,
                                      e.target.value
                                    )
                                  }
                                />
                                {draftStartDateErrors[task.id] ? (
                                  <span
                                    id={`dashboard-todo-start-date-error-${task.id}`}
                                    className="dashboard-home-task__field-error"
                                    role="alert"
                                  >
                                    {draftStartDateErrors[task.id]}
                                  </span>
                                ) : null}
                              </label>
                            </div>
                            <div className="dashboard-home-task__draft-actions">
                              <button
                                type="button"
                                className="dashboard-home-task__select-business dashboard-home-task__select-business--draft"
                                onClick={() => setPickBusinessForTodoId(task.id)}
                              >
                                {task.businessName ?? "Select Business"}
                              </button>
                              <SelectMenu
                                ariaLabel="Person in charge"
                                value={assigneeSelectValue(task)}
                                onChange={(next) =>
                                  handleDraftAssigneeChange(task.id, next)
                                }
                                rootClassName="dashboard-home-assignee-select"
                                triggerClassName="dashboard-home-task__select-assignee dashboard-home-task__select-assignee--draft"
                                triggerContent={
                                  <span className="dashboard-home-task__select-assignee-label">
                                    {task.assigneeName ?? "Select person in charge"}
                                  </span>
                                }
                                options={draftAssigneeSelectOptions}
                                menuClassName="dashboard-home-assignee-select__menu"
                                disabled={assigneeLoadState !== "ready"}
                              />
                              <button
                                type="button"
                                className="dashboard-home-task__save-draft"
                                disabled={
                                  !task.name.trim() ||
                                  Boolean(draftStartDateErrors[task.id])
                                }
                                onClick={() => void handleSaveDraft(task.id)}
                              >
                                Save task
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ) : (
                      <li key={task.id}>
                        <div className="dashboard-home-task">
                          <div className="dashboard-home-task__main">
                            <p className="dashboard-home-task__name">{task.name}</p>
                            <DashboardHomeTaskDescription
                              task={task}
                              disabled={syncingTodoIds.has(task.id)}
                              onSaved={handleTodoDescriptionSaved}
                            />
                            <DashboardHomeTaskSubtitle task={task} />
                            <div
                              className="dashboard-home-task__meta"
                              aria-live="polite"
                            >
                              <span
                                key={`status-${task.status}`}
                                className={`dashboard-home-task__badge dashboard-home-task__badge--status-${task.status}`}
                              >
                                {task.status === "completed"
                                  ? "Completed"
                                  : "Pending"}
                              </span>
                              <span
                                className={`dashboard-home-task__badge dashboard-home-task__badge--priority-${task.priority}`}
                              >
                                {`${PRIORITY_LABEL[task.priority]} priority`}
                              </span>
                              {task.startDate ? (
                                <span className="dashboard-home-task__date">
                                  <CalendarDays
                                    className="dashboard-home-task__date-icon"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                  {formatStartDate(task.startDate)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <label className="dashboard-home-checkbox-wrap">
                            <input
                              type="checkbox"
                              className="dashboard-home-checkbox-native"
                              checked={task.status === "completed"}
                              onChange={() => void handleToggleTodo(task.id)}
                              aria-label={
                                task.status === "completed"
                                  ? `Mark "${task.name}" as not done`
                                  : `Complete "${task.name}"`
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
                {hasCompletedTodos ? (
                  <button
                    type="button"
                    className="dashboard-home-todo__clear-completed"
                    disabled={!canDeleteCompleted}
                    aria-busy={isDeletingCompleted}
                    onClick={() => void handleDeleteCompleted()}
                  >
                    {isDeletingCompleted
                      ? "Deleting…"
                      : syncingTodoIds.size > 0
                        ? "Saving changes…"
                        : "Delete completed tasks"}
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
                                  ·
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
                                  void handleSelectBusinessForTodo(tid, opp);
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

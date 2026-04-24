"use client";

/**
 * Businesses list: loads data from `GET /api/businesses` (PostgreSQL via Next API).
 * Verificar BD: `/api/health` (database.reachable) y respuesta de esta lista (`total`, `items`).
 * @see docs/architecture/frontend-backend-connection.md
 */

import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ChevronDown,
  Eye,
  LaptopMinimalCheck,
  Save,
  Search,
  X
} from "lucide-react";

import type { BusinessDetailRead, BusinessRead, LeadStatus } from "@shared/index";
import { MAX_PAGE_SIZE } from "@shared/index";

import {
  BusinessesApiError,
  fetchBusinessById,
  fetchBusinessesPage,
  patchBusinessById
} from "@/lib/api/businesses-client";

type StatusFilter = LeadStatus | "all";
type WebsiteFilter = "all" | "yes" | "no";
type SortKey = "name" | "id" | "city" | "category";
type SortDir = "asc" | "desc";

type SortState = { key: SortKey; dir: SortDir };

function statusLabel(s: LeadStatus): string {
  switch (s) {
    case "new":
      return "New";
    case "reviewed":
      return "Reviewed";
    case "contacted":
      return "Contacted";
    case "discarded":
      return "Discarded";
    default:
      return s;
  }
}

function compareUuid(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function toLabelValue(value: string | null): string {
  return value && value.trim().length > 0 ? value : "—";
}

function buildMapEmbedUrl(detail: BusinessDetailRead): string | null {
  if (detail.lat !== null && detail.lng !== null) {
    return `https://www.google.com/maps?q=${detail.lat},${detail.lng}&output=embed`;
  }
  if (detail.maps_url && detail.maps_url.trim().length > 0) {
    return detail.maps_url;
  }
  return null;
}

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
  /** Optional class on the root wrapper (e.g. fixed width for toolbar layout). */
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
        <div className="businesses-select__menu" role="listbox">
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

const SEARCH_DEBOUNCE_MS = 350;

export function BusinessesPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("all");
  const [sort, setSort] = useState<SortState>({
    key: "name",
    dir: "asc"
  });

  const [items, setItems] = useState<BusinessRead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [activeBusiness, setActiveBusiness] = useState<BusinessDetailRead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [statusDraft, setStatusDraft] = useState<LeadStatus>("new");
  const [statusDirty, setStatusDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaveError, setNotesSaveError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await fetchBusinessesPage(
          {
            page: 1,
            page_size: MAX_PAGE_SIZE,
            ...(debouncedQuery !== "" ? { query: debouncedQuery } : {}),
            ...(statusFilter !== "all" ? { status: statusFilter } : {}),
            ...(websiteFilter === "yes"
              ? { has_website: true }
              : websiteFilter === "no"
                ? { has_website: false }
                : {}),
            order_by: "created_at"
          },
          { signal: controller.signal }
        );
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) {
          return;
        }
        const message =
          e instanceof BusinessesApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Could not load businesses.";
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setFetchError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedQuery, statusFilter, websiteFilter]);

  const onSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }, []);

  const displayRows = useMemo(() => {
    const rows = [...items];
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sort.key === "name") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dir;
      }
      if (sort.key === "id") {
        return compareUuid(a.id, b.id) * dir;
      }
      if (sort.key === "city") {
        const cityA = (a.city ?? "").toLowerCase();
        const cityB = (b.city ?? "").toLowerCase();
        return cityA.localeCompare(cityB, undefined, { sensitivity: "base" }) * dir;
      }
      const ca = (a.category ?? "").toLowerCase();
      const cb = (b.category ?? "").toLowerCase();
      return ca.localeCompare(cb, undefined, { sensitivity: "base" }) * dir;
    });
    return rows;
  }, [items, sort]);

  useEffect(() => {
    if (!activeBusinessId) return;
    const businessId = activeBusinessId;

    const controller = new AbortController();
    let cancelled = false;

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const data = await fetchBusinessById(businessId, {
          signal: controller.signal
        });
        if (!cancelled) {
          setActiveBusiness(data);
        }
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) {
          return;
        }
        const message =
          e instanceof BusinessesApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Could not load business detail.";
        if (!cancelled) {
          setActiveBusiness(null);
          setDetailError(message);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeBusinessId]);

  useEffect(() => {
    const next = activeBusiness?.notes ?? "";
    setNotesDraft(next);
    setNotesDirty(false);
    const nextStatus = activeBusiness?.status ?? "new";
    setStatusDraft(nextStatus);
    setStatusDirty(false);
    setNotesSaveError(null);
  }, [activeBusiness]);

  useEffect(() => {
    if (!activeBusinessId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveBusinessId(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeBusinessId]);

  const handleSaveNotes = useCallback(async () => {
    if (!activeBusiness || notesSaving || (!notesDirty && !statusDirty)) return;

    setNotesSaving(true);
    setNotesSaveError(null);
    try {
      const normalizedNotes = notesDraft.trim();
      const nextStatus: LeadStatus =
        statusDirty
          ? statusDraft
          : activeBusiness.status === "new" && normalizedNotes.length > 0
            ? "reviewed"
            : activeBusiness.status;
      const updated = await patchBusinessById(activeBusiness.id, {
        status: nextStatus,
        notes: normalizedNotes === "" ? null : notesDraft
      });
      setActiveBusiness(updated);
      setItems((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, status: updated.status } : item
        )
      );
    } catch (e) {
      const message =
        e instanceof BusinessesApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not save notes.";
      setNotesSaveError(message);
    } finally {
      setNotesSaving(false);
    }
  }, [activeBusiness, notesDirty, notesDraft, notesSaving, statusDirty, statusDraft]);

  const copyIfPresent = useCallback(async (rawValue: string | null) => {
    const value = rawValue?.trim() ?? "";
    if (value.length === 0) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      void 0;
    }
  }, []);

  const copyAndOpenWebsite = useCallback(async (rawWebsite: string | null) => {
    const website = rawWebsite?.trim() ?? "";
    if (website.length === 0) {
      return;
    }
    await copyIfPresent(website);
    window.open(website, "_blank", "noopener,noreferrer");
  }, [copyIfPresent]);

  return (
    <section
      className="dashboard-content businesses-page"
      aria-labelledby="businesses-title"
    >
      <header className="dashboard-content__header">
        <h2 id="businesses-title">Businesses</h2>
      </header>

      <div className="businesses-page__body">
        <div className="businesses-toolbar">
          <label className="businesses-search" htmlFor="businesses-search-input">
            <Search className="businesses-search__icon" aria-hidden />
            <input
              id="businesses-search-input"
              className="businesses-search__input"
              type="search"
              placeholder="Search by name (server filter)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>

          <div className="businesses-toolbar__filters">
            <SelectMenu<StatusFilter>
              ariaLabel="Filter by lead status"
              value={statusFilter}
              onChange={setStatusFilter}
              rootClassName="businesses-select--status-root"
              triggerClassName="businesses-select__trigger businesses-select__trigger--status"
              options={[
                { value: "all", label: "All" },
                { value: "new", label: "New" },
                { value: "reviewed", label: "Reviewed" },
                { value: "contacted", label: "Contacted" },
                { value: "discarded", label: "Discarded" }
              ]}
              triggerContent={
                <span className="businesses-select__trigger-label">
                  Status:{" "}
                  {statusFilter === "all"
                    ? "All"
                    : statusLabel(statusFilter as LeadStatus)}
                </span>
              }
            />

            <SelectMenu<WebsiteFilter>
              ariaLabel="Filter by website presence"
              value={websiteFilter}
              onChange={setWebsiteFilter}
              triggerClassName="businesses-select__trigger businesses-select__trigger--web"
              options={[
                { value: "all", label: "All" },
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" }
              ]}
              triggerContent={
                <span className="businesses-select__trigger-label">
                  <LaptopMinimalCheck
                    className="dashboard-nav__icon"
                    aria-hidden
                  />
                  Web:{" "}
                  {websiteFilter === "all"
                    ? "All"
                    : websiteFilter === "yes"
                      ? "Yes"
                      : "No"}
                </span>
              }
            />
          </div>
        </div>

        {fetchError ? (
          <p className="businesses-fetch-error" role="alert">
            {fetchError}
          </p>
        ) : null}

        {!fetchError && !loading && total > 0 ? (
          <p className="businesses-meta" aria-live="polite">
            {total} {total === 1 ? "business" : "businesses"} from API
            {items.length < total ? ` · ${items.length} loaded (page size cap)` : null}
          </p>
        ) : null}

        <div className="businesses-table-scroll">
          <table className="businesses-table">
            <thead>
              <tr>
                <th scope="col" className="businesses-col-id">
                  <button
                    type="button"
                    className="businesses-th-button"
                    onClick={() => onSort("id")}
                  >
                    ID
                    <ChevronDown
                      className={`businesses-th-button__chevron${
                        sort.key === "id" && sort.dir === "asc"
                          ? " businesses-th-button__chevron--asc"
                          : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                </th>
                <th scope="col" className="businesses-col-name">
                  <button
                    type="button"
                    className="businesses-th-button"
                    onClick={() => onSort("name")}
                  >
                    Name
                    <ChevronDown
                      className={`businesses-th-button__chevron${
                        sort.key === "name" && sort.dir === "asc"
                          ? " businesses-th-button__chevron--asc"
                          : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                </th>
                <th scope="col" className="businesses-col-city">
                  <button
                    type="button"
                    className="businesses-th-button"
                    onClick={() => onSort("city")}
                  >
                    City
                    <ChevronDown
                      className={`businesses-th-button__chevron${
                        sort.key === "city" && sort.dir === "asc"
                          ? " businesses-th-button__chevron--asc"
                          : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                </th>
                <th scope="col" className="businesses-col-category">
                  <button
                    type="button"
                    className="businesses-th-button"
                    onClick={() => onSort("category")}
                  >
                    Category
                    <ChevronDown
                      className={`businesses-th-button__chevron${
                        sort.key === "category" && sort.dir === "asc"
                          ? " businesses-th-button__chevron--asc"
                          : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                </th>
                <th scope="col" className="businesses-col-web">
                  Web
                </th>
                <th scope="col" className="businesses-col-status">
                  Status
                </th>
                <th scope="col" className="businesses-col-actions">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="businesses-table-skeleton" aria-hidden>
                      {Array.from({ length: 7 }).map((_, rowIndex) => (
                        <div className="businesses-table-skeleton__row" key={rowIndex}>
                          <span className="businesses-table-skeleton__cell businesses-table-skeleton__cell--id" />
                          <span className="businesses-table-skeleton__cell businesses-table-skeleton__cell--name" />
                          <span className="businesses-table-skeleton__cell businesses-table-skeleton__cell--city" />
                          <span className="businesses-table-skeleton__cell businesses-table-skeleton__cell--category" />
                          <span className="businesses-table-skeleton__cell businesses-table-skeleton__cell--web" />
                          <span className="businesses-table-skeleton__cell businesses-table-skeleton__cell--status" />
                          <span className="businesses-table-skeleton__cell businesses-table-skeleton__cell--action" />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={7}>
                    <p className="businesses-empty">Could not load data.</p>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <p className="businesses-empty">No businesses match your filters.</p>
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <tr key={row.id}>
                    {/* API uses UUID primary keys (36 chars) — truncated here for table density; full value in title */}
                    <td className="businesses-col-id" title={row.id}>
                      {row.id.slice(0, 8)}…
                    </td>
                    <td className="businesses-col-name">
                      <span className="businesses-col-name-text" title={row.name}>
                        {row.name}
                      </span>
                    </td>
                    <td className="businesses-col-city">{row.city ?? "—"}</td>
                    <td className="businesses-col-category">
                      {row.category ?? "—"}
                    </td>
                    <td className="businesses-col-web">
                      <LaptopMinimalCheck
                        className={`businesses-web-icon${
                          row.has_website
                            ? " businesses-web-icon--yes"
                            : " businesses-web-icon--no"
                        }`}
                        aria-label={
                          row.has_website ? "Has website" : "No website"
                        }
                      />
                    </td>
                    <td className="businesses-col-status">
                      <span
                        className={`businesses-status-pill businesses-status-pill--${row.status}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="businesses-col-actions">
                      <button
                        type="button"
                        className="businesses-icon-button"
                        aria-label={`View details for ${row.name}`}
                        onClick={() => {
                          setActiveBusinessId(row.id);
                          setActiveBusiness(null);
                          setDetailError(null);
                        }}
                      >
                        <Eye className="businesses-icon-button__icon" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {activeBusinessId ? (
        <div
          className="business-modal-backdrop"
          role="presentation"
          onClick={() => setActiveBusinessId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="business-detail-title"
            className="business-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="business-modal__header">
              <div className="business-modal__title-row">
                <h3 id="business-detail-title" className="business-modal__title">
                  {activeBusiness?.name ?? "Business Detail"}
                </h3>
                <span
                  className={`businesses-status-pill businesses-status-pill--${activeBusiness?.status ?? "new"}`}
                >
                  {statusLabel(activeBusiness?.status ?? "new")}
                </span>
              </div>
              <button
                type="button"
                className="business-modal__close"
                aria-label="Close business detail"
                onClick={() => setActiveBusinessId(null)}
              >
                <X className="business-modal__close-icon" aria-hidden />
              </button>
            </header>

            <div className="business-modal__content">
              <div className="business-modal__crossfade">
                <div
                  className={`business-modal__layer business-modal__layer--skeleton${
                    detailLoading ? " is-visible" : ""
                  }`}
                  aria-hidden={!detailLoading}
                >
                  <div className="business-modal-skeleton">
                    <div className="business-modal-skeleton__section">
                      <div className="business-modal-skeleton__subtitle" />
                      <div className="business-modal-skeleton__grid">
                        <div className="business-modal-skeleton__card">
                          <div className="business-modal-skeleton__label" />
                          <div className="business-modal-skeleton__line business-modal-skeleton__line--lg" />
                        </div>
                        <div className="business-modal-skeleton__card">
                          <div className="business-modal-skeleton__label" />
                          <div className="business-modal-skeleton__line business-modal-skeleton__line--sm" />
                        </div>
                      </div>
                    </div>

                    <div className="business-modal-skeleton__section">
                      <div className="business-modal-skeleton__subtitle" />
                      <div className="business-modal-skeleton__grid">
                        <div className="business-modal-skeleton__card">
                          <div className="business-modal-skeleton__label" />
                          <div className="business-modal-skeleton__line business-modal-skeleton__line--lg" />
                        </div>
                        <div className="business-modal-skeleton__card">
                          <div className="business-modal-skeleton__label" />
                          <div className="business-modal-skeleton__line business-modal-skeleton__line--md" />
                        </div>
                      </div>
                      <div className="business-modal-skeleton__map" />
                    </div>

                    <div className="business-modal-skeleton__section">
                      <div className="business-modal-skeleton__subtitle" />
                      <div className="business-modal-skeleton__grid">
                        <div className="business-modal-skeleton__card">
                          <div className="business-modal-skeleton__label" />
                          <div className="business-modal-skeleton__line business-modal-skeleton__line--sm" />
                        </div>
                        <div className="business-modal-skeleton__card">
                          <div className="business-modal-skeleton__label" />
                          <div className="business-modal-skeleton__line business-modal-skeleton__line--lg" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={`business-modal__layer business-modal__layer--body${
                    !detailLoading ? " is-visible" : ""
                  }`}
                >
                  {detailError ? (
                    <p className="business-modal__state business-modal__state--error">{detailError}</p>
                  ) : activeBusiness ? (
                    <>
                      <section className="business-modal__section">
                        <h4 className="business-modal__subtitle">Business Info</h4>
                        <div className="business-modal__grid">
                          <div className="business-modal__field">
                            <span className="business-modal__label">Category</span>
                            <span className="business-modal__value">
                              {toLabelValue(activeBusiness.category)}
                            </span>
                          </div>
                          <div className="business-modal__field">
                            <span className="business-modal__label">Has website</span>
                            <span className="business-modal__value business-modal__value--icon">
                              <LaptopMinimalCheck
                                className={`businesses-web-icon${
                                  activeBusiness.has_website
                                    ? " businesses-web-icon--yes"
                                    : " businesses-web-icon--no"
                                }`}
                                aria-hidden
                              />
                              {activeBusiness.has_website ? "Yes" : "No"}
                            </span>
                          </div>
                        </div>
                      </section>

                      <section className="business-modal__section">
                        <h4 className="business-modal__subtitle">Location</h4>
                        <div className="business-modal__grid">
                          <div
                            className="business-modal__field business-modal__field--copyable"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              void copyIfPresent(activeBusiness.address);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                void copyIfPresent(activeBusiness.address);
                              }
                            }}
                          >
                            <span className="business-modal__label">Address</span>
                            <span className="business-modal__value">
                              {toLabelValue(activeBusiness.address)}
                            </span>
                          </div>
                          <div className="business-modal__field business-modal__field--hoverable">
                            <span className="business-modal__label">City, Country - Region</span>
                            <span className="business-modal__value">
                              {[activeBusiness.city, activeBusiness.country]
                                .filter((v) => v && v.trim().length > 0)
                                .join(", ") || "—"}
                              {activeBusiness.region ? ` - ${activeBusiness.region}` : ""}
                            </span>
                          </div>
                        </div>
                        {buildMapEmbedUrl(activeBusiness) ? (
                          <div className="business-modal__map-wrap">
                            <iframe
                              src={buildMapEmbedUrl(activeBusiness) ?? undefined}
                              title={`Map location for ${activeBusiness.name}`}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              className="business-modal__map"
                            />
                          </div>
                        ) : (
                          <p className="business-modal__state">No map URL available.</p>
                        )}
                      </section>

                      <section className="business-modal__section">
                        <h4 className="business-modal__subtitle">Contact</h4>
                        <div className="business-modal__grid">
                          <div
                            className="business-modal__field business-modal__field--copyable"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              void copyIfPresent(activeBusiness.phone);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                void copyIfPresent(activeBusiness.phone);
                              }
                            }}
                          >
                            <span className="business-modal__label">Phone</span>
                            <span className="business-modal__value">
                              {toLabelValue(activeBusiness.phone)}
                            </span>
                          </div>
                          <div
                            className="business-modal__field business-modal__field--copyable"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              void copyAndOpenWebsite(activeBusiness.website);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                void copyAndOpenWebsite(activeBusiness.website);
                              }
                            }}
                          >
                            <span className="business-modal__label">Website</span>
                            <span className="business-modal__value">
                              {toLabelValue(activeBusiness.website)}
                            </span>
                          </div>
                        </div>
                      </section>

                      <section className="business-modal__section">
                        <div className="business-modal__subtitle-row">
                          <h4 className="business-modal__subtitle">Change Status Or add notes</h4>
                          <button
                            type="button"
                            className={[
                              "business-modal__save-notes",
                              !notesDirty && !statusDirty && !notesSaving
                                ? "business-modal__save-notes--placeholder"
                                : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => {
                              void handleSaveNotes();
                            }}
                            disabled={
                              notesSaving || (!notesDirty && !statusDirty)
                            }
                            aria-hidden={
                              !notesDirty && !statusDirty && !notesSaving
                                ? true
                                : undefined
                            }
                            tabIndex={
                              !notesDirty && !statusDirty && !notesSaving ? -1 : undefined
                            }
                            aria-label={
                              notesSaving
                                ? "Saving changes"
                                : "Save status and notes changes"
                            }
                            title={
                              notesSaving
                                ? "Saving changes"
                                : "Save status and notes changes"
                            }
                          >
                            <Save className="business-modal__save-notes-icon" aria-hidden />
                          </button>
                        </div>
                        <SelectMenu<LeadStatus>
                          ariaLabel="Change business status"
                          value={statusDraft}
                          onChange={(nextStatus) => {
                            setStatusDraft(nextStatus);
                            setStatusDirty(nextStatus !== activeBusiness.status);
                            setNotesSaveError(null);
                          }}
                          rootClassName="business-modal__status-select"
                          triggerClassName="businesses-select__trigger businesses-select__trigger--status"
                          options={(function () {
                            const hasNotes = (activeBusiness.notes ?? "").trim().length > 0;
                            const opts: { value: LeadStatus; label: string }[] = [];
                            if (
                              activeBusiness.status !== "new" &&
                              !(activeBusiness.status === "reviewed" && hasNotes)
                            ) {
                              opts.push({ value: "new", label: "New" });
                            }
                            opts.push({ value: "contacted", label: "Contacted" });
                            opts.push({ value: "discarded", label: "Discarded" });
                            return opts;
                          })()}
                          triggerContent={
                            <span className="businesses-select__trigger-label">
                              {statusLabel(statusDraft)}
                            </span>
                          }
                        />
                      </section>

                      <section className="business-modal__section business-modal__section--notes">
                        <textarea
                          className="business-modal__notes-input"
                          value={notesDraft}
                          onChange={(event) => {
                            const value = event.target.value;
                            setNotesDraft(value);
                            setNotesDirty(value !== (activeBusiness.notes ?? ""));
                            setNotesSaveError(null);
                          }}
                          rows={4}
                          placeholder="Add internal notes for this business…"
                        />
                        {notesSaveError ? (
                          <p className="business-modal__notes-error" role="alert">
                            {notesSaveError}
                          </p>
                        ) : null}
                      </section>
                    </>
                  ) : (
                    <p className="business-modal__state">Business detail unavailable.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

"use client";

/**
 * Businesses list: loads data from `GET /api/businesses` (PostgreSQL via Next API).
 * Verificar BD: `/api/health` (database.reachable) y respuesta de esta lista (`total`, `items`).
 * @see docs/architecture/frontend-backend-connection.md
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  ChevronDown,
  Eye,
  LaptopMinimalCheck,
  RefreshCcw,
  Save,
  Search,
  X
} from "lucide-react";

import type { BusinessDetailRead, BusinessRead, LeadStatus } from "@shared/index";
import type { SearchRead } from "@shared/index";

import {
  BusinessesApiError,
  createSearchRun,
  fetchBusinessById,
  fetchBusinessesPage,
  fetchSearchRunsByStatus,
  patchBusinessById,
  patchBusinessOpportunitySelection,
  SearchRunsApiError,
} from "@/lib/api/businesses-client";
import { leadStatusLabel } from "@/app/shared/model/status-label";
import { SelectMenu } from "@/app/shared/ui/select-menu";

type StatusFilter = LeadStatus | "all";
type WebsiteFilter = "all" | "yes" | "no";
type SortKey = "name" | "id" | "city" | "category";
type SortDir = "asc" | "desc";

type SortState = { key: SortKey; dir: SortDir };

function effectiveLeadStatus(
  business: BusinessDetailRead,
  statusDirty: boolean,
  statusDraft: LeadStatus,
): LeadStatus {
  return statusDirty ? statusDraft : business.status;
}

function isBusinessOpportunityCtaDisabled(
  business: BusinessDetailRead,
  selectionSaving: boolean,
  statusDirty: boolean,
  statusDraft: LeadStatus,
): boolean {
  if (selectionSaving) return true;
  const status = effectiveLeadStatus(business, statusDirty, statusDraft);
  if (status === "discarded") return true;
  if (
    !business.opportunity_selected &&
    status !== "new" &&
    status !== "reviewed"
  ) {
    return true;
  }
  return false;
}

function businessOpportunityCtaTitle(
  business: BusinessDetailRead,
  selectionSaving: boolean,
  statusDirty: boolean,
  statusDraft: LeadStatus,
): string | undefined {
  if (selectionSaving) return "Saving…";
  const status = effectiveLeadStatus(business, statusDirty, statusDraft);
  if (status === "discarded") {
    return "Discarded leads cannot be added to Opportunities.";
  }
  if (
    !business.opportunity_selected &&
    status !== "new" &&
    status !== "reviewed"
  ) {
    return "Only New or Reviewed leads can be added to Opportunities.";
  }
  return undefined;
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

const DEFAULT_BUSINESSES_PAGE_SIZE = 20;
const ADD_NEW_LOCATION_VALUE = "__add_new_location__";
const DEFAULT_LOCATION = "Buenos Aires, Argentina";
const FETCH_LOCATIONS_STORAGE_KEY = "businesses.fetch.locations";

export function BusinessesPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("all");
  const [sort, setSort] = useState<SortState>({
    key: "name",
    dir: "asc"
  });

  const [items, setItems] = useState<BusinessRead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchSuccess, setFetchSuccess] = useState<string | null>(null);
  const [isFetchSetupOpen, setIsFetchSetupOpen] = useState(false);
  const [isFetchConfirmOpen, setIsFetchConfirmOpen] = useState(false);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [apiRequestPending, setApiRequestPending] = useState(false);
  const [fetchQueryDraft, setFetchQueryDraft] = useState("");
  const [fetchLocations, setFetchLocations] = useState<string[]>([DEFAULT_LOCATION]);
  const [selectedFetchLocation, setSelectedFetchLocation] = useState(DEFAULT_LOCATION);
  const [newLocationDraft, setNewLocationDraft] = useState("");
  const [pendingFetchRequest, setPendingFetchRequest] = useState<{
    query: string;
    location: string;
  } | null>(null);
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
  const [selectionSaving, setSelectionSaving] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [inFlightSearchRuns, setInFlightSearchRuns] = useState(0);
  const [inFlightSearchDetails, setInFlightSearchDetails] = useState<SearchRead[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_BUSINESSES_PAGE_SIZE);
  const normalizedQuery = query.trim();
  const loadBusinessesDeps = [
    normalizedQuery,
    statusFilter,
    websiteFilter,
    currentPage,
    pageSize
  ] as const;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FETCH_LOCATIONS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0);
      const unique = Array.from(new Set([DEFAULT_LOCATION, ...normalized]));
      setFetchLocations(unique);
      if (unique.length > 0) {
        setSelectedFetchLocation(unique[0]);
      }
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FETCH_LOCATIONS_STORAGE_KEY, JSON.stringify(fetchLocations));
    } catch {
      void 0;
    }
  }, [fetchLocations]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await fetchBusinessesPage(
          {
            page: currentPage,
            page_size: pageSize,
            ...(normalizedQuery !== "" ? { query: normalizedQuery } : {}),
            ...(statusFilter !== "all" ? { status: statusFilter } : {}),
            ...(websiteFilter === "yes"
              ? { has_website: true }
              : websiteFilter === "no"
                ? { has_website: false }
                : {}),
            order_by: "created_at"
          },
          { signal: controller.signal, cache: "no-store" }
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
          setFetchError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasLoadedOnce(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, loadBusinessesDeps);

  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedQuery, statusFilter, websiteFilter]);

  useEffect(() => {
    let cancelled = false;

    const loadInFlightRuns = async () => {
      try {
        const [pendingRuns, processingRuns] = await Promise.all([
          fetchSearchRunsByStatus("pending", { cache: "no-store" }),
          fetchSearchRunsByStatus("processing", { cache: "no-store" })
        ]);
        if (!cancelled) {
          const combined = [...processingRuns, ...pendingRuns].sort((a, b) =>
            b.created_at.localeCompare(a.created_at)
          );
          setInFlightSearchRuns(combined.length);
          setInFlightSearchDetails(combined);
        }
      } catch {
        if (!cancelled) {
          setInFlightSearchRuns(0);
          setInFlightSearchDetails([]);
        }
      }
    };

    void loadInFlightRuns();
    const interval = window.setInterval(() => {
      void loadInFlightRuns();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

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
          signal: controller.signal,
          cache: "no-store"
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
    setSelectionError(null);
  }, [activeBusiness]);

  useEffect(() => {
    if (!activeBusinessId && !isFetchConfirmOpen && !isFetchSetupOpen && !isAddLocationOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isAddLocationOpen) {
          setIsAddLocationOpen(false);
          return;
        }
        if (isFetchSetupOpen) {
          setIsFetchSetupOpen(false);
          return;
        }
        if (isFetchConfirmOpen) {
          setIsFetchConfirmOpen(false);
          return;
        }
        if (activeBusinessId) {
          setActiveBusinessId(null);
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeBusinessId, isAddLocationOpen, isFetchConfirmOpen, isFetchSetupOpen]);

  const triggerBusinessesFetch = useCallback(async () => {
    if (loading || apiRequestPending || !pendingFetchRequest) return;
    setFetchError(null);
    setFetchSuccess(null);
    setApiRequestPending(true);
    try {
      await createSearchRun({
        query: pendingFetchRequest.query,
        location: pendingFetchRequest.location
      });

      const refreshed = await fetchBusinessesPage(
        {
          page: 1,
          page_size: pageSize,
          ...(normalizedQuery !== "" ? { query: normalizedQuery } : {}),
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(websiteFilter === "yes"
            ? { has_website: true }
            : websiteFilter === "no"
              ? { has_website: false }
              : {}),
          order_by: "created_at"
        },
        { cache: "no-store" }
      );
      setItems(refreshed.items);
      setTotal(refreshed.total);
      setFetchSuccess(
        `Search started for "${pendingFetchRequest.query}" in "${pendingFetchRequest.location}".`
      );
      setIsFetchConfirmOpen(false);
      setPendingFetchRequest(null);
      setFetchQueryDraft("");
    } catch (error) {
      const message =
        error instanceof SearchRunsApiError
          ? error.message
          : error instanceof BusinessesApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Could not request the next Google Places page.";
      setFetchError(message);
    } finally {
      setApiRequestPending(false);
    }
  }, [
    apiRequestPending,
    loading,
    normalizedQuery,
    pendingFetchRequest,
    pageSize,
    statusFilter,
    websiteFilter
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = total === 0 ? 0 : Math.min(currentPage * pageSize, total);

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

  const handleToggleOpportunitySelection = useCallback(async () => {
    if (!activeBusiness || selectionSaving) return;

    const status = effectiveLeadStatus(
      activeBusiness,
      statusDirty,
      statusDraft,
    );
    if (status === "discarded") return;
    if (
      !activeBusiness.opportunity_selected &&
      status !== "new" &&
      status !== "reviewed"
    ) {
      return;
    }

    setSelectionSaving(true);
    setSelectionError(null);
    const nextValue = !activeBusiness.opportunity_selected;

    try {
      const body = await patchBusinessOpportunitySelection(
        activeBusiness.id,
        nextValue
      );
      setActiveBusiness((current) =>
        current ? { ...current, opportunity_selected: body.is_selected } : current
      );
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : "Could not update opportunities selection."
      );
    } finally {
      setSelectionSaving(false);
    }
  }, [activeBusiness, selectionSaving, statusDirty, statusDraft]);

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

  const openFetchSetupModal = useCallback(() => {
    setFetchError(null);
    setFetchSuccess(null);
    setIsFetchSetupOpen(true);
  }, []);

  const handleFetchLocationChange = useCallback((value: string) => {
    if (value === ADD_NEW_LOCATION_VALUE) {
      setNewLocationDraft("");
      setIsAddLocationOpen(true);
      return;
    }
    setSelectedFetchLocation(value);
  }, []);

  const handleSaveNewLocation = useCallback(() => {
    const normalized = newLocationDraft.trim();
    if (!normalized) return;
    setFetchLocations((prev) =>
      prev.includes(normalized) ? prev : [...prev, normalized]
    );
    setSelectedFetchLocation(normalized);
    setIsAddLocationOpen(false);
    setNewLocationDraft("");
  }, [newLocationDraft]);

  const handleConfirmQuery = useCallback(() => {
    const normalizedFetchQuery = fetchQueryDraft.trim();
    const normalizedLocation = selectedFetchLocation.trim();
    if (!normalizedFetchQuery || !normalizedLocation) {
      setFetchError("Please provide both query and location before continuing.");
      return;
    }
    setFetchError(null);
    setPendingFetchRequest({
      query: normalizedFetchQuery,
      location: normalizedLocation
    });
    setIsFetchSetupOpen(false);
    setIsFetchConfirmOpen(true);
  }, [fetchQueryDraft, selectedFetchLocation]);

  return (
    <section
      className="dashboard-content businesses-page"
      aria-labelledby="businesses-title"
    >
      <header className="dashboard-content__header businesses-page__header">
        <h2 id="businesses-title">Businesses</h2>
        <button
          type="button"
          className="businesses-load-cta"
          onClick={openFetchSetupModal}
          disabled={loading || apiRequestPending}
          aria-haspopup="dialog"
          aria-controls="businesses-fetch-setup"
        >
          <RefreshCcw className="businesses-load-cta__icon" aria-hidden />
          Fetch Businesses
        </button>
      </header>

      <div className="businesses-page__body">
        <div className="businesses-toolbar">
          <label className="businesses-search" htmlFor="businesses-search-input">
            <Search className="businesses-search__icon" aria-hidden />
            <input
              id="businesses-search-input"
              className="businesses-search__input"
              type="search"
              placeholder="Search by name or ID (server filter)"
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
                    : leadStatusLabel(statusFilter as LeadStatus)}
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
        {fetchSuccess ? (
          <p className="businesses-fetch-idle" aria-live="polite">
            {fetchSuccess}
          </p>
        ) : null}
        {inFlightSearchRuns > 0 ? (
          <p className="businesses-fetch-pending-pill" aria-live="polite">
            {inFlightSearchRuns}{" "}
            {inFlightSearchRuns === 1 ? "search is" : "searches are"} currently in
            progress. Latest: "{inFlightSearchDetails[0]?.query ?? "—"}" in{" "}
            "{inFlightSearchDetails[0]?.location ?? "—"}".
          </p>
        ) : null}

        {!hasLoadedOnce ? (
          <p className="businesses-fetch-idle" aria-live="polite">
            Loading businesses from your database...
          </p>
        ) : null}

        {!fetchError && !loading && hasLoadedOnce && total > 0 ? (
          <p className="businesses-meta" aria-live="polite">
            Showing {showingStart}-{showingEnd} of {total}{" "}
            {total === 1 ? "business" : "businesses"}
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
              ) : !hasLoadedOnce ? (
                <tr>
                  <td colSpan={7}>
                    <p className="businesses-empty">
                      Loading businesses...
                    </p>
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
                        {leadStatusLabel(row.status)}
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
        {!fetchError && hasLoadedOnce && total > 0 ? (
          <footer className="businesses-pagination" aria-label="Businesses pagination">
            <p className="businesses-pagination__summary">
              Showing {showingStart}-{showingEnd} of {total}
            </p>
            <div className="businesses-pagination__controls">
              <span className="businesses-pagination__page">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="businesses-pagination__button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={loading || currentPage <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="businesses-pagination__button businesses-pagination__button--primary"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={loading || currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </footer>
        ) : null}
      </div>
      {isFetchSetupOpen ? (
        <div
          className="business-modal-backdrop"
          role="presentation"
          onClick={() => setIsFetchSetupOpen(false)}
        >
          <section
            id="businesses-fetch-setup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="businesses-fetch-setup-title"
            className="business-confirmation-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="businesses-fetch-setup-title"
              className="business-confirmation-modal__title"
            >
              Configure businesses fetch
            </h3>
            <label className="business-confirmation-modal__field" htmlFor="business-fetch-query">
              Query
            </label>
            <input
              id="business-fetch-query"
              className="business-confirmation-modal__input"
              type="text"
              placeholder="Dentists, restaurants, others..."
              value={fetchQueryDraft}
              onChange={(event) => setFetchQueryDraft(event.target.value)}
              autoComplete="off"
            />
            <label className="business-confirmation-modal__field">
              Location
            </label>
            <SelectMenu<string>
              ariaLabel="Choose fetch location"
              value={selectedFetchLocation}
              onChange={handleFetchLocationChange}
              rootClassName="business-confirmation-modal__select-root"
              triggerClassName="businesses-select__trigger business-confirmation-modal__select-trigger"
              options={[
                { value: ADD_NEW_LOCATION_VALUE, label: "Add new location" },
                ...fetchLocations.map((location) => ({
                  value: location,
                  label: location
                }))
              ]}
              triggerContent={
                <span className="businesses-select__trigger-label">
                  {selectedFetchLocation}
                </span>
              }
            />
            <div className="business-confirmation-modal__actions">
              <button
                type="button"
                className="business-confirmation-modal__button business-confirmation-modal__button--secondary"
                onClick={() => setIsFetchSetupOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="business-confirmation-modal__button business-confirmation-modal__button--primary"
                onClick={handleConfirmQuery}
              >
                Confirm query
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {isAddLocationOpen ? (
        <div
          className="business-modal-backdrop"
          role="presentation"
          onClick={() => setIsAddLocationOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="businesses-add-location-title"
            className="business-confirmation-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="businesses-add-location-title"
              className="business-confirmation-modal__title"
            >
              Add new location
            </h3>
            <input
              id="business-fetch-new-location"
              className="business-confirmation-modal__input"
              type="text"
              placeholder="Enter location"
              value={newLocationDraft}
              onChange={(event) => setNewLocationDraft(event.target.value)}
              autoComplete="off"
            />
            <div className="business-confirmation-modal__actions">
              <button
                type="button"
                className="business-confirmation-modal__button business-confirmation-modal__button--secondary"
                onClick={() => setIsAddLocationOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="business-confirmation-modal__button business-confirmation-modal__button--primary"
                onClick={handleSaveNewLocation}
              >
                Save location
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {isFetchConfirmOpen ? (
        <div
          className="business-modal-backdrop"
          role="presentation"
          onClick={() => setIsFetchConfirmOpen(false)}
        >
          <section
            id="businesses-fetch-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="businesses-fetch-confirmation-title"
            aria-describedby="businesses-fetch-confirmation-description"
            className="business-confirmation-modal"
            onClick={(event) => event.stopPropagation()}
          >
                <h3
              id="businesses-fetch-confirmation-title"
              className="business-confirmation-modal__title"
            >
              Confirm API request
            </h3>
            <p
              id="businesses-fetch-confirmation-description"
              className="business-confirmation-modal__text"
            >
              Query:{" "}
              <strong>{pendingFetchRequest?.query ?? "—"}</strong>
              <br />
              Location:{" "}
              <strong>{pendingFetchRequest?.location ?? "—"}</strong>
              <br />
              <br />
              This action requests Google Places and consumes{" "}
              <strong>1 Google Places API request</strong>.
              <br />
              It will create a new scan run and then refresh this list from your
              database.
            </p>
            <div className="business-confirmation-modal__actions">
              <button
                type="button"
                className="business-confirmation-modal__button business-confirmation-modal__button--secondary"
                onClick={() => setIsFetchConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="business-confirmation-modal__button business-confirmation-modal__button--primary"
                disabled={apiRequestPending || !pendingFetchRequest}
                onClick={() => {
                  void triggerBusinessesFetch();
                }}
              >
                {apiRequestPending ? "Requesting..." : "Confirm request"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
                  {leadStatusLabel(activeBusiness?.status ?? "new")}
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
                              {leadStatusLabel(statusDraft)}
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

                      <section className="business-modal__section business-modal__section--cta">
                        <div className="business-modal__opportunity-cta-wrap">
                          <button
                            type="button"
                            className="business-modal__opportunity-cta"
                            onClick={() => {
                              void handleToggleOpportunitySelection();
                            }}
                            disabled={isBusinessOpportunityCtaDisabled(
                              activeBusiness,
                              selectionSaving,
                              statusDirty,
                              statusDraft,
                            )}
                            title={businessOpportunityCtaTitle(
                              activeBusiness,
                              selectionSaving,
                              statusDirty,
                              statusDraft,
                            )}
                          >
                            {selectionSaving
                              ? "Saving..."
                              : activeBusiness.opportunity_selected
                                ? "Remove from Opportunities"
                                : "Add to Opportunities"}
                          </button>
                        </div>
                        {selectionError ? (
                          <p className="business-modal__notes-error" role="alert">
                            {selectionError}
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

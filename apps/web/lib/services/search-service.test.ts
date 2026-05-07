import { describe, expect, it, vi } from "vitest";

import { createNextSearchRun, createSearchRun, listSearchRuns } from "./search-service";

describe("search service", () => {
  it("delegates createSearchRun to the repository", async () => {
    const insertSearchRun = vi.fn().mockResolvedValue({ id: "search-1" });

    const result = await createSearchRun(
      { query: "dentists", location: "Buenos Aires" },
      {
        correlationId: "corr-1",
        method: "POST",
        route: "/api/search"
      },
      {
        insertSearchRun,
        findSearchRuns: vi.fn(),
        findSearchRunRecordById: vi.fn(),
        findSearchRunByParentId: vi.fn(),
        insertNextSearchRunFromParent: vi.fn()
      }
    );

    expect(insertSearchRun).toHaveBeenCalledWith(
      {
        query: "dentists",
        location: "Buenos Aires"
      },
      {
        correlationId: "corr-1",
        method: "POST",
        route: "/api/search"
      }
    );
    expect(result).toEqual({ id: "search-1" });
  });

  it("delegates listSearchRuns to the repository", async () => {
    const findSearchRuns = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20
    });

    const result = await listSearchRuns(
      {
        page: 1,
        page_size: 20
      },
      {
        correlationId: "corr-2",
        method: "GET",
        route: "/api/searches"
      },
      {
        insertSearchRun: vi.fn(),
        findSearchRuns,
        findSearchRunRecordById: vi.fn(),
        findSearchRunByParentId: vi.fn(),
        insertNextSearchRunFromParent: vi.fn()
      }
    );

    expect(findSearchRuns).toHaveBeenCalledWith(
      {
        page: 1,
        page_size: 20
      },
      {
        correlationId: "corr-2",
        method: "GET",
        route: "/api/searches"
      }
    );
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      page_size: 20
    });
  });

  it("returns existing child run for idempotent next-page calls", async () => {
    const existingChild = {
      id: "child-1",
      query: "dentists",
      location: "Buenos Aires",
      source: "google_places",
      status: "pending",
      total_found: 0,
      parent_search_run_id: "parent-1",
      page_number: 2,
      provider_next_page_available: false,
      created_at: "2026-04-28T12:00:00.000Z"
    };

    const result = await createNextSearchRun(
      "parent-1",
      {
        correlationId: "corr-3",
        method: "POST",
        route: "/api/search/[id]/next"
      },
      {
        insertSearchRun: vi.fn(),
        findSearchRuns: vi.fn(),
        findSearchRunRecordById: vi.fn().mockResolvedValue({
          id: "parent-1",
          query: "dentists",
          location: "Buenos Aires",
          source: "google_places",
          status: "completed",
          total_found: 20,
          parent_search_run_id: null,
          page_number: 1,
          provider_next_page_available: true,
          provider_page_token: null,
          provider_next_page_token: "next-token",
          created_at: "2026-04-28T11:00:00.000Z"
        }),
        findSearchRunByParentId: vi.fn().mockResolvedValue(existingChild),
        insertNextSearchRunFromParent: vi.fn()
      }
    );

    expect(result).toEqual({ searchRun: existingChild, created: false });
  });

  it("creates a child run when parent is completed and has next token", async () => {
    const insertNextSearchRunFromParent = vi.fn().mockResolvedValue({
      searchRun: { id: "child-2" },
      created: true
    });

    const result = await createNextSearchRun(
      "parent-2",
      {
        correlationId: "corr-4",
        method: "POST",
        route: "/api/search/[id]/next"
      },
      {
        insertSearchRun: vi.fn(),
        findSearchRuns: vi.fn(),
        findSearchRunRecordById: vi.fn().mockResolvedValue({
          id: "parent-2",
          query: "dentists",
          location: "Buenos Aires",
          source: "google_places",
          status: "completed",
          total_found: 20,
          parent_search_run_id: null,
          page_number: 1,
          provider_next_page_available: true,
          provider_page_token: null,
          provider_next_page_token: "next-token",
          created_at: "2026-04-28T11:00:00.000Z"
        }),
        findSearchRunByParentId: vi.fn().mockResolvedValue(null),
        insertNextSearchRunFromParent
      }
    );

    expect(insertNextSearchRunFromParent).toHaveBeenCalled();
    expect(result).toEqual({
      searchRun: { id: "child-2" },
      created: true
    });
  });

  it("throws not_found when parent run does not exist", async () => {
    await expect(
      createNextSearchRun(
        "missing",
        {
          correlationId: "corr-5",
          method: "POST",
          route: "/api/search/[id]/next"
        },
        {
          insertSearchRun: vi.fn(),
          findSearchRuns: vi.fn(),
          findSearchRunRecordById: vi.fn().mockResolvedValue(null),
          findSearchRunByParentId: vi.fn(),
          insertNextSearchRunFromParent: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("throws conflict when parent has no next token", async () => {
    await expect(
      createNextSearchRun(
        "parent-3",
        {
          correlationId: "corr-6",
          method: "POST",
          route: "/api/search/[id]/next"
        },
        {
          insertSearchRun: vi.fn(),
          findSearchRuns: vi.fn(),
          findSearchRunRecordById: vi.fn().mockResolvedValue({
            id: "parent-3",
            query: "dentists",
            location: "Buenos Aires",
            source: "google_places",
            status: "completed",
            total_found: 20,
            parent_search_run_id: null,
            page_number: 1,
            provider_next_page_available: false,
            provider_page_token: null,
            provider_next_page_token: null,
            created_at: "2026-04-28T11:00:00.000Z"
          }),
          findSearchRunByParentId: vi.fn().mockResolvedValue(null),
          insertNextSearchRunFromParent: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "conflict_error", status: 409 });
  });
});

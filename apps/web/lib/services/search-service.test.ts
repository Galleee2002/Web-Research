import { describe, expect, it, vi } from "vitest";

import { createSearchRun, listSearchRuns } from "./search-service";

describe("search service", () => {
  it("delegates createSearchRun to the repository", async () => {
    const insertSearchRun = vi.fn().mockResolvedValue({
      id: "search-1"
    });

    const result = await createSearchRun(
      { query: "dentists", location: "Buenos Aires" },
      {
        insertSearchRun,
        findSearchRuns: vi.fn()
      }
    );

    expect(insertSearchRun).toHaveBeenCalledWith({
      query: "dentists",
      location: "Buenos Aires"
    });
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
        insertSearchRun: vi.fn(),
        findSearchRuns
      }
    );

    expect(findSearchRuns).toHaveBeenCalledWith({
      page: 1,
      page_size: 20
    });
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      page_size: 20
    });
  });
});

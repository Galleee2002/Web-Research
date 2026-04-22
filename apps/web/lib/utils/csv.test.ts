import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("escapes commas, quotes, newlines, nulls, and booleans", () => {
    const csv = toCsv(
      ["name", "notes", "has_website", "website"],
      [
        {
          name: "Clinica, Centro",
          notes: "Dijo \"llamar\"\nmanana",
          has_website: false,
          website: null
        }
      ]
    );

    expect(csv).toBe(
      'name,notes,has_website,website\n"Clinica, Centro","Dijo ""llamar""\nmanana",false,'
    );
  });
});

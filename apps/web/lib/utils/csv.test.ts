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

  it("neutralizes spreadsheet formulas in exported values", () => {
    const csv = toCsv(
      ["name", "address"],
      [
        {
          name: "=IMPORTXML(\"https://example.com\")",
          address: "+541155551234"
        }
      ]
    );

    expect(csv).toBe(
      'name,address\n"\'=IMPORTXML(""https://example.com"")","\'+541155551234"'
    );
  });
});

import { describe, expect, it } from "vitest";

import { canonicalizeDedupText, fallbackDedupKey } from "./business-dedup";

describe("business dedup", () => {
  it("canonicalizes text for dedup keys", () => {
    expect(canonicalizeDedupText(" Clínica Demo ")).toBe("clinicademo");
    expect(canonicalizeDedupText("Av. Corrientes 1234")).toBe("avcorrientes1234");
  });

  it("returns null when name or address is missing", () => {
    expect(fallbackDedupKey("Clinica", null)).toBeNull();
    expect(fallbackDedupKey(" ", "Calle 1")).toBeNull();
  });

  it("builds a fallback dedup key from name and address", () => {
    expect(fallbackDedupKey("Clínica Demo", "Av. Corrientes 1234")).toEqual([
      "clinicademo",
      "avcorrientes1234",
    ]);
  });
});

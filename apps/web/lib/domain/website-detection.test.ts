import { describe, expect, it } from "vitest";

import { detectOwnWebsite } from "./website-detection";

describe("detectOwnWebsite", () => {
  it("accepts owned domains", () => {
    expect(detectOwnWebsite("https://clinicadentalcentro.example")).toEqual({
      website: "https://clinicadentalcentro.example",
      has_website: true,
    });
    expect(detectOwnWebsite("HTTP://WWW.CLINICAEXAMPLE.COM/path")).toEqual({
      website: "HTTP://WWW.CLINICAEXAMPLE.COM/path",
      has_website: true,
    });
  });

  it("rejects empty or invalid urls", () => {
    for (const rawUrl of [null, undefined, "", "   ", "not a url", "mailto:hello@example.com"]) {
      expect(detectOwnWebsite(rawUrl)).toEqual({
        website: null,
        has_website: false,
      });
    }
  });

  it("rejects social, google, and directory domains", () => {
    for (const rawUrl of [
      "https://instagram.com/clinicadentalcentro",
      "https://www.facebook.com/clinicadentalcentro",
      "https://wa.me/541112345678",
      "https://linktr.ee/clinicadentalcentro",
      "https://maps.google.com/?cid=123",
      "https://yelp.com/biz/clinica-dental-centro",
    ]) {
      expect(detectOwnWebsite(rawUrl)).toEqual({
        website: null,
        has_website: false,
      });
    }
  });
});

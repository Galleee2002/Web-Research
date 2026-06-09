import { describe, expect, it } from "vitest";

import {
  findGoogleMapsUrlInText,
  isGoogleMapsUrl,
  parseCoordsFromGoogleMapsUrl,
  partitionManualBusinessUrls,
  resolveBusinessMapEmbedUrl,
  toMapEmbedSrc
} from "./maps-url-detection";

describe("isGoogleMapsUrl", () => {
  it("recognizes Google Maps short and share links", () => {
    expect(isGoogleMapsUrl("https://maps.app.goo.gl/SHBnkegGadJ1i78q8")).toBe(true);
    expect(isGoogleMapsUrl("maps.app.goo.gl/SHBnkegGadJ1i78q8")).toBe(true);
    expect(isGoogleMapsUrl("https://maps.google.com/?cid=123")).toBe(true);
    expect(
      isGoogleMapsUrl("https://www.google.com/maps/place/Test/@-34.6,-58.4,17z")
    ).toBe(true);
  });

  it("rejects non-maps urls", () => {
    expect(isGoogleMapsUrl("https://clinicadentalcentro.example")).toBe(false);
    expect(isGoogleMapsUrl("https://instagram.com/clinicadentalcentro")).toBe(false);
    expect(isGoogleMapsUrl(null)).toBe(false);
  });
});

describe("parseCoordsFromGoogleMapsUrl", () => {
  it("extracts precise coordinates from place urls", () => {
    expect(
      parseCoordsFromGoogleMapsUrl(
        "https://www.google.com/maps/place/Test/@-34.606578,-58.389446,14z/data=!4m6!3m5!1s0x95bccac385721e6f:0x5332f025a8c999ef!8m2!3d-34.6065784!4d-58.3894461"
      )
    ).toEqual({ lat: -34.6065784, lng: -58.3894461 });
  });
});

describe("partitionManualBusinessUrls", () => {
  it("extracts maps links stored in address", () => {
    expect(
      partitionManualBusinessUrls({
        address: "https://maps.app.goo.gl/SHBnkegGadJ1i78q8",
        maps_url: null
      })
    ).toEqual({
      website: null,
      social_links: [],
      maps_url: "https://maps.app.goo.gl/SHBnkegGadJ1i78q8"
    });
  });
});

describe("toMapEmbedSrc", () => {
  it("does not return short links for iframe embed", () => {
    expect(toMapEmbedSrc("https://maps.app.goo.gl/SHBnkegGadJ1i78q8")).toBeNull();
  });

  it("builds cid embed urls", () => {
    expect(toMapEmbedSrc("https://maps.google.com/?cid=123")).toBe(
      "https://www.google.com/maps?q=cid:123&output=embed"
    );
  });

  it("builds coordinate embed urls from place links", () => {
    expect(
      toMapEmbedSrc(
        "https://www.google.com/maps/place/Test/@-34.606578,-58.389446,14z/data=!4m6!3m5!1s0x95bccac385721e6f:0x5332f025a8c999ef!8m2!3d-34.6065784!4d-58.3894461"
      )
    ).toBe("https://www.google.com/maps?q=-34.6065784,-58.3894461&output=embed");
  });
});

describe("resolveBusinessMapEmbedUrl", () => {
  it("embeds plain text addresses", () => {
    expect(
      resolveBusinessMapEmbedUrl({
        lat: null,
        lng: null,
        maps_url: "https://maps.app.goo.gl/SHBnkegGadJ1i78q8",
        website: null,
        social_links: [],
        address:
          "Tte. Gral. Juan Domingo Perón 1605, C1037 Cdad. Autónoma de Buenos Aires, Argentina"
      })
    ).toBe(
      "https://www.google.com/maps?q=Tte.%20Gral.%20Juan%20Domingo%20Per%C3%B3n%201605%2C%20C1037%20Cdad.%20Aut%C3%B3noma%20de%20Buenos%20Aires%2C%20Argentina&output=embed"
    );
  });

  it("uses coordinates when available", () => {
    expect(
      resolveBusinessMapEmbedUrl({
        lat: -34.6065784,
        lng: -58.3894461,
        maps_url: null,
        website: null,
        social_links: []
      })
    ).toBe("https://www.google.com/maps?q=-34.6065784,-58.3894461&output=embed");
  });
});

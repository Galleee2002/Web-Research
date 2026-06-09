export function normalizeHttpUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return withProtocol;
  } catch {
    return null;
  }
}

export function isGoogleMapsUrl(rawUrl: string | null | undefined): boolean {
  if (typeof rawUrl !== "string") {
    return false;
  }

  const normalized = normalizeHttpUrl(rawUrl);
  if (!normalized) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return false;
  }

  const host = parsed.hostname.replace(/\.$/, "").toLowerCase();

  if (host === "maps.app.goo.gl") {
    return true;
  }

  if (host === "goo.gl" && parsed.pathname.startsWith("/maps")) {
    return true;
  }

  if (host === "maps.google.com") {
    return true;
  }

  if (!host.endsWith("google.com")) {
    return false;
  }

  return (
    parsed.pathname.startsWith("/maps") ||
    parsed.pathname.includes("/maps/") ||
    parsed.searchParams.has("cid") ||
    (parsed.searchParams.has("q") && parsed.pathname.includes("maps"))
  );
}

export function findGoogleMapsUrlInText(text: string | null | undefined): string | null {
  if (typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (isGoogleMapsUrl(trimmed)) {
    return normalizeHttpUrl(trimmed);
  }

  const protocolMatches = trimmed.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (const match of protocolMatches) {
    if (isGoogleMapsUrl(match)) {
      return normalizeHttpUrl(match);
    }
  }

  const bareMatch = trimmed.match(/(?:maps\.app\.goo\.gl\/[^\s<>"']+)/i)?.[0];
  if (bareMatch && isGoogleMapsUrl(bareMatch)) {
    return normalizeHttpUrl(bareMatch);
  }

  return null;
}

function isPlainTextAddress(address: string | null | undefined): address is string {
  if (!address?.trim()) {
    return false;
  }
  return !isGoogleMapsUrl(address) && !findGoogleMapsUrlInText(address);
}

export function parseCoordsFromGoogleMapsUrl(
  rawUrl: string | null | undefined
): { lat: number; lng: number } | null {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return null;
  }

  const precise = rawUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (precise) {
    return { lat: Number(precise[1]), lng: Number(precise[2]) };
  }

  const at = rawUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    return { lat: Number(at[1]), lng: Number(at[2]) };
  }

  return null;
}

function buildCoordEmbedUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
}

function buildAddressEmbedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed`;
}

function buildCidEmbedUrl(cid: string): string {
  return `https://www.google.com/maps?q=cid:${encodeURIComponent(cid)}&output=embed`;
}

function collectMapsUrlCandidates(input: {
  maps_url: string | null;
  website: string | null;
  social_links: string[];
  address?: string | null;
  notes?: string | null;
}): string[] {
  return [
    input.maps_url,
    input.website,
    ...input.social_links,
    findGoogleMapsUrlInText(input.address),
    findGoogleMapsUrlInText(input.notes)
  ].filter((value): value is string => Boolean(value?.trim()));
}

export function toMapEmbedSrc(mapsUrl: string): string | null {
  const normalized = normalizeHttpUrl(mapsUrl);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("output=embed") || normalized.includes("/maps/embed")) {
    return normalized;
  }

  const coords = parseCoordsFromGoogleMapsUrl(normalized);
  if (coords) {
    return buildCoordEmbedUrl(coords.lat, coords.lng);
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/\.$/, "").toLowerCase();

    if (host === "maps.app.goo.gl" || host === "goo.gl") {
      return null;
    }

    const cid = parsed.searchParams.get("cid");
    if (cid) {
      return buildCidEmbedUrl(cid);
    }

    const q = parsed.searchParams.get("q");
    if (q && host.endsWith("google.com")) {
      return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }
  } catch {
    return null;
  }

  return null;
}

export function partitionManualBusinessUrls(input: {
  website?: string | null;
  social_links?: string[];
  maps_url?: string | null;
  address?: string | null;
}): {
  website: string | null;
  social_links: string[];
  maps_url: string | null;
} {
  const socialLinks = [...(input.social_links ?? [])];
  let mapsUrl: string | null = null;

  const explicitMaps = input.maps_url?.trim();
  if (explicitMaps && isGoogleMapsUrl(explicitMaps)) {
    mapsUrl = normalizeHttpUrl(explicitMaps);
  }

  const websiteRaw = input.website?.trim() ?? "";
  let website: string | null = websiteRaw || null;
  if (website && isGoogleMapsUrl(website)) {
    mapsUrl ??= normalizeHttpUrl(website);
    website = null;
  }

  const filteredSocial: string[] = [];
  for (const link of socialLinks) {
    const trimmed = link.trim();
    if (!trimmed) {
      continue;
    }
    if (isGoogleMapsUrl(trimmed)) {
      mapsUrl ??= normalizeHttpUrl(trimmed);
      continue;
    }
    filteredSocial.push(trimmed);
  }

  if (!mapsUrl) {
    mapsUrl = findGoogleMapsUrlInText(input.address);
  }

  return {
    website,
    social_links: filteredSocial,
    maps_url: mapsUrl
  };
}

export function resolveBusinessMapEmbedUrl(input: {
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
  website: string | null;
  social_links: string[];
  address?: string | null;
  notes?: string | null;
}): string | null {
  if (input.lat !== null && input.lng !== null) {
    return buildCoordEmbedUrl(input.lat, input.lng);
  }

  for (const candidate of collectMapsUrlCandidates(input)) {
    const coords = parseCoordsFromGoogleMapsUrl(candidate);
    if (coords) {
      return buildCoordEmbedUrl(coords.lat, coords.lng);
    }
  }

  if (isPlainTextAddress(input.address)) {
    return buildAddressEmbedUrl(input.address);
  }

  for (const candidate of collectMapsUrlCandidates(input)) {
    const embed = toMapEmbedSrc(candidate);
    if (embed) {
      return embed;
    }
  }

  return null;
}

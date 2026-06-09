const NON_OWNED_WEBSITE_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "wa.me",
  "api.whatsapp.com",
  "linktr.ee",
  "beacons.ai",
  "google.com",
  "maps.google.com",
  "yelp.com",
  "tripadvisor.com",
] as const;

export interface WebsiteDetection {
  website: string | null;
  has_website: boolean;
}

function isNonOwnedDomain(hostname: string): boolean {
  return NON_OWNED_WEBSITE_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

export function detectOwnWebsite(rawUrl: string | null | undefined): WebsiteDetection {
  if (typeof rawUrl !== "string") {
    return { website: null, has_website: false };
  }

  const website = rawUrl.trim();
  if (!website) {
    return { website: null, has_website: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(website);
  } catch {
    return { website: null, has_website: false };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { website: null, has_website: false };
  }

  if (!parsed.hostname) {
    return { website: null, has_website: false };
  }

  const hostname = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (isNonOwnedDomain(hostname)) {
    return { website: null, has_website: false };
  }

  return { website, has_website: true };
}

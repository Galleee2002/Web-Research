import type { BusinessCreate, BusinessDetailRead, BusinessUpdate } from "@shared/index";

import { findGoogleMapsUrlInText, isGoogleMapsUrl } from "@/lib/domain/maps-url-detection";

import type { ManualBusinessFormState } from "./manual-business-form-fields";

export const EMPTY_MANUAL_BUSINESS_FORM: ManualBusinessFormState = {
  name: "",
  category: "",
  email: "",
  phone: "",
  socialLinksText: "",
  website: "",
  mapsUrl: "",
  address: "",
  notes: "",
  status: "new"
};

function parseSocialLinksText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function businessDetailToFormState(
  business: BusinessDetailRead
): ManualBusinessFormState {
  let mapsUrl = business.maps_url ?? "";
  let website = business.website ?? "";

  if (!mapsUrl && website && isGoogleMapsUrl(website)) {
    mapsUrl = website;
    website = "";
  }

  if (!mapsUrl) {
    mapsUrl = findGoogleMapsUrlInText(business.address) ?? "";
  }

  if (!mapsUrl) {
    for (const link of business.social_links) {
      if (isGoogleMapsUrl(link)) {
        mapsUrl = link;
        break;
      }
    }
  }

  return {
    name: business.name,
    category: business.category ?? "",
    email: business.email ?? "",
    phone: business.phone ?? "",
    socialLinksText: business.social_links.join("\n"),
    website,
    mapsUrl,
    address: business.address ?? "",
    notes: business.notes ?? "",
    status: business.status
  };
}

export function buildManualBusinessCreatePayload(
  form: ManualBusinessFormState
): BusinessCreate {
  const social_links = parseSocialLinksText(form.socialLinksText);

  return {
    name: form.name.trim(),
    category: form.category.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    social_links,
    website: form.website.trim() || null,
    maps_url: form.mapsUrl.trim() || null,
    notes: form.notes.trim() || null,
    address: form.address.trim() || null
  };
}

export function buildManualBusinessUpdatePayload(
  form: ManualBusinessFormState
): BusinessUpdate {
  const social_links = parseSocialLinksText(form.socialLinksText);

  return {
    name: form.name.trim(),
    category: form.category.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    social_links,
    website: form.website.trim() || null,
    maps_url: form.mapsUrl.trim() || null,
    notes: form.notes.trim() || null,
    address: form.address.trim() || null,
    status: form.status
  };
}

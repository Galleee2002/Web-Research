import type {
  BusinessCreate,
  BusinessDetailRead,
  BusinessFilters,
  BusinessRead,
  BusinessStatusUpdate,
  BusinessUpdate,
  PaginatedResponse
} from "@shared/index";

import { ApiError, type OperationContext } from "@/lib/api/http";
import { partitionManualBusinessUrls } from "@/lib/domain/maps-url-detection";
import { detectOwnWebsite } from "@/lib/domain/website-detection";

import {
  buildBusinessFieldUpdate,
  buildManualBusinessInsert,
  findBusinessById as defaultFindBusinessById,
  findBusinesses as defaultFindBusinesses,
  findBusinessesForExport as defaultFindBusinessesForExport,
  findManualBusinessDuplicate as defaultFindManualBusinessDuplicate,
  insertManualBusiness as defaultInsertManualBusiness,
  updateBusinessFields as defaultUpdateBusinessFields,
  updateBusinessLeadStatus as defaultUpdateBusinessLeadStatus
} from "@/lib/db/businesses";

const MANUAL_ONLY_FIELDS = [
  "name",
  "category",
  "email",
  "phone",
  "social_links",
  "website",
  "maps_url",
  "address"
] as const;

interface BusinessServiceDependencies {
  findBusinesses: typeof defaultFindBusinesses;
  findBusinessesForExport: typeof defaultFindBusinessesForExport;
  findBusinessById: typeof defaultFindBusinessById;
  findManualBusinessDuplicate: typeof defaultFindManualBusinessDuplicate;
  insertManualBusiness: typeof defaultInsertManualBusiness;
  updateBusinessFields: typeof defaultUpdateBusinessFields;
  updateBusinessLeadStatus: typeof defaultUpdateBusinessLeadStatus;
}

const defaultBusinessServiceDependencies = {
  findBusinesses: defaultFindBusinesses,
  findBusinessesForExport: defaultFindBusinessesForExport,
  findBusinessById: defaultFindBusinessById,
  findManualBusinessDuplicate: defaultFindManualBusinessDuplicate,
  insertManualBusiness: defaultInsertManualBusiness,
  updateBusinessFields: defaultUpdateBusinessFields,
  updateBusinessLeadStatus: defaultUpdateBusinessLeadStatus
} satisfies BusinessServiceDependencies;

function hasManualOnlyFields(payload: BusinessUpdate): boolean {
  return MANUAL_ONLY_FIELDS.some((field) => Object.hasOwn(payload, field));
}

async function assertNoManualDuplicate(
  name: string,
  address: string | null | undefined,
  context: OperationContext,
  deps: BusinessServiceDependencies,
  excludeId?: string
): Promise<void> {
  const duplicate = await deps.findManualBusinessDuplicate(
    name,
    address,
    context,
    excludeId
  );

  if (duplicate) {
    throw new ApiError(
      "conflict_error",
      "A business with the same name and address already exists",
      409,
      [duplicate.id]
    );
  }
}

export async function listBusinesses(
  filters: BusinessFilters,
  context: OperationContext,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<PaginatedResponse<BusinessRead>> {
  return deps.findBusinesses(filters, context);
}

export async function listBusinessesForExport(
  filters: BusinessFilters,
  context: OperationContext,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<BusinessRead[]> {
  return deps.findBusinessesForExport(filters, context);
}

export async function getBusinessById(
  id: string,
  context: OperationContext,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<BusinessDetailRead | null> {
  return deps.findBusinessById(id, context);
}

export async function createManualBusiness(
  payload: BusinessCreate,
  context: OperationContext,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<BusinessDetailRead> {
  const partitioned = partitionManualBusinessUrls({
    website: payload.website,
    social_links: payload.social_links,
    maps_url: payload.maps_url,
    address: payload.address
  });
  const detectedWebsite = detectOwnWebsite(partitioned.website);

  await assertNoManualDuplicate(payload.name, payload.address ?? null, context, deps);

  return deps.insertManualBusiness(
    buildManualBusinessInsert(
      {
        ...payload,
        social_links: partitioned.social_links
      },
      detectedWebsite.website,
      detectedWebsite.has_website,
      partitioned.maps_url
    ),
    context
  );
}

export async function updateBusiness(
  id: string,
  payload: BusinessUpdate,
  context: OperationContext,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<BusinessDetailRead | null> {
  const existing = await deps.findBusinessById(id, context);
  if (!existing) {
    return null;
  }

  if (existing.source !== "manual" && hasManualOnlyFields(payload)) {
    throw new ApiError(
      "forbidden",
      "Only manual businesses can update profile fields",
      403
    );
  }

  const nextName = payload.name ?? existing.name;
  const nextAddress =
    payload.address !== undefined ? payload.address : existing.address;

  if (
    existing.source === "manual" &&
    (payload.name !== undefined || payload.address !== undefined)
  ) {
    await assertNoManualDuplicate(nextName, nextAddress, context, deps, id);
  }

  let website: string | null | undefined;
  let hasWebsite: boolean | undefined;
  let mapsUrl: string | null | undefined;
  let socialLinks: string[] | undefined;
  const updatePayload: BusinessUpdate = { ...payload };

  const shouldPartitionMaps =
    existing.source === "manual" &&
    (Object.hasOwn(payload, "website") ||
      Object.hasOwn(payload, "social_links") ||
      Object.hasOwn(payload, "maps_url") ||
      Object.hasOwn(payload, "address"));

  if (shouldPartitionMaps) {
    const partitioned = partitionManualBusinessUrls({
      website: Object.hasOwn(payload, "website") ? payload.website : existing.website,
      social_links: Object.hasOwn(payload, "social_links")
        ? (payload.social_links ?? [])
        : existing.social_links,
      maps_url: Object.hasOwn(payload, "maps_url") ? payload.maps_url : existing.maps_url,
      address: Object.hasOwn(payload, "address") ? payload.address : existing.address
    });

    mapsUrl = partitioned.maps_url;
    socialLinks = partitioned.social_links;

    if (Object.hasOwn(payload, "website")) {
      const detectedWebsite = detectOwnWebsite(partitioned.website);
      website = detectedWebsite.website;
      hasWebsite = detectedWebsite.has_website;
    }
  } else if (Object.hasOwn(payload, "website")) {
    const detectedWebsite = detectOwnWebsite(payload.website ?? null);
    website = detectedWebsite.website;
    hasWebsite = detectedWebsite.has_website;
  }

  if (socialLinks !== undefined) {
    updatePayload.social_links = socialLinks;
  }
  if (mapsUrl !== undefined) {
    updatePayload.maps_url = mapsUrl;
  }

  return deps.updateBusinessFields(
    id,
    buildBusinessFieldUpdate(updatePayload, website, hasWebsite),
    context
  );
}

export async function updateBusinessStatus(
  id: string,
  payload: BusinessStatusUpdate,
  context: OperationContext,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<BusinessDetailRead | null> {
  return deps.updateBusinessLeadStatus(id, payload, context);
}

import type {
  BusinessDetailRead,
  BusinessFilters,
  BusinessRead,
  BusinessStatusUpdate,
  PaginatedResponse
} from "@shared/index";

import {
  findBusinesses as defaultFindBusinesses,
  findBusinessesForExport as defaultFindBusinessesForExport,
  findBusinessById as defaultFindBusinessById,
  updateBusinessLeadStatus as defaultUpdateBusinessLeadStatus
} from "@/lib/db/businesses";

interface BusinessServiceDependencies {
  findBusinesses: typeof defaultFindBusinesses;
  findBusinessesForExport: typeof defaultFindBusinessesForExport;
  findBusinessById: typeof defaultFindBusinessById;
  updateBusinessLeadStatus: typeof defaultUpdateBusinessLeadStatus;
}

const defaultBusinessServiceDependencies = {
  findBusinesses: defaultFindBusinesses,
  findBusinessesForExport: defaultFindBusinessesForExport,
  findBusinessById: defaultFindBusinessById,
  updateBusinessLeadStatus: defaultUpdateBusinessLeadStatus
} satisfies BusinessServiceDependencies;

export async function listBusinesses(
  filters: BusinessFilters,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<PaginatedResponse<BusinessRead>> {
  return deps.findBusinesses(filters);
}

export async function listBusinessesForExport(
  filters: BusinessFilters,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<BusinessRead[]> {
  return deps.findBusinessesForExport(filters);
}

export async function getBusinessById(
  id: string,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<BusinessDetailRead | null> {
  return deps.findBusinessById(id);
}

export async function updateBusinessStatus(
  id: string,
  payload: BusinessStatusUpdate,
  deps: BusinessServiceDependencies = defaultBusinessServiceDependencies
): Promise<BusinessDetailRead | null> {
  return deps.updateBusinessLeadStatus(id, payload);
}

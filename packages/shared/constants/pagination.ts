export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const INPUT_LIMITS = {
  query: 120,
  location: 160,
  notes: 2_000,
  city: 120,
  category: 120,
  textSearch: 160,
} as const;

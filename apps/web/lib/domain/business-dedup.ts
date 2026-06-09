export function canonicalizeDedupText(value: string | null | undefined): string {
  if (value == null) {
    return "";
  }

  const withoutAccents = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

  return withoutAccents.replace(/[^a-z0-9]+/g, "");
}

export function fallbackDedupKey(
  name: string,
  address: string | null | undefined,
): [string, string] | null {
  const nameKey = canonicalizeDedupText(name);
  const addressKey = canonicalizeDedupText(address);

  if (!nameKey || !addressKey) {
    return null;
  }

  return [nameKey, addressKey];
}

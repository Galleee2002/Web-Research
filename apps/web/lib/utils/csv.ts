type CsvValue = boolean | number | string | null | undefined;

export function toCsv<T extends object>(
  columns: readonly (keyof T & string)[],
  rows: T[]
): string {
  const lines = [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => escapeCsv(row[column] as CsvValue)).join(",")
    )
  ];

  return lines.join("\n");
}

function escapeCsv(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

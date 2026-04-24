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

  const rawText = String(value);
  const text = neutralizeFormula(rawText);
  if (isFormulaLike(rawText) || /[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function neutralizeFormula(value: string): string {
  return isFormulaLike(value) ? `'${value}` : value;
}

function isFormulaLike(value: string): boolean {
  return /^[=+\-@\t\r]/.test(value);
}

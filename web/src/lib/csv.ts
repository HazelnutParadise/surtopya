export const escapeCsvCell = (value: string) => {
  const normalized = value.replace(/\r?\n/g, " ").trim()
  if (normalized.includes(",") || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

export const buildCsvContent = (
  rows: string[][],
  options: {
    includeBom?: boolean
    lineBreak?: "lf" | "crlf"
  } = {}
) => {
  const lineBreak = options.lineBreak === "lf" ? "\n" : "\r\n"
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join(lineBreak) + lineBreak
  if (options.includeBom) {
    return `\uFEFF${body}`
  }
  return body
}

const CONTENT_DISPOSITION_FILENAME_RE =
  /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i

export function sanitizeFilename(name: string) {
  // Strip any path components and control characters.
  const base = name
    .replace(/\0/g, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop()

  const cleaned = (base || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()

  return cleaned || "download"
}

export function filenameFromContentDisposition(disposition: string) {
  const match = disposition.match(CONTENT_DISPOSITION_FILENAME_RE)
  const raw = match?.[1] || match?.[2]
  if (!raw) return null

  try {
    return sanitizeFilename(decodeURIComponent(raw))
  } catch {
    return sanitizeFilename(raw)
  }
}


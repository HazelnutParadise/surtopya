export const DEFAULT_TIME_ZONE = "Asia/Taipei"

const timeZoneAliasMap: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "US/Pacific": "America/Los_Angeles",
  "US/Mountain": "America/Denver",
  "US/Central": "America/Chicago",
  "US/Eastern": "America/New_York",
  "Etc/UTC": "UTC",
}

type DateFormatOptions = {
  locale?: string
  timeZone?: string
}

const pad = (value: number) => String(value).padStart(2, "0")

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

const getIntlSupportedTimeZones = () => {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      return Intl.supportedValuesOf("timeZone")
    } catch {
      return null
    }
  }

  return null
}

export const canonicalizeTimeZone = (value?: string | null) => {
  if (!value || typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (timeZoneAliasMap[trimmed]) {
    return timeZoneAliasMap[trimmed]
  }

  if (!isValidIanaTimeZone(trimmed)) {
    return null
  }

  const supportedTimeZones = getIntlSupportedTimeZones()
  if (supportedTimeZones?.includes(trimmed)) {
    return trimmed
  }

  try {
    const resolved = new Intl.DateTimeFormat(undefined, { timeZone: trimmed }).resolvedOptions().timeZone
    if (typeof resolved === "string" && resolved.trim().length > 0) {
      return timeZoneAliasMap[resolved] || resolved
    }
  } catch {
    return null
  }

  return trimmed
}

export const normalizePersistedTimeZone = (value?: string | null, fallback = DEFAULT_TIME_ZONE) => {
  return canonicalizeTimeZone(value) || fallback
}

const toValidTimeZone = (timeZone?: string) => {
  return normalizePersistedTimeZone(timeZone, DEFAULT_TIME_ZONE)
}

const formatParts = (value: string, timeZone?: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: toValidTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ""

  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour"),
    minute: lookup("minute"),
  }
}

const toUtcTimestampFromParts = (parts: {
  year: string
  month: string
  day: string
  hour: string
  minute: string
}) => {
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  )
}

export const isValidIanaTimeZone = (value?: string | null) => {
  if (!value || typeof value !== "string") return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

export const utcToDatetimeLocal = (value?: string | null, timeZone?: string) => {
  if (!value) return ""
  const parts = formatParts(value, timeZone)
  if (!parts) return ""
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export const utcToDateOnly = (value?: string | null, timeZone?: string) => {
  if (!value) return ""
  const parts = formatParts(value, timeZone)
  if (!parts) return ""
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const localDatetimeToUtcISOString = (value?: string | null, timeZone?: string) => {
  if (!value) return ""

  const match = value.match(localDateTimePattern)
  if (!match) return ""

  const [, year, month, day, hour, minute] = match
  const safeTimeZone = toValidTimeZone(timeZone)
  const desiredTimestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )

  let guess = desiredTimestamp
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = formatParts(new Date(guess).toISOString(), safeTimeZone)
    if (!parts) return ""

    const actualTimestamp = toUtcTimestampFromParts(parts)
    const diff = desiredTimestamp - actualTimestamp
    if (diff === 0) {
      return new Date(guess).toISOString()
    }
    guess += diff
  }

  const finalParts = formatParts(new Date(guess).toISOString(), safeTimeZone)
  if (!finalParts) return ""
  if (
    finalParts.year !== year ||
    finalParts.month !== month ||
    finalParts.day !== day ||
    finalParts.hour !== hour ||
    finalParts.minute !== minute
  ) {
    return ""
  }

  return new Date(guess).toISOString()
}

export const formatUtcDateTime = (value?: string | null, options: DateFormatOptions = {}) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(options.locale || undefined, {
    timeZone: toValidTimeZone(options.timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export const formatUtcDateTimeLines = (value?: string | null, options: DateFormatOptions = {}) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return {
      date: value,
      time: "",
    }
  }

  return {
    date: new Intl.DateTimeFormat(options.locale || undefined, {
      timeZone: toValidTimeZone(options.timeZone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date),
    time: new Intl.DateTimeFormat(options.locale || undefined, {
      timeZone: toValidTimeZone(options.timeZone),
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  }
}

export const formatUtcDateOnly = (value?: string | null, options: DateFormatOptions = {}) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(options.locale || undefined, {
    timeZone: toValidTimeZone(options.timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export const getSupportedTimeZones = () => {
  const fallbackTimeZones = [
    DEFAULT_TIME_ZONE,
    "Asia/Tokyo",
    "UTC",
    "America/Los_Angeles",
    "America/New_York",
    "Europe/London",
  ]
  const supportedTimeZones = getIntlSupportedTimeZones()
  const unique = new Set<string>()

  ;(supportedTimeZones || fallbackTimeZones).forEach((timeZone) => {
    const normalized = canonicalizeTimeZone(timeZone)
    if (normalized) {
      unique.add(normalized)
    }
  })

  fallbackTimeZones.forEach((timeZone) => {
    unique.add(timeZone)
  })

  return [...unique]
}

export const detectBrowserTimeZone = () => {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  return normalizePersistedTimeZone(detected, DEFAULT_TIME_ZONE)
}

export const formatDateInputValue = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

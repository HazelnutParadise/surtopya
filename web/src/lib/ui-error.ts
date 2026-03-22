const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const pickReadableMessage = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const readUiPayloadMessage = (payload: unknown) => {
  if (!isRecord(payload)) return null
  return pickReadableMessage(payload.message)
}

export const readUiPayloadError = (payload: unknown) => {
  if (!isRecord(payload)) return null
  return pickReadableMessage(payload.error)
}

export const resolveUiError = (payload: unknown, fallbackMessage: string) => {
  return readUiPayloadMessage(payload) || fallbackMessage
}

export const toUiErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (!(error instanceof Error)) return fallbackMessage
  return pickReadableMessage(error.message) || fallbackMessage
}

export interface ResponseCompletionCopy {
  title?: string
  message?: string
}

const completionStorageKey = (responseId: string) => `surtopya:response_completion:${responseId}`

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const normalizeCompletionCopy = (value: unknown): ResponseCompletionCopy | null => {
  if (!isRecord(value)) return null

  const title = typeof value.title === "string" && value.title.trim() ? value.title : undefined
  const message = typeof value.message === "string" && value.message.trim() ? value.message : undefined

  if (!title && !message) return null

  return { title, message }
}

export const writeResponseCompletionCopy = (responseId: string, copy: ResponseCompletionCopy) => {
  if (typeof window === "undefined" || !responseId) return

  const normalized = normalizeCompletionCopy(copy)
  if (!normalized) return

  try {
    sessionStorage.setItem(completionStorageKey(responseId), JSON.stringify(normalized))
  } catch {
    // Ignore storage errors and let thank-you fall back to locale defaults.
  }
}

export const readResponseCompletionCopy = (responseId: string): ResponseCompletionCopy | null => {
  if (typeof window === "undefined" || !responseId) return null

  try {
    const raw = sessionStorage.getItem(completionStorageKey(responseId))
    if (!raw) return null
    return normalizeCompletionCopy(JSON.parse(raw))
  } catch {
    return null
  }
}

export const clearResponseCompletionCopy = (responseId: string) => {
  if (typeof window === "undefined" || !responseId) return

  try {
    sessionStorage.removeItem(completionStorageKey(responseId))
  } catch {
    // Ignore storage errors.
  }
}

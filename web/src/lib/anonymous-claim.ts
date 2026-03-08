export type AnonymousClaimStatus = "pending" | "claimed" | "forfeited"

export interface AnonymousClaimContext {
  responseId: string
  claimToken: string
  pointsAwarded: number
  expiresAt: string
  status: AnonymousClaimStatus
}

const ACTIVE_CLAIM_KEY = "surtopya:anonymous_claim:active"

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export const anonymousClaimStorageKey = (responseId: string) => `surtopya:anonymous_claim:${responseId}`

export const readAnonymousClaimContext = (responseId: string): AnonymousClaimContext | null => {
  if (typeof window === "undefined") return null

  try {
    const raw = sessionStorage.getItem(anonymousClaimStorageKey(responseId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    const responseIdValue = typeof parsed.responseId === "string" ? parsed.responseId : null
    const claimToken = typeof parsed.claimToken === "string" ? parsed.claimToken : null
    const pointsAwarded = Number(parsed.pointsAwarded)
    const expiresAt = typeof parsed.expiresAt === "string" ? parsed.expiresAt : null
    const status = parsed.status

    if (
      !responseIdValue ||
      !claimToken ||
      !Number.isFinite(pointsAwarded) ||
      !expiresAt ||
      (status !== "pending" && status !== "claimed" && status !== "forfeited")
    ) {
      return null
    }

    return {
      responseId: responseIdValue,
      claimToken,
      pointsAwarded: Math.max(0, Math.floor(pointsAwarded)),
      expiresAt,
      status,
    }
  } catch {
    return null
  }
}

export const readActiveAnonymousClaimContext = (): AnonymousClaimContext | null => {
  if (typeof window === "undefined") return null

  try {
    const activeResponseId = sessionStorage.getItem(ACTIVE_CLAIM_KEY)
    if (!activeResponseId) return null

    const claim = readAnonymousClaimContext(activeResponseId)
    if (claim) {
      return claim
    }

    sessionStorage.removeItem(ACTIVE_CLAIM_KEY)
    return null
  } catch {
    return null
  }
}

export const writeAnonymousClaimContext = (claim: AnonymousClaimContext) => {
  if (typeof window === "undefined") return

  try {
    sessionStorage.setItem(anonymousClaimStorageKey(claim.responseId), JSON.stringify(claim))
    sessionStorage.setItem(ACTIVE_CLAIM_KEY, claim.responseId)
  } catch {
    // Ignore storage errors and let thank-you fall back to normal mode.
  }
}

export const clearAnonymousClaimContext = (responseId: string) => {
  if (typeof window === "undefined") return

  try {
    sessionStorage.removeItem(anonymousClaimStorageKey(responseId))
    const activeResponseId = sessionStorage.getItem(ACTIVE_CLAIM_KEY)
    if (activeResponseId === responseId) {
      sessionStorage.removeItem(ACTIVE_CLAIM_KEY)
    }
  } catch {
    // Ignore storage errors.
  }
}

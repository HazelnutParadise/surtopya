export type RuntimeConfig = {
  surveyBasePoints: number
}

let cached: RuntimeConfig | null = null

export const getRuntimeConfig = async (): Promise<RuntimeConfig> => {
  if (cached) return cached

  const res = await fetch("/api/config", { cache: "no-store" })
  if (!res.ok) {
    cached = { surveyBasePoints: 0 }
    return cached
  }

  const payload = (await res.json()) as Partial<RuntimeConfig>
  cached = {
    surveyBasePoints:
      typeof payload.surveyBasePoints === "number" ? payload.surveyBasePoints : 0,
  }
  return cached
}


export type RuntimeConfig = {
  surveyBasePoints: number
}

const DEFAULT_SURVEY_BASE_POINTS = 1

let cached: RuntimeConfig | null = null

export const getRuntimeConfig = async (): Promise<RuntimeConfig> => {
  if (cached) return cached

  const res = await fetch("/api/app/config", { cache: "no-store" })
  if (!res.ok) {
    cached = { surveyBasePoints: DEFAULT_SURVEY_BASE_POINTS }
    return cached
  }

  const payload = (await res.json()) as Partial<RuntimeConfig>
  cached = {
    surveyBasePoints:
      typeof payload.surveyBasePoints === "number"
        ? payload.surveyBasePoints
        : DEFAULT_SURVEY_BASE_POINTS,
  }
  return cached
}

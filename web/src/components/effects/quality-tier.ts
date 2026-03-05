import type { EffectQualityTier } from "./types"

export interface DeviceCapabilityInput {
  viewportWidth: number
  deviceMemory?: number
  hardwareConcurrency?: number
}

export const resolveEffectQualityTier = ({
  viewportWidth,
  deviceMemory,
  hardwareConcurrency,
}: DeviceCapabilityInput): EffectQualityTier => {
  const hasMemory = typeof deviceMemory === "number" && Number.isFinite(deviceMemory)
  const hasCpu = typeof hardwareConcurrency === "number" && Number.isFinite(hardwareConcurrency)

  const memory = hasMemory ? deviceMemory : Number.POSITIVE_INFINITY
  const cpu = hasCpu ? hardwareConcurrency : Number.POSITIVE_INFINITY

  let tier: EffectQualityTier = "low"
  if (memory >= 8 && cpu >= 8 && viewportWidth >= 1024) {
    tier = "high"
  } else if (memory >= 4 && cpu >= 4) {
    tier = "medium"
  }

  if (!hasMemory || !hasCpu) {
    if (tier === "high") return "medium"
    if (tier === "medium") return "low"
  }

  return tier
}

export const getEffectDprCap = (tier: EffectQualityTier) => {
  if (tier === "high") return 1.5
  if (tier === "medium") return 1.25
  return 1
}

export const getTierTargetFps = (tier: EffectQualityTier) => {
  if (tier === "high") return 60
  if (tier === "medium") return 48
  return 30
}

export const isSurveyPublishLocked = (publishedCount?: number | null) =>
  (publishedCount ?? 0) > 0

export const getSurveyDatasetSharingEffectiveValue = (args: {
  everPublic?: boolean | null
  visibility?: string | null
  includeInDatasets?: boolean | null
}) => {
  const everPublic = Boolean(args.everPublic)
  const isPublic = args.visibility === "public"

  if (everPublic || isPublic) return true
  return Boolean(args.includeInDatasets)
}

export const isSurveyDatasetSharingLocked = (args: {
  publishedCount?: number | null
  everPublic?: boolean | null
  visibility?: string | null
}) => {
  const publishLocked = isSurveyPublishLocked(args.publishedCount)
  const everPublic = Boolean(args.everPublic)
  const isPublic = args.visibility === "public"

  return publishLocked || everPublic || isPublic
}

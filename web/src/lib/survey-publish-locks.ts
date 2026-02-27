export const CAP_SURVEY_PUBLIC_DATASET_OPT_OUT = "survey.public_dataset_opt_out"

export const isSurveyPublishLocked = (publishedCount?: number | null) =>
  (publishedCount ?? 0) > 0

const canOptOutPublicDataset = (capabilities?: Record<string, boolean> | null) =>
  Boolean(capabilities?.[CAP_SURVEY_PUBLIC_DATASET_OPT_OUT])

export const getSurveyDatasetSharingEffectiveValue = (args: {
  capabilities?: Record<string, boolean> | null
  visibility?: string | null
  includeInDatasets?: boolean | null
}) => {
  const isPublic = args.visibility === "public"
  const canOptOut = canOptOutPublicDataset(args.capabilities)

  if (isPublic && !canOptOut) return true
  return Boolean(args.includeInDatasets)
}

export const isSurveyDatasetSharingLocked = (args: {
  publishedCount?: number | null
  capabilities?: Record<string, boolean> | null
  visibility?: string | null
}) => {
  const publishLocked = isSurveyPublishLocked(args.publishedCount)
  const isPublic = args.visibility === "public"
  const canOptOut = canOptOutPublicDataset(args.capabilities)

  return publishLocked || (isPublic && !canOptOut)
}

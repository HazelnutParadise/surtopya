type SurveyVersionLike = {
  versionNumber: number
  pointsReward: number
}

type ResolvePublishBoostStateArgs = {
  draftPointsReward: number
  pointsBalance: number
  publishedCount?: number | null
  currentPublishedVersionNumber?: number | null
  hasUnpublishedChanges?: boolean | null
  versions?: SurveyVersionLike[]
  fallbackPublishedPointsReward?: number | null
  versionsLoading?: boolean
}

export type PublishBoostState = {
  publishedBaselinePointsReward: number | null
  requiredBoostSpend: number
  hasInsufficientBoostPoints: boolean
  isPublishBlocked: boolean
}

type ResolveSaveBoostStateArgs = {
  draftPointsReward: number
  savedPointsReward: number
  pointsBalance: number
  publishedCount?: number | null
}

export type SaveBoostState = {
  requiredTopUp: number
  hasInsufficientBoostPoints: boolean
}

export const resolvePublishBoostState = ({
  draftPointsReward,
  pointsBalance,
  publishedCount,
  currentPublishedVersionNumber,
  hasUnpublishedChanges,
  versions = [],
  fallbackPublishedPointsReward,
  versionsLoading = false,
}: ResolvePublishBoostStateArgs): PublishBoostState => {
  const normalizedDraftPointsReward = Math.max(0, Math.floor(draftPointsReward || 0))
  const normalizedPointsBalance = Math.max(0, Math.floor(pointsBalance || 0))
  const normalizedPublishedCount = Math.max(0, Math.floor(publishedCount || 0))

  if (normalizedPublishedCount === 0) {
    const requiredBoostSpend = normalizedDraftPointsReward
    return {
      publishedBaselinePointsReward: 0,
      requiredBoostSpend,
      hasInsufficientBoostPoints: requiredBoostSpend > normalizedPointsBalance,
      isPublishBlocked: false,
    }
  }

  const currentPublishedVersion = versions.find(
    (version) => version.versionNumber === currentPublishedVersionNumber
  )
  const fallbackBaseline =
    !hasUnpublishedChanges && Number.isFinite(Number(fallbackPublishedPointsReward))
      ? Math.max(0, Math.floor(Number(fallbackPublishedPointsReward)))
      : null
  const publishedBaselinePointsReward = currentPublishedVersion?.pointsReward ?? fallbackBaseline

  if (publishedBaselinePointsReward == null) {
    return {
      publishedBaselinePointsReward: null,
      requiredBoostSpend: 0,
      hasInsufficientBoostPoints: false,
      isPublishBlocked: versionsLoading || Boolean(hasUnpublishedChanges),
    }
  }

  const requiredBoostSpend = Math.max(
    normalizedDraftPointsReward - Math.max(0, Math.floor(publishedBaselinePointsReward)),
    0
  )

  return {
    publishedBaselinePointsReward,
    requiredBoostSpend,
    hasInsufficientBoostPoints: requiredBoostSpend > normalizedPointsBalance,
    isPublishBlocked: false,
  }
}

export const resolveSaveBoostState = ({
  draftPointsReward,
  savedPointsReward,
  pointsBalance,
  publishedCount,
}: ResolveSaveBoostStateArgs): SaveBoostState => {
  const normalizedPublishedCount = Math.max(0, Math.floor(publishedCount || 0))
  if (normalizedPublishedCount === 0) {
    return {
      requiredTopUp: 0,
      hasInsufficientBoostPoints: false,
    }
  }

  const normalizedDraftPointsReward = Math.max(0, Math.floor(draftPointsReward || 0))
  const normalizedSavedPointsReward = Math.max(0, Math.floor(savedPointsReward || 0))
  const normalizedPointsBalance = Math.max(0, Math.floor(pointsBalance || 0))
  const requiredTopUp = Math.max(normalizedDraftPointsReward - normalizedSavedPointsReward, 0)

  return {
    requiredTopUp,
    hasInsufficientBoostPoints: requiredTopUp > normalizedPointsBalance,
  }
}

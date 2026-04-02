import { Survey, SurveyTheme } from "@/types/survey"

type PreviewSurveyInput = {
  id: string
  title: string
  description: string
  completionTitle?: string
  completionMessage?: string
  questions: Survey["questions"]
  settings: Partial<Survey["settings"]> &
    Pick<Survey["settings"], "pointsReward"> &
    Partial<Pick<Survey["settings"], "isPublic">>
}

type PreviewStorage = Pick<Storage, "setItem">

type OpenWindow = (url?: string | URL, target?: string, features?: string) => Window | null

type OpenSurveyPreviewOptions = {
  survey: PreviewSurveyInput
  theme?: SurveyTheme | null
  previewPath: string
  storage?: PreviewStorage
  openWindow?: OpenWindow
}

export function buildPreviewSurvey(input: PreviewSurveyInput): Survey {
  const visibility =
    input.settings.visibility ?? (input.settings.isPublic === false ? "non-public" : "public")
  const isPublic = input.settings.isPublic ?? visibility === "public"

  return {
    id: input.id,
    title: input.title,
    description: input.description,
    completionTitle: input.completionTitle,
    completionMessage: input.completionMessage,
    questions: input.questions,
    settings: {
      isPublic,
      isResponseOpen: input.settings.isResponseOpen ?? true,
      requireLoginToRespond: input.settings.requireLoginToRespond ?? false,
      visibility,
      isDatasetActive: input.settings.isDatasetActive ?? false,
      everPublic: input.settings.everPublic,
      pointsReward: input.settings.pointsReward,
      expiresAt: input.settings.expiresAt,
      publishedCount: input.settings.publishedCount,
      currentPublishedVersionNumber: input.settings.currentPublishedVersionNumber,
      hasUnpublishedChanges: input.settings.hasUnpublishedChanges,
      isPublished: input.settings.isPublished,
    },
  }
}

export function openSurveyPreview({
  survey,
  theme,
  previewPath,
  storage = window.sessionStorage,
  openWindow = window.open.bind(window),
}: OpenSurveyPreviewOptions) {
  storage.setItem("preview_survey", JSON.stringify(buildPreviewSurvey(survey)))
  storage.setItem("preview_theme", JSON.stringify(theme ?? {}))
  openWindow(previewPath, "_blank")
}

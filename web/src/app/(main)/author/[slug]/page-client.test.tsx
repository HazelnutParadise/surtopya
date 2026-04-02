// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AuthorPageClient } from "./page-client"

vi.mock("next/navigation", () => ({
  usePathname: () => "/zh-TW/@author-a",
}))

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    if (namespace === "AuthorPage") {
      return (key: string) =>
        (
          {
            anonymousAuthor: "Anonymous author",
            subtitle: "Public profile",
            title: "Profile",
            memberSince: "Member since",
            surveysTitle: "Surveys",
            emptySurveys: "No surveys",
          } as Record<string, string>
        )[key] ?? key
    }

    if (namespace === "SurveyCard") {
      return (key: string) =>
        (
          {
            anonymousAuthor: "Anonymous author",
          } as Record<string, string>
        )[key] ?? key
    }

    return (key: string) => key
  },
}))

vi.mock("@/components/survey-card", () => ({
  SurveyCard: ({
    id,
    points,
  }: {
    id: string
    points: number
  }) => <div data-testid={`survey-card-${id}`}>points:{points}</div>,
}))

describe("AuthorPageClient", () => {
  it("uses survey base points instead of hardcoded one-point rewards", () => {
    render(
      <AuthorPageClient
        author={{
          id: "author-1",
          slug: "author-a",
          displayName: "Author A",
          avatarUrl: null,
          bio: null,
          location: null,
          phone: null,
          email: null,
          memberSince: null,
        }}
        surveyBasePoints={5}
        surveys={[
          {
            id: "survey-1",
            title: "Survey title",
            description: "Survey description",
            visibility: "public",
            requireLoginToRespond: false,
            isResponseOpen: true,
            includeInDatasets: false,
            everPublic: true,
            publishedCount: 1,
            hasUnpublishedChanges: false,
            pointsReward: 8,
            responseCount: 3,
            createdAt: "2026-03-10T00:00:00Z",
            updatedAt: "2026-03-10T00:00:00Z",
            author: {
              id: "author-1",
              slug: "author-a",
              displayName: "Author A",
              avatarUrl: null,
            },
          },
        ]}
      />
    )

    expect(screen.getByTestId("survey-card-survey-1")).toHaveTextContent("points:7")
  })
})

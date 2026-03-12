import { buildSurveyResponsesCsvRows } from "@/lib/survey-responses-csv"

describe("survey responses csv", () => {
  const metadataHeaders = {
    id: "Response ID",
    status: "Status",
    respondent: "Respondent",
    points: "Points",
    startedAt: "Started",
    submittedAt: "Submitted",
  }

  it("builds union question columns across versions and exports completed responses only", () => {
    const rows = buildSurveyResponsesCsvRows({
      surveyVersions: [
        {
          versionNumber: 1,
          snapshot: {
            questions: [
              { id: "q1", title: "年齡", type: "short" },
              { id: "q2", title: "城市", type: "short" },
              { id: "section-1", title: "Section", type: "section" },
            ],
          },
        },
        {
          versionNumber: 2,
          snapshot: {
            questions: [
              { id: "q3", title: "城市", type: "short" },
              { id: "q4", title: "收入", type: "short" },
            ],
          },
        },
      ],
      responses: [
        {
          id: "r-completed",
          status: "completed",
          userId: "u-1",
          pointsAwarded: 6,
          startedAt: "2026-03-10T10:00:00Z",
          completedAt: "2026-03-10T10:10:00Z",
          answers: [
            { questionId: "q1", value: { text: "25" } },
            { questionId: "q2", value: { value: "台北" } },
            { questionId: "q3", value: { values: ["A", "B"] } },
            { questionId: "q4", value: { rating: 4 } },
          ],
        },
        {
          id: "r-in-progress",
          status: "in_progress",
          userId: "u-2",
          pointsAwarded: 0,
          answers: [{ questionId: "q1", value: { text: "should not export" } }],
        },
      ],
      metadataHeaders,
    })

    expect(rows[0]).toEqual([
      "Response ID",
      "Status",
      "Respondent",
      "Points",
      "Started",
      "Submitted",
      "年齡",
      "城市 (q2)",
      "城市 (q3)",
      "收入",
    ])

    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual([
      "r-completed",
      "completed",
      "u-1",
      "6",
      "2026-03-10T10:00:00Z",
      "2026-03-10T10:10:00Z",
      "25",
      "台北",
      "A | B",
      "4",
    ])
  })

  it("falls back to answer question ids when versions are missing", () => {
    const rows = buildSurveyResponsesCsvRows({
      surveyVersions: [],
      responses: [
        {
          id: "r-1",
          status: "completed",
          anonymousId: "anon-1",
          startedAt: "2026-03-10T09:00:00Z",
          createdAt: "2026-03-10T09:05:00Z",
          answers: [{ questionId: "q-unknown", value: { date: "2026-03-10" } }],
        },
      ],
      metadataHeaders,
    })

    expect(rows[0]).toEqual([
      "Response ID",
      "Status",
      "Respondent",
      "Points",
      "Started",
      "Submitted",
      "q-unknown",
    ])

    expect(rows[1]).toEqual([
      "r-1",
      "completed",
      "anon-1",
      "0",
      "2026-03-10T09:00:00Z",
      "2026-03-10T09:05:00Z",
      "2026-03-10",
    ])
  })

  it("supports exporting a specific version only", () => {
    const rows = buildSurveyResponsesCsvRows({
      surveyVersions: [
        {
          versionNumber: 1,
          snapshot: {
            questions: [{ id: "q-old", title: "Old question", type: "short" }],
          },
        },
        {
          versionNumber: 2,
          snapshot: {
            questions: [{ id: "q-new", title: "New question", type: "short" }],
          },
        },
      ],
      responses: [
        {
          id: "r-v1",
          status: "completed",
          surveyVersionNumber: 1,
          userId: "u-1",
          startedAt: "2026-03-10T09:00:00Z",
          completedAt: "2026-03-10T09:05:00Z",
          answers: [{ questionId: "q-old", value: { text: "legacy" } }],
        },
        {
          id: "r-v2",
          status: "completed",
          surveyVersionNumber: 2,
          userId: "u-2",
          startedAt: "2026-03-11T09:00:00Z",
          completedAt: "2026-03-11T09:05:00Z",
          answers: [
            { questionId: "q-new", value: { text: "current" } },
            { questionId: "q-extra", value: { text: "extra answer" } },
          ],
        },
      ],
      metadataHeaders,
      exportScope: 2,
    })

    expect(rows[0]).toEqual([
      "Response ID",
      "Status",
      "Respondent",
      "Points",
      "Started",
      "Submitted",
      "New question",
      "q-extra",
    ])

    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual([
      "r-v2",
      "completed",
      "u-2",
      "0",
      "2026-03-11T09:00:00Z",
      "2026-03-11T09:05:00Z",
      "current",
      "extra answer",
    ])
  })
})

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SurveyBuilder } from "@/components/builder/survey-builder"

const state = vi.hoisted(() => ({
  editId: "survey-1" as string | null,
}))

const translators = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, unknown>) => {
    if (key === "versionLabel" && values?.version) {
      return `Version ${values.version}`
    }
    return key
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/zh-TW/create",
  useSearchParams: () => ({
    get: (key: string) => (key === "edit" ? state.editId : null),
  }),
}))

vi.mock("next-intl", () => ({
  useTimeZone: () => "Asia/Taipei",
  useTranslations: () => translators.t,
}))

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PointerSensor: function PointerSensor() {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  arrayMove: <T,>(items: T[]) => items,
  verticalListSortingStrategy: vi.fn(),
}))

vi.mock("@/components/builder/toolbox", () => ({
  Toolbox: () => <div data-testid="toolbox" />,
}))

vi.mock("@/components/builder/canvas", () => ({
  Canvas: () => <div data-testid="canvas" />,
}))

vi.mock("@/components/builder/theme-editor", () => ({
  ThemeEditor: ({ onUpdate }: { onUpdate: (updates: Record<string, string>) => void }) => (
    <button type="button" onClick={() => onUpdate({ primaryColor: "#111111" })}>
      change-theme
    </button>
  ),
}))

vi.mock("@/components/builder/logic-editor", () => ({
  LogicEditor: () => null,
}))

vi.mock("@/components/survey/version-document-preview", () => ({
  VersionDocumentPreview: () => <div data-testid="version-document-preview" />,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open = false }: { children: ReactNode; open?: boolean }) => (
    <div>{open ? children : null}</div>
  ),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/lib/points-balance-events", () => ({
  notifyPointsBalanceChanged: vi.fn(),
}))

const buildSurveyPayload = (overrides?: Record<string, unknown>) => ({
  id: "survey-1",
  title: "Loaded title",
  description: "Loaded description",
  completionTitle: "Loaded thanks",
  completionMessage: "Loaded message",
  visibility: "non-public",
  requireLoginToRespond: false,
  isResponseOpen: true,
  includeInDatasets: false,
  everPublic: false,
  publishedCount: 1,
  hasUnpublishedChanges: false,
  currentPublishedVersionNumber: 1,
  pointsReward: 0,
  responseCount: 0,
  createdAt: "2026-03-10T00:00:00Z",
  updatedAt: "2026-03-10T00:00:00Z",
  questions: [
    {
      id: "page-1",
      type: "section",
      title: "Page 1",
      required: false,
    },
  ],
  theme: {
    primaryColor: "#9333ea",
    backgroundColor: "#f9fafb",
    fontFamily: "inter",
  },
  ...overrides,
})

const buildJsonResponse = (body: unknown, ok = true) =>
  new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: {
      "Content-Type": "application/json",
    },
  })

describe("SurveyBuilder settings save", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
  })

  it("saves existing survey settings via partial PUT and keeps unsaved builder changes", async () => {
    state.editId = "survey-1"

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString()

      if (url === "/api/app/me") {
        return Promise.resolve(buildJsonResponse({ capabilities: {} }))
      }

      if (url === "/api/app/surveys/survey-1" && !init?.method) {
        return Promise.resolve(buildJsonResponse(buildSurveyPayload()))
      }

      if (url === "/api/app/surveys/survey-1/versions" && !init?.method) {
        return Promise.resolve(buildJsonResponse({ versions: [] }))
      }

      if (url === "/api/app/surveys/survey-1" && init?.method === "PUT") {
        return Promise.resolve(
          buildJsonResponse(
            buildSurveyPayload({
              completionTitle: "Saved from settings",
            })
          )
        )
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    vi.stubGlobal("fetch", fetchMock)

    render(<SurveyBuilder />)

    fireEvent.click(screen.getByRole("button", { name: "agree" }))
    await screen.findByTestId("builder-tab-settings")

    fireEvent.click(screen.getByRole("button", { name: "theme" }))
    fireEvent.click(screen.getAllByRole("button", { name: "change-theme" })[0])
    fireEvent.click(screen.getByTestId("builder-tab-settings"))

    const completionTitleInput = await screen.findByTestId("builder-settings-completion-title")
    fireEvent.change(completionTitleInput, { target: { value: "Saved from settings" } })
    fireEvent.click(screen.getAllByRole("button", { name: "save" })[1])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/app/surveys/survey-1",
        expect.objectContaining({
          method: "PUT",
        })
      )
    })

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/app/surveys/survey-1" && (init as RequestInit | undefined)?.method === "PUT"
    )

    expect(putCall).toBeDefined()
    const putBody = JSON.parse(((putCall as [string, RequestInit])[1].body as string))
    expect(putBody.completionTitle).toBe("Saved from settings")
    expect(putBody.questions).toBeUndefined()
    expect(putBody.theme).toBeUndefined()

    await waitFor(() => {
      expect(screen.queryByTestId("builder-settings-completion-title")).not.toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "save" })).toBeEnabled()
  })
})

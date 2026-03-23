import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import AdminPage from "../page"

const { trackUIEventMock, notifyPointsBalanceChangedMock } = vi.hoisted(() => ({
  trackUIEventMock: vi.fn(() => Promise.resolve()),
  notifyPointsBalanceChangedMock: vi.fn(),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useTimeZone: () => "Asia/Taipei",
}))

vi.mock("@/lib/ui-telemetry", () => ({
  trackUIEvent: trackUIEventMock,
}))

vi.mock("@/lib/points-balance-events", () => ({
  notifyPointsBalanceChanged: notifyPointsBalanceChangedMock,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open = false }: { children: ReactNode; open?: boolean }) => (
    <div>{open ? children : null}</div>
  ),
  DialogContent: ({
    children,
    ...props
  }: {
    children: ReactNode
    className?: string
    "data-testid"?: string
  }) => <div {...props}>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({
    children,
    ...props
  }: {
    children: ReactNode
    className?: string
    "data-testid"?: string
  }) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked = false,
    onCheckedChange,
  }: {
    checked?: boolean
    onCheckedChange?: (next: boolean) => void
  }) => (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange?.(!checked)}
    >
      switch
    </button>
  ),
}))

const baseDataset = {
  id: "dataset-1",
  title: "Dataset A",
  description: "Dataset description",
  category: "other",
  accessType: "free" as const,
  price: 0,
  downloadCount: 0,
  sampleSize: 12,
  isActive: true,
  currentPublishedVersionId: "dataset-version-1",
  currentPublishedVersionNumber: 1,
  hasUnpublishedChanges: false,
  entitlementPolicy: "purchased_only" as const,
  createdAt: "2026-03-10T00:00:00Z",
  updatedAt: "2026-03-10T00:00:00Z",
}

const buildJsonResponse = (body: unknown, ok = true) =>
  new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  })

describe("AdminPage publish metadata-only result", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString()

      if (url === "/api/app/me") {
        return Promise.resolve(
          buildJsonResponse({
            id: "user-1",
            pointsBalance: 0,
            monthlyPointsGrant: 0,
            membershipTier: "free",
            capabilities: {},
            locale: "zh-TW",
            createdAt: "2026-03-10T00:00:00Z",
            surveysCompleted: 0,
            isAdmin: true,
            isSuperAdmin: true,
          }),
        )
      }
      if (url.startsWith("/api/app/admin/surveys?")) {
        return Promise.resolve(buildJsonResponse({ surveys: [] }))
      }
      if (url.startsWith("/api/app/admin/datasets?")) {
        return Promise.resolve(buildJsonResponse({ datasets: [baseDataset] }))
      }
      if (url.startsWith("/api/app/admin/deid/reviews?")) {
        return Promise.resolve(buildJsonResponse({ jobs: [] }))
      }
      if (url.startsWith("/api/app/admin/users?")) {
        return Promise.resolve(buildJsonResponse({ users: [] }))
      }
      if (url.startsWith("/api/app/admin/agents?")) {
        return Promise.resolve(buildJsonResponse({ accounts: [] }))
      }
      if (url === "/api/app/admin/policies") {
        return Promise.resolve(buildJsonResponse({ tiers: [], capabilities: [], matrix: [] }))
      }
      if (url === "/api/app/admin/policy-writers") {
        return Promise.resolve(buildJsonResponse({ users: [] }))
      }
      if (url === "/api/app/admin/system-settings") {
        return Promise.resolve(
          buildJsonResponse({ surveyBasePoints: 1, signupInitialPoints: 0 }),
        )
      }
      if (url === "/api/app/admin/datasets/dataset-1/versions") {
        return Promise.resolve(buildJsonResponse({ versions: [] }))
      }
      if (url === "/api/app/admin/datasets/dataset-1/publish" && init?.method === "POST") {
        return Promise.resolve(
          buildJsonResponse({
            dataset: {
              ...baseDataset,
              hasUnpublishedChanges: false,
              updatedAt: "2026-03-11T00:00:00Z",
            },
            message: "Settings saved. No new version was created.",
          }),
        )
      }

      throw new Error(`Unhandled fetch request: ${url}`)
    })

    global.fetch = fetchMock as unknown as typeof fetch
  })

  it("shows metadata-only publish message as a non-error notice", async () => {
    render(<AdminPage />)

    await screen.findByText("Dataset A")
    const editButtons = await screen.findAllByRole("button", { name: "edit" })
    fireEvent.click(editButtons[0])

    expect(await screen.findByTestId("dataset-edit-modal")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "publishNewVersion" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/app/admin/datasets/dataset-1/publish",
        expect.objectContaining({ method: "POST" }),
      )
    })

    expect(
      await screen.findByText("Settings saved. No new version was created."),
    ).toBeInTheDocument()
    expect(screen.queryByText("updateError")).not.toBeInTheDocument()
  })

  it("publishes dataset version with FormData when a new file is selected", async () => {
    render(<AdminPage />)

    await screen.findByText("Dataset A")
    const editButtons = await screen.findAllByRole("button", { name: "edit" })
    fireEvent.click(editButtons[0])

    const modal = await screen.findByTestId("dataset-edit-modal")
    const fileInput = within(modal).getByTestId("dataset-version-file-input")
    const replacementFile = new File(["col1,col2\n1,2\n"], "replacement.csv", {
      type: "text/csv",
    })
    fireEvent.change(fileInput, { target: { files: [replacementFile] } })

    expect(within(modal).getByTestId("dataset-version-file-selection")).toHaveTextContent(
      "replacement.csv",
    )

    fireEvent.click(within(modal).getByRole("button", { name: "publishNewVersion" }))

    await waitFor(() => {
      const publishCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, init]) =>
          url === "/api/app/admin/datasets/dataset-1/publish" &&
          (init as RequestInit | undefined)?.method === "POST",
      )
      expect(publishCalls).toHaveLength(1)
    })

    const publishCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url, init]) =>
        url === "/api/app/admin/datasets/dataset-1/publish" &&
        (init as RequestInit | undefined)?.method === "POST",
    )
    const publishRequest = publishCall?.[1] as RequestInit
    expect(publishRequest.body).toBeInstanceOf(FormData)

    const formData = publishRequest.body as FormData
    expect(formData.get("accessType")).toBe("free")
    expect(formData.get("price")).toBe("0")
    const sentFile = formData.get("file")
    expect(sentFile).toBeInstanceOf(File)
    expect((sentFile as File).name).toBe("replacement.csv")
  })
})

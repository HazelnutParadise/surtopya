import { fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { SurveyManagementPublishActions } from "@/components/survey/survey-management-publish-actions"

const messages = {
  SurveyManagement: {
    publishNewVersion: "Publish new version",
  },
  Common: {
    publish: "Publish",
    openResponses: "Open responses",
    closeResponses: "Close responses",
  },
}

const renderActions = (props: Partial<ComponentProps<typeof SurveyManagementPublishActions>> = {}) => {
  const onInitialPublish = vi.fn()
  const onPublishNewVersion = vi.fn()
  const onToggleResponses = vi.fn()

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SurveyManagementPublishActions
        hasPublishedVersion={false}
        hasUnpublishedChanges={false}
        isResponseOpen={false}
        publishing={false}
        isDirty={false}
        onInitialPublish={onInitialPublish}
        onPublishNewVersion={onPublishNewVersion}
        onToggleResponses={onToggleResponses}
        {...props}
      />
    </NextIntlClientProvider>
  )

  return { onInitialPublish, onPublishNewVersion, onToggleResponses }
}

describe("SurveyManagementPublishActions", () => {
  it("shows only the initial publish action for unpublished surveys", () => {
    renderActions()

    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Publish new version" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open responses" })).not.toBeInTheDocument()
  })

  it("shows only the response toggle when published with no unpublished changes", () => {
    renderActions({
      hasPublishedVersion: true,
      hasUnpublishedChanges: false,
      isResponseOpen: true,
    })

    expect(screen.queryByRole("button", { name: "Publish new version" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Close responses" })).toBeInTheDocument()
  })

  it("shows publish new version and response toggle when published with unpublished changes", () => {
    const { onPublishNewVersion, onToggleResponses } = renderActions({
      hasPublishedVersion: true,
      hasUnpublishedChanges: true,
      isResponseOpen: false,
    })

    fireEvent.click(screen.getByRole("button", { name: "Publish new version" }))
    fireEvent.click(screen.getByRole("button", { name: "Open responses" }))

    expect(onPublishNewVersion).toHaveBeenCalledTimes(1)
    expect(onToggleResponses).toHaveBeenCalledTimes(1)
  })

  it("disables publish new version when the settings form is dirty", () => {
    renderActions({
      hasPublishedVersion: true,
      hasUnpublishedChanges: true,
      isDirty: true,
    })

    expect(screen.getByRole("button", { name: "Publish new version" })).toBeDisabled()
  })
})

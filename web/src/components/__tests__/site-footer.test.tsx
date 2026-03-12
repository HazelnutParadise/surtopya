import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SiteFooter } from "@/components/site-footer"

const mocks = vi.hoisted(() => ({
  pathname: "/en/pricing",
}))

const homeMessages: Record<string, string> = {
  footerCopyright: "© {year} Surtopya. All rights reserved.",
  footerTerms: "Terms",
  footerPrivacy: "Privacy",
  footerHazelnutParadise: "HazelnutParadise",
}

const formatMessage = (template: string, values?: Record<string, string | number>) => {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))
}

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    formatMessage(homeMessages[key] ?? key, values),
}))

describe("SiteFooter", () => {
  it("renders on public pages and includes localized internal links plus HazelnutParadise link", () => {
    mocks.pathname = "/en/datasets/api"

    render(<SiteFooter />)

    expect(screen.getByTestId("site-footer")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/en/terms")
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/en/privacy")
    expect(screen.getByRole("link", { name: "HazelnutParadise" })).toHaveAttribute("href", "https://hazelnut-paradise.com")
    expect(screen.getByRole("link", { name: "HazelnutParadise" })).toHaveAttribute("target", "_blank")
    expect(screen.getByRole("link", { name: "HazelnutParadise" })).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders for nested dataset detail pages", () => {
    mocks.pathname = "/ja/datasets/dataset-123"

    render(<SiteFooter />)

    expect(screen.getByTestId("site-footer")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/ja/terms")
  })

  it("does not render on non-public routes", () => {
    mocks.pathname = "/en/dashboard"

    render(<SiteFooter />)

    expect(screen.queryByTestId("site-footer")).not.toBeInTheDocument()
  })
})

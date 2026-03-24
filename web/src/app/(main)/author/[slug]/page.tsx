import { cookies, headers } from "next/headers"
import { notFound, permanentRedirect } from "next/navigation"
import { fetchInternalApp } from "@/lib/internal-app-fetch"
import { getAuthToken } from "@/lib/api-server"
import { ANONYMOUS_RESPONDENT_COOKIE } from "@/lib/anonymous-respondent"
import type { AuthorPageResponse } from "@/lib/api"
import { AuthorPageClient } from "./page-client"
import { withLocale } from "@/lib/locale"

type Props = {
  params: Promise<{ slug: string }>
}

const fetchAuthorPageData = async (slug: string): Promise<AuthorPageResponse | null> => {
  const token = await getAuthToken()
  const cookieStore = await cookies()
  const anonymousId = cookieStore.get(ANONYMOUS_RESPONDENT_COOKIE)?.value?.trim()
  const outboundHeaders =
    token || anonymousId
      ? {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(anonymousId ? { "X-Surtopya-Anonymous-Id": anonymousId } : {}),
        }
      : undefined

  const response = await fetchInternalApp(`/authors/${encodeURIComponent(slug)}?limit=100&offset=0`, {
    headers: outboundHeaders,
    cache: "no-store",
  })

  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error("failed_to_load_author")
  }

  return (await response.json()) as AuthorPageResponse
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params
  const payload = await fetchAuthorPageData(slug)
  if (!payload) {
    notFound()
  }

  const canonical = (payload.canonicalSlug || "").trim()
  const requestLocale = (await headers()).get("x-locale") || "en"
  if (canonical && canonical !== slug) {
    permanentRedirect(withLocale(`/@${canonical}`, requestLocale))
  }

  return (
    <AuthorPageClient
      author={payload.author}
      surveys={payload.surveys || []}
    />
  )
}

"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { SurveyCard } from "@/components/survey-card"
import type { AuthorPageAuthor, Survey } from "@/lib/api"
import { getLocaleFromPath } from "@/lib/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapPin, Phone, Mail, CalendarDays } from "lucide-react"

type AuthorPageClientProps = {
  author: AuthorPageAuthor
  surveys: Survey[]
  surveyBasePoints: number
}

export function AuthorPageClient({ author, surveys, surveyBasePoints }: AuthorPageClientProps) {
  const pathname = usePathname()
  const locale = getLocaleFromPath(pathname)
  const t = useTranslations("AuthorPage")
  const tCard = useTranslations("SurveyCard")
  const displayName = author.displayName?.trim() || t("anonymousAuthor")
  const initial = useMemo(() => displayName.substring(0, 2).toUpperCase(), [displayName])

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 md:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t("subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarImage src={author.avatarUrl} alt={displayName} />
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900 dark:text-white">{displayName}</p>
                <p className="truncate text-xs text-gray-500">@{author.slug}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {author.bio ? <p>{author.bio}</p> : null}
              {author.location ? (
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{author.location}</p>
              ) : null}
              {author.phone ? (
                <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{author.phone}</p>
              ) : null}
              {author.email ? (
                <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{author.email}</p>
              ) : null}
              {author.memberSince ? (
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{t("memberSince")}: {new Date(author.memberSince).toLocaleDateString(locale)}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <section className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">{t("surveysTitle")}</h2>
          {surveys.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("emptySurveys")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {surveys.map((survey) => (
                <SurveyCard
                  key={survey.id}
                  id={survey.id}
                  title={survey.title}
                  description={survey.description}
                  points={surveyBasePoints + Math.floor((survey.pointsReward || 0) / 3)}
                  responses={survey.responseCount}
                  visibility={survey.visibility}
                  requireLoginToRespond={Boolean(survey.requireLoginToRespond)}
                  isHot={Boolean(survey.isHot)}
                  hasResponded={Boolean(survey.hasResponded)}
                  locale={locale}
                  author={{
                    name: survey.author?.displayName?.trim() || tCard("anonymousAuthor"),
                    image: survey.author?.avatarUrl,
                    slug: survey.author?.slug,
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Users, Star, Lock, Globe } from "lucide-react";
import { withLocale } from "@/lib/locale";
import { useTranslations } from "next-intl";

const stripMarkdown = (value: string) => {
  if (!value) return ""
  return value
    .replace(/```/g, "")
    .replace(/`/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_]{1,3}/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^(\s*[-*+]\s+|\s*\d+\.\s+)/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

interface SurveyCardProps {
  id: string;
  title: string;
  description: string;
  points: number;
  duration?: number; // in minutes
  responses: number;
  rating?: number;
  author?: {
    name: string;
    image?: string;
  };
  tags?: string[];
  isHot?: boolean;
  variant?: 'explore' | 'dashboard'; // explore = go to intro page, dashboard = go to management page
  visibility?: 'public' | 'non-public';
  hasUnpublishedChanges?: boolean;
  currentPublishedVersionNumber?: number;
  isResponseOpen?: boolean;
  requireLoginToRespond?: boolean;
  hasResponded?: boolean;
  locale?: string;
}

export function SurveyCard({
  id,
  title,
  description,
  points,
  duration,
  responses,
  rating,
  author,
  tags = [],
  isHot,
  variant = 'explore',
  visibility = 'public',
  hasUnpublishedChanges = false,
  currentPublishedVersionNumber,
  isResponseOpen,
  requireLoginToRespond = false,
  hasResponded = false,
  locale,
}: SurveyCardProps) {
  const t = useTranslations("SurveyCard");
  const tDashboard = useTranslations("Dashboard")
  const cleanedDescription = stripMarkdown(description)
  const isPublished = Boolean(currentPublishedVersionNumber && currentPublishedVersionNumber > 0)
  const shouldShowEditedUnpublished = variant === "dashboard" && isPublished && hasUnpublishedChanges
  // Determine link based on variant
  const href = variant === 'dashboard' 
    ? `/dashboard/surveys/${id}` 
    : `/survey/${id}?title=${encodeURIComponent(title.replace(/\s+/g, '-').toLowerCase())}`;
  const localizedHref = locale ? withLocale(href, locale) : href;
    
  return (
    <Link href={localizedHref} className="block h-full" data-testid={`survey-card-${id}`}>
      <Card className="group relative flex h-full flex-col overflow-hidden border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/50 hover:shadow-xl dark:border-gray-800 dark:bg-gray-950 dark:hover:border-purple-400/50">
        {isHot && (
          <div className="absolute -right-12 top-6 rotate-45 bg-gradient-to-r from-red-500 to-pink-500 py-1 pl-12 pr-12 text-xs font-bold text-white shadow-sm">
            {t("hot")}
          </div>
        )}
        
        <CardHeader className="p-5 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.length > 0 && tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="max-w-full bg-gray-100 text-xs font-normal text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  >
                    {tag}
                  </Badge>
                ))}
                {variant === "dashboard" ? (
                  <>
                    <Badge
                      variant="outline"
                      className={
                        isPublished
                          ? "max-w-full whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-5 px-1.5 font-bold"
                          : "max-w-full whitespace-nowrap bg-gray-100 text-gray-600 border-gray-200 text-[10px] h-5 px-1.5 font-bold"
                      }
                    >
                      {isPublished ? tDashboard("statusPublished") : tDashboard("statusDraft")}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        isResponseOpen
                          ? "max-w-full whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200 text-[10px] h-5 px-1.5 font-bold"
                          : "max-w-full whitespace-nowrap bg-gray-100 text-gray-600 border-gray-200 text-[10px] h-5 px-1.5 font-bold"
                      }
                    >
                      {isResponseOpen ? tDashboard("statusResponsesOpen") : tDashboard("statusResponsesClosed")}
                    </Badge>
                  </>
                ) : null}
                {variant !== "dashboard" && requireLoginToRespond ? (
                  <Badge
                    variant="outline"
                    className="max-w-full whitespace-nowrap bg-amber-50 text-amber-700 border-amber-200 text-[10px] h-5 px-1.5 font-bold"
                  >
                    {t("loginRequired")}
                  </Badge>
                ) : null}
                {variant !== "dashboard" && hasResponded ? (
                  <Badge
                    variant="outline"
                    className="max-w-full whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-5 px-1.5 font-bold"
                  >
                    {t("alreadySubmitted")}
                  </Badge>
                ) : null}
                {shouldShowEditedUnpublished && (
                  <Badge variant="outline" className="max-w-full whitespace-nowrap bg-amber-50 text-amber-600 border-amber-200 text-[10px] h-5 px-1.5 font-bold">
                    {tDashboard("statusEditedUnpublished")}
                  </Badge>
                )}
              </div>
              <h3 className="line-clamp-2 text-lg font-bold leading-tight text-gray-900 transition-colors group-hover:text-purple-600 dark:text-gray-100 dark:group-hover:text-purple-400">
                {title}
              </h3>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-5 pt-2">
          <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
            {cleanedDescription}
          </p>
          
          <div className="mt-4 flex items-center gap-4">
            {typeof duration === "number" && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                {t("minutes", { count: duration })}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Users className="h-3.5 w-3.5" />
              {t("responses", { count: responses })}
            </div>
            {typeof rating === "number" && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" />
                {rating.toFixed(1)}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="border-t border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {variant === 'dashboard' ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      {visibility === 'public' ? (
                          <>
                              <Globe className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">{t("public")}</span>
                          </>
                      ) : (
                          <>
                              <Lock className="h-3.5 w-3.5 text-amber-500" />
                              <span className="text-amber-600 dark:text-amber-400">{t("nonPublic")}</span>
                          </>
                      )}
                  </div>
              ) : author ? (
                <>
                  <Avatar className="h-6 w-6 border border-gray-200 dark:border-gray-700">
                    <AvatarImage src={author.image} />
                    <AvatarFallback className="text-[10px]">{author.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {author.name}
                  </span>
                </>
              ) : null}
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm border-0">
                {t("points", { count: points })}
              </Badge>
            </div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

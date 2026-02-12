"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SurveyCard } from "@/components/survey-card";
import { Search, ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTranslations } from "next-intl";
import type { Survey } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/runtime-config"

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const withLocalePath = (href: string) => withLocale(href, locale);
  const t = useTranslations("Explore");

  const searchQuery = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "recommended";

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [surveyBasePoints, setSurveyBasePoints] = useState(0)

  useEffect(() => {
    let alive = true
    getRuntimeConfig()
      .then((cfg) => {
        if (alive) setSurveyBasePoints(cfg.surveyBasePoints)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const updateSearch = (term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set("q", term);
    } else {
      params.delete("q");
    }
    router.replace(withLocalePath(`/explore?${params.toString()}`));
  };

  const updateSort = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set("sort", val);
    } else {
      params.delete("sort");
    }
    router.push(withLocalePath(`/explore?${params.toString()}`));
  };

  useEffect(() => {
    let isMounted = true;
    const fetchSurveys = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/surveys/public?limit=100&offset=0", {
          cache: "no-store",
        });
        if (!response.ok) {
          if (isMounted) {
            setSurveys([]);
          }
          return;
        }
        const payload = await response.json();
        if (isMounted) {
          setSurveys(payload.surveys || []);
        }
      } catch (error) {
        console.error("Failed to load surveys:", error);
        if (isMounted) {
          setSurveys([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSurveys();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSurveys = useMemo(() => {
    const filtered = surveys.filter((survey) => {
      const matchesSearch =
        survey.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        survey.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "points-high":
          return (
            surveyBasePoints +
            Math.floor((b.pointsReward || 0) / 3) -
            (surveyBasePoints + Math.floor((a.pointsReward || 0) / 3))
          )
        case "recommended":
        default:
          return 0;
      }
    });
  }, [searchQuery, sort, surveys, surveyBasePoints]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="container px-4 py-12 md:px-6 md:py-16">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              {t("title")}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                {t("titleHighlight")}
              </span>
            </h1>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">{t("description")}</p>
          </div>
        </div>
      </div>

      <section className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 dark:bg-gray-900/80 dark:border-gray-800">
        <div className="container px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-lg w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder={t("searchPlaceholder")}
                className="pl-10 bg-gray-50 border-gray-200 focus-visible:ring-purple-500 dark:bg-gray-800 dark:border-gray-700 w-full"
                defaultValue={searchQuery}
                onChange={(e) => updateSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <Select value={sort} onValueChange={updateSort}>
                <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-gray-900">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-3.5 w-3.5 text-gray-500" />
                    <SelectValue placeholder={t("sortPlaceholder")} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">{t("sortRecommended")}</SelectItem>
                  <SelectItem value="newest">{t("sortNewest")}</SelectItem>
                  <SelectItem value="points-high">{t("sortPointsHigh")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <div className="container px-4 py-8 md:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!loading &&
            filteredSurveys.map((survey) => (
              <SurveyCard
                key={survey.id}
                id={survey.id}
                title={survey.title}
                description={survey.description}
                points={surveyBasePoints + Math.floor((survey.pointsReward || 0) / 3)}
                responses={survey.responseCount}
                visibility={survey.visibility}
                locale={locale}
              />
            ))}
          {!loading && filteredSurveys.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500">{t("noSurveys")}</div>
          )}
          {loading && (
            <div className="col-span-full py-12 text-center text-gray-500">{t("checkBackLater")}</div>
          )}
        </div>

        {!loading && filteredSurveys.length > 0 && (
          <div className="mt-12 flex justify-center">
            <Button variant="outline" size="lg" className="min-w-[200px]">
              {t("loadMore")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}

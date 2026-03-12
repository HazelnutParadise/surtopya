"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Download, Search, Globe, Lock } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTimeZone, useTranslations } from "next-intl";
import type { Dataset } from "@/lib/api";
import { MotionReveal, PageMotionShell } from "@/components/motion";
import { formatUtcDateOnly } from "@/lib/date-time";

const CATEGORY_SLUGS = [
  "all",
  "market-research",
  "social-science",
  "consumer-goods",
  "technology",
  "healthcare",
  "finance",
  "other",
];

const PAGE_SIZE = 6;

const normalizeCategory = (category: string) => {
  if (!category) return "other";
  return category.toLowerCase().replace(/\s+/g, "-");
};

function DatasetsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const timeZone = useTimeZone()
  const withLocalePath = (href: string) => withLocale(href, locale);
  const tDatasets = useTranslations("Datasets");
  const tCategories = useTranslations("Categories");
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const datasetsEndpoint = publicApiUrl ? `${publicApiUrl}/datasets` : "";

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") || "all");
  const [sortBy, setSortBy] = useState<"newest" | "downloads" | "samples">(
    (searchParams.get("sort") as "newest" | "downloads" | "samples") || "newest"
  );
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const getCategoryLabel = (slug: string) => (slug === "all" ? tDatasets("allCategories") : tCategories(slug));

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (activeCategory && activeCategory !== "all") params.set("category", activeCategory);
    if (sortBy !== "newest") params.set("sort", sortBy);

    const newQuery = params.toString();
    const currentQuery = searchParams.toString();

    if (newQuery !== currentQuery) {
      const url = newQuery ? `${pathname}?${newQuery}` : pathname;
      router.replace(url, { scroll: false });
    }
  }, [searchTerm, activeCategory, sortBy, pathname, router, searchParams]);

  useEffect(() => {
    setOffset(0);
    setTotalCount(0);
  }, [searchTerm, activeCategory, sortBy]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchDatasets = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.set("search", searchTerm);
        if (activeCategory && activeCategory !== "all") params.set("category", activeCategory);
        if (sortBy) params.set("sort", sortBy);
        params.set("limit", PAGE_SIZE.toString());
        params.set("offset", offset.toString());

        const response = await fetch(`/api/app/datasets?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (isMounted) {
            if (offset === 0) {
              setDatasets([]);
            }
            setHasMore(false);
          }
          return;
        }
        const payload = await response.json();
        const items = payload.datasets || [];
        const nextHasMore = items.length === PAGE_SIZE;
        const rawTotal = Number(payload?.meta?.total);
        const hasMetaTotal = Number.isFinite(rawTotal) && rawTotal >= 0;

        if (isMounted) {
          if (offset === 0) {
            setDatasets(items);
          } else {
            setDatasets((prev) => [...prev, ...items]);
          }
          setHasMore(nextHasMore);

          if (hasMetaTotal) {
            setTotalCount(Math.floor(rawTotal));
          } else {
            const fallbackTotal = offset + items.length + (nextHasMore ? 1 : 0);
            setTotalCount((prev) => Math.max(prev, fallbackTotal));
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load datasets:", error);
          if (offset === 0) {
            setDatasets([]);
            setTotalCount(0);
          }
          setHasMore(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDatasets();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [activeCategory, offset, searchTerm, sortBy]);

  const displayDatasets = [...datasets].sort((a, b) => {
    switch (sortBy) {
      case "downloads":
        return b.downloadCount - a.downloadCount;
      case "samples":
        return b.sampleSize - a.sampleSize;
      case "newest":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return (
    <PageMotionShell className="effect-readable-page min-h-screen bg-transparent">
      <div className="bg-black text-white py-16 md:py-24">
        <MotionReveal className="container px-4 md:px-6" delayMs={40}>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {tDatasets("heroTitle")}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
                {tDatasets("heroTitleHighlight")}
              </span>
            </h1>
            <p className="text-xl text-gray-400">{tDatasets("heroDescription")}</p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Button
                className="transform-gpu bg-white text-black hover:bg-gray-100 font-semibold shadow-xl shadow-white/5 transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
                onClick={() => {
                  document.getElementById("dataset-list")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Database className="mr-2 h-4 w-4" /> {tDatasets("browseDatasets")}
              </Button>
              <Button
                variant="outline"
                className="transform-gpu border-white/35 bg-white/20 text-white hover:bg-white/30 hover:text-white shadow-xl transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
                asChild
              >
                <Link href={withLocalePath("/datasets/api")}>{tDatasets("apiDocs")}</Link>
              </Button>
            </div>
          </div>
        </MotionReveal>
      </div>

      <MotionReveal id="dataset-list" className="container px-4 py-12 md:px-6" delayMs={90}>
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 space-y-8">
            <MotionReveal>
              <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">{tDatasets("searchTitle")}</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={tDatasets("searchPlaceholder")}
                  className="bg-white pl-10 shadow-sm dark:bg-gray-900 dark:border-gray-700"
                  value={searchTerm}
                  data-testid="datasets-search"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              </div>
            </MotionReveal>

            <MotionReveal delayMs={60}>
              <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">{tDatasets("categoryTitle")}</h3>
              <div className="space-y-2">
                {CATEGORY_SLUGS.map((slug) => (
                  <Button
                    key={slug}
                    variant={activeCategory === slug ? "secondary" : "ghost"}
                    className={`w-full justify-start ${
                      activeCategory === slug
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200"
                        : "bg-white text-gray-700 shadow-sm dark:bg-gray-900 dark:text-gray-300 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/60"
                    }`}
                    onClick={() => setActiveCategory(slug)}
                    data-testid={`datasets-category-${slug}`}
                  >
                    {getCategoryLabel(slug)}
                  </Button>
                ))}
              </div>
              </div>
            </MotionReveal>

            <MotionReveal delayMs={90} className="rounded-xl border border-purple-100 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/80">
              <h4 className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2">
                <Globe className="h-4 w-4" /> {tDatasets("openDatasetNoticeTitle")}
              </h4>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-2 leading-relaxed">
                {tDatasets("openDatasetNoticeText")}
              </p>
            </MotionReveal>

            {datasetsEndpoint && (
              <MotionReveal delayMs={120} className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  {tDatasets("apiDocs")}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                  {tDatasets("endpointLabel", { url: datasetsEndpoint })}
                </p>
              </MotionReveal>
            )}
          </aside>

          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between pb-4">
              <div className="text-sm text-gray-500">
                {tDatasets("showingResults", { shown: displayDatasets.length, total: totalCount })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 uppercase font-medium">{tDatasets("sortLabel")}</span>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as "newest" | "downloads" | "samples")}>
                  <SelectTrigger className="h-8 w-[180px] bg-white text-sm font-medium shadow-sm dark:bg-gray-900 dark:border-gray-700" data-testid="datasets-sort">
                    <SelectValue placeholder={tDatasets("sortLabel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{tDatasets("newest")}</SelectItem>
                    <SelectItem value="downloads">{tDatasets("mostDownloads")}</SelectItem>
                    <SelectItem value="samples">{tDatasets("mostSamples")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {displayDatasets.map((ds, index) => {
                const normalizedCategory = normalizeCategory(ds.category);
                const isPaid = ds.accessType === "paid";

                return (
                  <MotionReveal key={ds.id} delayMs={index * 40}>
                    <Card
                      className="group overflow-hidden border-0 bg-white shadow-lg ring-1 ring-gray-200 transition-all duration-300 ease-out hover:-translate-y-1 hover:ring-purple-500/50 dark:bg-gray-900 dark:ring-gray-800"
                      data-testid={`dataset-card-${ds.id}`}
                    >
                      <Link href={withLocalePath(`/datasets/${ds.id}`)} className="block">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-xl group-hover:text-purple-600 transition-colors flex items-center gap-2 cursor-pointer">
                                {ds.title}
                                {isPaid && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-5 bg-amber-50 text-amber-600 border-amber-200 gap-1 ml-1 px-1.5 cursor-pointer"
                                  >
                                    <Lock className="h-2.5 w-2.5" /> {tDatasets("paidBadge")}
                                  </Badge>
                                )}
                              </CardTitle>
                              <CardDescription className="line-clamp-2 mt-1">{ds.description}</CardDescription>
                            </div>
                            <Badge variant="secondary" className="border-0 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                              {getCategoryLabel(normalizedCategory)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-6 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-purple-500" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {tDatasets("samplesLabel", { count: ds.sampleSize })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Download className="h-4 w-4 text-purple-500" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {tDatasets("downloadsLabel", { count: ds.downloadCount })}
                              </span>
                            </div>
                            <div className="md:ml-auto">
                              {tDatasets("updatedLabel", {
                                date: formatUtcDateOnly(ds.updatedAt, { locale, timeZone }),
                              })}
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="border-t bg-gray-50 py-3 dark:border-gray-800 dark:bg-gray-900">
                          <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-wider text-purple-600">
                            <span>{tDatasets("viewDetails")}</span>
                          </div>
                        </CardFooter>
                      </Link>
                    </Card>
                  </MotionReveal>
                );
              })}
            </div>

            {hasMore && !loading && (
              <div className="flex justify-center pt-8">
                <Button
                  variant="ghost"
                  className="text-gray-500 hover:text-purple-600 transform-gpu transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
                  onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                  data-testid="datasets-load-more"
                >
                  {tDatasets("loadMore")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </MotionReveal>
    </PageMotionShell>
  );
}

export default function DatasetsPage() {
  const tCommon = useTranslations("Common");
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="animate-pulse text-purple-600 font-medium">{tCommon("loading")}</div>
        </div>
      }
    >
      <DatasetsContent />
    </Suspense>
  );
}

function Users({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

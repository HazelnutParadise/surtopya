"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Download, Search, Globe, Lock } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTranslations } from "next-intl";
import type { Dataset } from "@/lib/api";

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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function DatasetsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const withLocalePath = (href: string) => withLocale(href, locale);
  const tDatasets = useTranslations("Datasets");
  const tCategories = useTranslations("Categories");

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") || "all");
  const [sortBy, setSortBy] = useState<"newest" | "downloads" | "samples">(
    (searchParams.get("sort") as "newest" | "downloads" | "samples") || "newest"
  );
  const [datasets, setDatasets] = useState<Dataset[]>([]);
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

        const response = await fetch(`/api/datasets?${params.toString()}`, {
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

        if (isMounted) {
          if (offset === 0) {
            setDatasets(items);
          } else {
            setDatasets((prev) => [...prev, ...items]);
          }
          setHasMore(items.length === PAGE_SIZE);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load datasets:", error);
          if (offset === 0) {
            setDatasets([]);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-black text-white py-16 md:py-24">
        <div className="container px-4 md:px-6">
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
                className="bg-white text-black hover:bg-gray-100 font-semibold shadow-xl shadow-white/5 transition-all"
                onClick={() => {
                  document.getElementById("dataset-list")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Database className="mr-2 h-4 w-4" /> {tDatasets("browseDatasets")}
              </Button>
              <Button
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm shadow-xl transition-all"
              >
                {tDatasets("apiDocs")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div id="dataset-list" className="container px-4 py-12 md:px-6">
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 space-y-8">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">{tDatasets("searchTitle")}</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={tDatasets("searchPlaceholder")}
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">{tDatasets("categoryTitle")}</h3>
              <div className="space-y-2">
                {CATEGORY_SLUGS.map((slug) => (
                  <Button
                    key={slug}
                    variant={activeCategory === slug ? "secondary" : "ghost"}
                    className={`w-full justify-start ${
                      activeCategory === slug
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                        : "text-gray-600 dark:text-gray-400 hover:text-purple-600"
                    }`}
                    onClick={() => setActiveCategory(slug)}
                  >
                    {getCategoryLabel(slug)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800">
              <h4 className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2">
                <Globe className="h-4 w-4" /> {tDatasets("openDatasetNoticeTitle")}
              </h4>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-2 leading-relaxed">
                {tDatasets("openDatasetNoticeText")}
              </p>
            </div>
          </aside>

          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between pb-4">
              <div className="text-sm text-gray-500">
                {tDatasets("showingResults", { shown: displayDatasets.length, total: displayDatasets.length })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 uppercase font-medium">{tDatasets("sortLabel")}</span>
                <select
                  className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "newest" | "downloads" | "samples")}
                >
                  <option value="newest">{tDatasets("newest")}</option>
                  <option value="downloads">{tDatasets("mostDownloads")}</option>
                  <option value="samples">{tDatasets("mostSamples")}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {displayDatasets.map((ds) => {
                const normalizedCategory = normalizeCategory(ds.category);
                const isPaid = ds.accessType === "paid";

                return (
                  <Card
                    key={ds.id}
                    className="group overflow-hidden border-0 shadow-lg ring-1 ring-gray-200 dark:ring-gray-800 hover:ring-purple-500/50 transition-all duration-300"
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
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0"
                          >
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
                            {tDatasets("updatedLabel", { date: formatDate(ds.updatedAt) })}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="bg-gray-50 dark:bg-gray-900/50 py-3 border-t dark:border-gray-800">
                        <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-wider text-purple-600">
                          <span>{tDatasets("viewDetails")}</span>
                        </div>
                      </CardFooter>
                    </Link>
                  </Card>
                );
              })}
            </div>

            {hasMore && !loading && (
              <div className="flex justify-center pt-8">
                <Button
                  variant="ghost"
                  className="text-gray-500 hover:text-purple-600"
                  onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                >
                  {tDatasets("loadMore")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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

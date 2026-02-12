"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Download, Globe, ChevronLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTranslations } from "next-intl";
import type { Dataset } from "@/lib/api";
import { filenameFromContentDisposition, sanitizeFilename } from "@/lib/download";

interface DatasetDetailClientProps {
  id: string;
}

const normalizeCategory = (category: string) => {
  if (!category) return "other";
  return category.toLowerCase().replace(/\s+/g, "-");
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export function DatasetDetailClient({ id }: DatasetDetailClientProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const withLocalePath = (href: string) => withLocale(href, locale);
  const tDatasets = useTranslations("Datasets");
  const tCommon = useTranslations("Common");
  const tCategories = useTranslations("Categories");

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchDataset = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/datasets/${id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (isMounted) {
            setDataset(null);
          }
          return;
        }
        const payload = await response.json();
        if (isMounted) {
          setDataset(payload || null);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load dataset:", error);
          setDataset(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDataset();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [id]);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null)
    try {
      const response = await fetch(`/api/datasets/${id}`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Download failed");
      }

      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        // Some backends may respond JSON success envelopes; treat as non-download.
        return
      }

      const blob = await response.blob()
      const disposition = response.headers.get("content-disposition") || ""
      const filename =
        filenameFromContentDisposition(disposition) ??
        sanitizeFilename(dataset?.fileName || "dataset")

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Download failed:", error);
      setDownloadError(error instanceof Error ? error.message : tCommon("error"))
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="animate-pulse text-purple-600 font-medium">{tCommon("loading")}</div>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold mb-4">{tDatasets("notFound")}</h2>
        <Button asChild>
          <Link href={withLocalePath("/datasets")}>{tDatasets("backToMarketplace")}</Link>
        </Button>
      </div>
    );
  }

  const categorySlug = normalizeCategory(dataset.category);
  const isPaid = dataset.accessType === "paid";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <div className="container px-4 py-6 md:px-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={withLocalePath("/datasets")}>
            <ChevronLeft className="mr-2 h-4 w-4" /> {tCommon("back")}
          </Link>
        </Button>
      </div>

      <div className="bg-white border-b dark:bg-gray-900 dark:border-gray-800">
        <div className="container px-4 py-8 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {tCategories(categorySlug)}
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{dataset.title}</h1>
              <p className="text-lg text-gray-500 dark:text-gray-400">{dataset.description}</p>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-600" />
                  <span className="font-bold">{tDatasets("sampleSizeLabel", { count: dataset.sampleSize })}</span>
                </div>
                <div className={`flex items-center gap-2 ${isPaid ? "text-amber-600" : "text-emerald-600"}`}>
                  {isPaid ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  {isPaid ? tDatasets("paidAccess") : tDatasets("publicAccess")}
                </div>
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-purple-600" />
                  {tDatasets("downloadsLabel", { count: dataset.downloadCount })}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30 font-semibold h-11 px-8"
                onClick={handleDownload}
                disabled={downloading}
              >
                <Download className="mr-2 h-4 w-4" strokeWidth={2.5} />
                {tDatasets("download")}
              </Button>
              {downloadError ? (
                <p data-testid="dataset-download-error" className="text-sm text-red-600">
                  {downloadError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 py-10 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="prose dark:prose-invert max-w-none">
              <h3 className="text-xl font-bold">{tDatasets("about")}</h3>
              <p>{dataset.description}</p>
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{tDatasets("metadata")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{tDatasets("category")}</span>
                  <span className="font-medium">{tCategories(categorySlug)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{tDatasets("sampleSize")}</span>
                  <span className="font-medium">{dataset.sampleSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{tDatasets("downloads")}</span>
                  <span className="font-medium">{dataset.downloadCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{tDatasets("created")}</span>
                  <span className="font-medium">{formatDate(dataset.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{tDatasets("updated")}</span>
                  <span className="font-medium">{formatDate(dataset.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { DatasetDetailClient } from "./dataset-detail-client";
import { getServerTranslator } from "@/lib/i18n-server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DatasetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tCommon = await getServerTranslator("Common");

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-pulse text-purple-600 font-medium">{tCommon("loading")}</div>
      </div>
    }>
      <DatasetDetailClient id={id} />
    </Suspense>
  );
}

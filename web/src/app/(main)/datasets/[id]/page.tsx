import { Suspense } from "react";
import { DatasetDetailClient } from "./dataset-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DatasetDetailPage({ params }: PageProps) {
  const { id } = await params;
  
  // This is a Server Component, so process.env reads from the environment at runtime in Docker
  const API_URL = process.env.PUBLIC_API_URL || "https://api.surtopya.com";

  return (
    <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-pulse text-purple-600 font-medium">Loading Dataset Details...</div>
      </div>
    }>
      <DatasetDetailClient id={id} apiUrl={API_URL} />
    </Suspense>
  );
}

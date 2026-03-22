import { NextResponse } from "next/server"
import { buildDatasetsOpenApiSpec } from "@/lib/datasets-openapi"

export const dynamic = "force-dynamic"

export async function GET() {
  const spec = buildDatasetsOpenApiSpec()

  return NextResponse.json(spec)
}


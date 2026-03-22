import { NextResponse } from "next/server"
import { buildDatasetsOpenApiSpec } from "@/lib/datasets-openapi"

export const dynamic = "force-dynamic"

export async function GET() {
  const publicApiUrl =
    process.env.PUBLIC_API_URL ||
    process.env.INTERNAL_API_URL ||
    "http://localhost:8080/v1"
  const spec = buildDatasetsOpenApiSpec({ publicApiUrl })

  return NextResponse.json(spec)
}


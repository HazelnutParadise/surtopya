import { fetchInternalApp } from "@/lib/internal-app-fetch"
import { NextResponse } from "next/server"

const DEFAULT_SURVEY_BASE_POINTS = 1

export async function GET() {
  const response = await fetchInternalApp(`/config`, { cache: "no-store" })
  if (!response.ok) {
    return NextResponse.json({
      surveyBasePoints: DEFAULT_SURVEY_BASE_POINTS,
    })
  }

  const payload = await response.json().catch(() => ({}))
  const raw = Number(payload?.surveyBasePoints)
  const surveyBasePoints =
    Number.isFinite(raw) && raw >= 0
      ? Math.floor(raw)
      : DEFAULT_SURVEY_BASE_POINTS

  return NextResponse.json({ surveyBasePoints })
}

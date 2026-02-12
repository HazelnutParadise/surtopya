import { NextResponse } from "next/server"

const parseIntEnv = (key: string, def: number) => {
  const raw = (process.env[key] || "").trim()
  if (!raw) return def
  const v = Number.parseInt(raw, 10)
  return Number.isFinite(v) ? v : def
}

export async function GET() {
  return NextResponse.json({
    surveyBasePoints: parseIntEnv("SURVEY_BASE_POINTS", 0),
  })
}


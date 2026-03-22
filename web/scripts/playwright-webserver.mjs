import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"

const port = Number(process.env.PLAYWRIGHT_PORT || 3100)
const skipBuild = process.env.PLAYWRIGHT_SKIP_BUILD === "true"

// Avoid noisy server errors during E2E runs when auth env isn't configured.
// The app should treat unauthenticated users as unauthenticated in tests.
const envDefaults = {
  LOGTO_ENDPOINT: "http://localhost:9999",
  LOGTO_APP_ID: "test-app-id",
  LOGTO_APP_SECRET: "test-app-secret",
  LOGTO_COOKIE_SECRET: "test-cookie-secret",
}
for (const [key, value] of Object.entries(envDefaults)) {
  if (!process.env[key]) {
    process.env[key] = value
  }
}

const mockApiEnabled = process.env.PLAYWRIGHT_MOCK_API === "true"
if (mockApiEnabled) {
  const mockApiPort = Number(process.env.PLAYWRIGHT_MOCK_API_PORT || 9100)
  const baseUrl = `http://localhost:${mockApiPort}/v1`

  if (!process.env.INTERNAL_API_URL) {
    process.env.INTERNAL_API_URL = baseUrl
  }
  if (!process.env.PUBLIC_API_URL) {
    process.env.PUBLIC_API_URL = baseUrl
  }

  const json = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })

  const mockSurvey = (surveyId) => ({
    id: surveyId,
    userId: "publisher-1",
    title: "Mock Survey",
    description: "Mock survey used for Playwright E2E.",
    visibility: "public",
    isPublished: true,
    isResponseOpen: true,
    includeInDatasets: true,
    everPublic: true,
    publishedCount: 1,
    currentPublishedVersionNumber: 1,
    hasUnpublishedChanges: false,
    theme: { primaryColor: "#7c3aed", backgroundColor: "#ffffff", fontFamily: "inter" },
    pointsReward: 9,
    expiresAt: null,
    responseCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    questions: [
      {
        id: "q1",
        type: "short",
        title: "Your name",
        required: true,
      },
    ],
  })

  const server = Bun.serve({
    port: mockApiPort,
    fetch(request) {
      const url = new URL(request.url)
      const { pathname } = url

      if (request.method === "GET" && pathname === "/v1/me") {
        return json(200, {
          id: "me",
          email: "me@example.com",
          displayName: "Me",
          pointsBalance: 0,
          membershipTier: "free",
          capabilities: {},
          isAdmin: false,
          isSuperAdmin: false,
          locale: "en",
          createdAt: new Date().toISOString(),
          surveysCompleted: 0,
        })
      }

      const surveyMatch = pathname.match(/^\/v1\/surveys\/([^/]+)$/)
      if (request.method === "GET" && surveyMatch) {
        const surveyId = surveyMatch[1]
        return json(200, mockSurvey(surveyId))
      }

      const startMatch = pathname.match(/^\/v1\/surveys\/([^/]+)\/responses\/start$/)
      if (request.method === "POST" && startMatch) {
        const surveyId = startMatch[1]
        return json(201, {
          id: "resp-1",
          surveyId,
          status: "in_progress",
          startedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        })
      }

      const submitMatch = pathname.match(/^\/v1\/responses\/([^/]+)\/submit$/)
      if (request.method === "POST" && submitMatch) {
        const responseId = submitMatch[1]
        return json(200, {
          id: responseId,
          status: "completed",
          pointsAwarded: 6,
        })
      }

      return json(404, { error: "not_found" })
    },
  })

  console.log(`[playwright-webserver] Mock API listening on ${server.url}`)
}

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: false })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`))
    })
  })

const exists = async (p) => {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

const getLatestMtimeMs = async (dir) => {
  if (!(await exists(dir))) return 0

  let latest = 0
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "test-results" ||
        entry.name === "playwright-report"
      ) {
        continue
      }

      latest = Math.max(latest, await getLatestMtimeMs(fullPath))
      continue
    }

    if (entry.isFile()) {
      const stat = await fs.stat(fullPath)
      latest = Math.max(latest, stat.mtimeMs)
    }
  }

  return latest
}

const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID")
const hasBuild = await exists(buildIdPath)
const buildMtimeMs = hasBuild ? (await fs.stat(buildIdPath)).mtimeMs : 0

// Even if PLAYWRIGHT_SKIP_BUILD=true, avoid serving a stale `.next` build.
const sourceRoots = ["src", "messages", "scripts"].map((dir) => path.join(process.cwd(), dir))
let sourcesMtimeMs = 0
for (const dir of sourceRoots) {
  sourcesMtimeMs = Math.max(sourcesMtimeMs, await getLatestMtimeMs(dir))
}

const shouldBuild = !skipBuild || !hasBuild || sourcesMtimeMs > buildMtimeMs
if (shouldBuild) {
  if (skipBuild) {
    console.log("[playwright-webserver] Sources are newer than .next. Rebuilding...")
  }
  await run("bun", ["run", "build"])
}

// Keep the process alive as the web server entrypoint for Playwright.
await run("bun", ["run", "start", "--", "--port", String(port)])


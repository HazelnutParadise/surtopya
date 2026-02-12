import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_PORT || 3100)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `bun scripts/playwright-webserver.mjs`,
    url: baseURL,
    // Default to deterministic runs (avoid accidentally reusing a Docker-exposed port).
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
    timeout: 120_000,
    env: {
      PLAYWRIGHT_MOCK_API: process.env.PLAYWRIGHT_MOCK_API ?? "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})

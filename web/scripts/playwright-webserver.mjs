import { spawn } from "node:child_process"

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

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: false })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`))
    })
  })

if (!skipBuild) {
  await run("bun", ["run", "build"])
}

// Keep the process alive as the web server entrypoint for Playwright.
await run("bun", ["run", "start", "--", "--port", String(port)])

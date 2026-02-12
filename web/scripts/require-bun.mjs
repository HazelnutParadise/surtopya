const ua = process.env.npm_config_user_agent || ""
const hasBunUA = ua.toLowerCase().includes("bun/")
const isBunRuntime = Boolean(process?.versions?.bun)

// Enforce Bun-only installs. This prevents accidental `npm install` / `pnpm install` / `yarn`.
if (ua && !hasBunUA) {
  console.error(`This repo uses Bun. Detected user agent: ${ua}`)
  console.error(`Use: bun install`)
  process.exit(1)
}

if (!isBunRuntime) {
  console.error(`This repo uses Bun. Run installs with: bun install`)
  process.exit(1)
}


import fs from "fs"
import path from "path"

const baseDir = path.join(process.cwd(), "messages")
const locales = ["zh-TW", "en", "ja"]

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"))

const flatten = (obj, prefix = "") => {
  const entries = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      entries.push(...flatten(v, key))
    } else {
      entries.push([key, v])
    }
  }
  return entries
}

const data = Object.fromEntries(
  locales.map((l) => [l, readJson(path.join(baseDir, `${l}.json`))])
)
const maps = Object.fromEntries(locales.map((l) => [l, new Map(flatten(data[l]))]))

const allKeys = new Set(locales.flatMap((l) => [...maps[l].keys()]))

let failed = false

for (const l of locales) {
  const missing = [...allKeys].filter((k) => !maps[l].has(k))
  if (missing.length > 0) {
    failed = true
    console.error(`Missing keys in ${l}: ${missing.length}`)
    console.error(missing.slice(0, 50).join("\n"))
  }
}

const todoPattern = /\[TODO\]|TODO|TBD/
for (const l of locales) {
  const todos = [...maps[l].entries()].filter(
    ([, v]) => typeof v === "string" && todoPattern.test(v)
  )
  if (todos.length > 0) {
    failed = true
    console.error(`TODO-like strings in ${l}: ${todos.length}`)
    console.error(todos.slice(0, 50).map(([k, v]) => `${k} => ${v}`).join("\n"))
  }
}

if (failed) process.exit(1)
console.log("i18n check passed")


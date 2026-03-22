import fs from "fs"
import path from "path"
import ts from "typescript"

const baseDir = path.join(process.cwd(), "messages")
const sourceDir = path.join(process.cwd(), "src")
const allowlistPath = path.join(process.cwd(), "scripts", "i18n-allowlist.json")
const locales = ["zh-TW", "en", "ja"]

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")
  return JSON.parse(raw)
}

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

const collectSourceFiles = (dir) => {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist"].includes(entry.name)) continue
    const filePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(filePath))
      continue
    }

    const normalized = filePath.replace(/\\/g, "/")
    if (normalized.includes("/__tests__/")) continue
    if (normalized.includes("/e2e/")) continue
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue

    out.push(filePath)
  }
  return out
}

const toScriptKind = (filePath) => {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX
  return ts.ScriptKind.JS
}

const unwrapExpression = (node) => {
  let current = node
  while (current) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression
      continue
    }
    if (
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current)
    ) {
      current = current.expression
      continue
    }
    return current
  }
  return current
}

const getLiteralText = (node) => {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  return null
}

const getNamespaceFromTranslatorCall = (callNode) => {
  const callee = unwrapExpression(callNode.expression)
  if (!ts.isIdentifier(callee)) return null
  if (callee.text !== "useTranslations" && callee.text !== "getServerTranslator") return null
  return getLiteralText(callNode.arguments[0])
}

const getNamespaceFromInitializer = (initializer) => {
  const normalized = unwrapExpression(initializer)
  if (!normalized) return null

  if (ts.isAwaitExpression(normalized)) {
    return getNamespaceFromInitializer(normalized.expression)
  }

  if (ts.isCallExpression(normalized)) {
    return getNamespaceFromTranslatorCall(normalized)
  }

  return null
}

const scanUsedStaticKeys = () => {
  const usedStaticKeys = new Set()
  const dynamicCalls = []
  const files = collectSourceFiles(sourceDir)

  for (const filePath of files) {
    const sourceText = fs.readFileSync(filePath, "utf8")
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      toScriptKind(filePath)
    )

    const translators = new Map()

    const collectTranslators = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const namespace = getNamespaceFromInitializer(node.initializer)
        if (namespace) {
          translators.set(node.name.text, namespace)
        }
      }
      ts.forEachChild(node, collectTranslators)
    }

    collectTranslators(sourceFile)

    const collectKeys = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = unwrapExpression(node.expression)

        if (ts.isIdentifier(callee) && translators.has(callee.text)) {
          const namespace = translators.get(callee.text)
          const key = getLiteralText(node.arguments[0])
          if (key) {
            usedStaticKeys.add(`${namespace}.${key}`)
          } else if (node.arguments.length > 0) {
            dynamicCalls.push({
              file: filePath,
              namespace,
              expression: node.getText(sourceFile).slice(0, 160),
            })
          }
        }

        const possibleTranslatorCall = ts.isAwaitExpression(callee)
          ? unwrapExpression(callee.expression)
          : callee

        if (ts.isCallExpression(possibleTranslatorCall)) {
          const namespace = getNamespaceFromTranslatorCall(possibleTranslatorCall)
          const key = getLiteralText(node.arguments[0])
          if (namespace && key) {
            usedStaticKeys.add(`${namespace}.${key}`)
          } else if (namespace && node.arguments.length > 0) {
            dynamicCalls.push({
              file: filePath,
              namespace,
              expression: node.getText(sourceFile).slice(0, 160),
            })
          }
        }
      }

      ts.forEachChild(node, collectKeys)
    }

    collectKeys(sourceFile)
  }

  return { usedStaticKeys, dynamicCalls }
}

const data = Object.fromEntries(locales.map((l) => [l, readJson(path.join(baseDir, `${l}.json`))]))
const maps = Object.fromEntries(locales.map((l) => [l, new Map(flatten(data[l]))]))
const allKeys = new Set(locales.flatMap((l) => [...maps[l].keys()]))

const allowlist = readJson(allowlistPath)
const intentionalSameAsZh = new Set(allowlist.intentional_same_as_zh || [])
const runtimeDynamicKeys = new Set(allowlist.runtime_dynamic_keys || [])

const { usedStaticKeys, dynamicCalls } = scanUsedStaticKeys()

let failed = false

for (const l of locales) {
  const missing = [...allKeys].filter((k) => !maps[l].has(k)).sort()
  if (missing.length > 0) {
    failed = true
    console.error(`Missing keys in ${l}: ${missing.length}`)
    console.error(missing.slice(0, 50).join("\n"))
  }
}

const todoPattern = /\[TODO\]|TODO|TBD/
for (const l of locales) {
  const todos = [...maps[l].entries()].filter(([, v]) => typeof v === "string" && todoPattern.test(v))
  if (todos.length > 0) {
    failed = true
    console.error(`TODO-like strings in ${l}: ${todos.length}`)
    console.error(todos.slice(0, 50).map(([k, v]) => `${k} => ${v}`).join("\n"))
  }
}

const zhMap = maps["zh-TW"]
for (const l of locales.filter((locale) => locale !== "zh-TW")) {
  const sameAsZh = [...maps[l].entries()]
    .filter(([k, v]) => typeof v === "string" && zhMap.get(k) === v && !intentionalSameAsZh.has(k))
    .map(([k]) => k)
    .sort()

  if (sameAsZh.length > 0) {
    failed = true
    console.error(`Likely untranslated keys in ${l} (same as zh-TW): ${sameAsZh.length}`)
    console.error(sameAsZh.slice(0, 50).join("\n"))
  }
}

const staleAllowlist = [...new Set([...intentionalSameAsZh, ...runtimeDynamicKeys])]
  .filter((k) => !allKeys.has(k))
  .sort()
if (staleAllowlist.length > 0) {
  failed = true
  console.error(`Stale allowlist keys (not found in messages): ${staleAllowlist.length}`)
  console.error(staleAllowlist.slice(0, 50).join("\n"))
}

const unusedKeys = [...allKeys]
  .filter((k) => !usedStaticKeys.has(k) && !runtimeDynamicKeys.has(k))
  .sort()

if (unusedKeys.length > 0) {
  failed = true
  console.error(`Unused i18n keys: ${unusedKeys.length}`)
  console.error(unusedKeys.slice(0, 80).join("\n"))
}

if (failed) process.exit(1)

console.log("i18n check passed")
console.log(`Scanned static keys: ${usedStaticKeys.size}`)
console.log(`Runtime dynamic allowlist keys: ${runtimeDynamicKeys.size}`)
if (dynamicCalls.length > 0) {
  console.log(`Detected non-literal translator calls: ${dynamicCalls.length}`)
}

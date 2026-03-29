const UUID_V4_TEMPLATE = "10000000-1000-4000-8000-100000000000"

const toHex = (value: number) => value.toString(16)

const generateFallbackUUID = () => {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-")
  }

  return UUID_V4_TEMPLATE.replace(/[018]/g, (char) => {
    const randomNibble = Math.floor(Math.random() * 16)
    const value = Number(char)
    return toHex(value ^ ((randomNibble & 15) >> (value / 4)))
  })
}

export const generateClientUUID = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  return generateFallbackUUID()
}

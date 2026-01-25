import { getAccessToken, getLogtoContext } from "@logto/next/server-actions"
import { getLogtoConfig } from "@/lib/logto"

export const API_BASE_URL = process.env.PUBLIC_API_URL || "http://localhost:8080/api/v1"

export const getAuthToken = async () => {
  try {
    const config = getLogtoConfig()
    const context = await getLogtoContext(config)
    if (!context.isAuthenticated) {
      return null
    }
    return getAccessToken(config)
  } catch (error) {
    console.error("Logto config error:", error)
    return null
  }
}

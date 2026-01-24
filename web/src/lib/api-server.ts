import { getAccessToken, getLogtoContext } from "@logto/next/server-actions"
import { logtoConfig } from "@/lib/logto"

export const API_BASE_URL = process.env.PUBLIC_API_URL || "http://localhost:8080/api/v1"

export const getAuthToken = async () => {
  const context = await getLogtoContext(logtoConfig)
  if (!context.isAuthenticated) {
    return null
  }
  return getAccessToken(logtoConfig)
}

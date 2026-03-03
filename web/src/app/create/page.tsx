"use client"

import { SurveyBuilder } from "@/components/builder/survey-builder"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AuthStatus = "loading" | "authenticated" | "unauthenticated"

export default function CreatePage() {
  const tBuilder = useTranslations("SurveyBuilder")
  const tCommon = useTranslations("Common")
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading")

  useEffect(() => {
    let isMounted = true

    const loadAuthState = async () => {
      try {
        const response = await fetch("/api/me?optional=1", { cache: "no-store" })
        if (!response.ok) {
          if (isMounted) setAuthStatus("unauthenticated")
          return
        }

        const payload = await response.json()
        if (!isMounted) return
        setAuthStatus(payload ? "authenticated" : "unauthenticated")
      } catch {
        if (isMounted) setAuthStatus("unauthenticated")
      }
    }

    loadAuthState()
    return () => {
      isMounted = false
    }
  }, [])

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-purple-600 font-medium">{tCommon("loading")}</div>
      </div>
    )
  }

  if (authStatus !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-lg w-full border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800">
          <CardHeader>
            <CardTitle>{tBuilder("authRequiredTitle")}</CardTitle>
            <CardDescription>{tBuilder("authRequiredDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
              <a href="/api/logto/sign-in">{tBuilder("authRequiredAction")}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <SurveyBuilder />
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Gift } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTranslations } from "next-intl";
import {
  clearAnonymousClaimContext,
  readActiveAnonymousClaimContext,
  type AnonymousClaimContext,
} from "@/lib/anonymous-claim";
import type { UserProfile } from "@/lib/api";
import { notifyPointsBalanceChanged } from "@/lib/points-balance-events";
import { resolveUiError, toUiErrorMessage } from "@/lib/ui-error";

const alreadySubmittedCode = "ALREADY_SUBMITTED"

export default function ThankYouPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams()
  const locale = getLocaleFromPath(pathname);
  const withLocalePath = (href: string) => withLocale(href, locale);
  const t = useTranslations("ThankYou");

  const pointsRaw = searchParams.get("points") || "0"
  const parsedPoints = Number.parseInt(pointsRaw, 10)
  const points = Number.isFinite(parsedPoints) ? Math.max(0, parsedPoints) : 0
  const [displayPoints, setDisplayPoints] = useState(points)
  const [claimContext, setClaimContext] = useState<AnonymousClaimContext | null>(null)
  const [claimResult, setClaimResult] = useState<"claimed" | "forfeited" | null>(null)
  const [claimLoading, setClaimLoading] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const isLoggedIn = Boolean(currentUser)

  useEffect(() => {
    setDisplayPoints(points)
  }, [points])

  useEffect(() => {
    setClaimContext(readActiveAnonymousClaimContext())
  }, [])

  useEffect(() => {
    let alive = true
    const controller = new AbortController()

    const loadAuth = async () => {
      setAuthLoading(true)
      try {
        const response = await fetch("/api/app/me", {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!alive) return
        if (!response.ok) {
          setCurrentUser(null)
          return
        }

        const payload = await response.json().catch(() => null)
        setCurrentUser(payload)
      } catch {
        if (alive) {
          setCurrentUser(null)
        }
      } finally {
        if (alive) {
          setAuthLoading(false)
        }
      }
    }

    void loadAuth()

    return () => {
      alive = false
      controller.abort()
    }
  }, [])

  const loginHref = useMemo(() => {
    const query = searchParams.toString()
    const returnTo = query ? `${pathname}?${query}` : pathname
    return `/api/logto/sign-in?returnTo=${encodeURIComponent(returnTo)}`
  }, [pathname, searchParams])

  const clearClaim = useCallback((responseId: string) => {
    clearAnonymousClaimContext(responseId)
    setClaimContext(null)
  }, [])

  const claimPoints = useCallback(async () => {
    if (!claimContext) return

    setClaimLoading(true)
    setClaimError(null)
    try {
      const response = await fetch("/api/app/responses/claim-anonymous-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimToken: claimContext.claimToken }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (payload?.code === alreadySubmittedCode) {
          clearClaim(claimContext.responseId)
          setClaimError(t("alreadySubmittedDescription"))
          return
        }
        throw new Error(resolveUiError(payload, t("claimError")))
      }

      setDisplayPoints(
        typeof payload?.pointsAwarded === "number"
          ? payload.pointsAwarded
          : Number(payload?.pointsAwarded || displayPoints)
      )
      clearClaim(claimContext.responseId)
      setClaimResult("claimed")
      notifyPointsBalanceChanged()
    } catch (error) {
      setClaimError(toUiErrorMessage(error, t("claimError")))
    } finally {
      setClaimLoading(false)
    }
  }, [claimContext, clearClaim, displayPoints, t])

  const forfeitPoints = useCallback(async () => {
    if (!claimContext) return

    setClaimLoading(true)
    setClaimError(null)
    try {
      const response = await fetch("/api/app/responses/forfeit-anonymous-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimToken: claimContext.claimToken }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(resolveUiError(payload, t("forfeitError")))
      }

      clearClaim(claimContext.responseId)
      setClaimResult("forfeited")
      notifyPointsBalanceChanged()
    } catch (error) {
      setClaimError(toUiErrorMessage(error, t("forfeitError")))
    } finally {
      setClaimLoading(false)
    }
  }, [claimContext, clearClaim, t])

  useEffect(() => {
    if (authLoading || !isLoggedIn || !claimContext || claimLoading) return
    void claimPoints()
  }, [authLoading, claimContext, claimLoading, claimPoints, isLoggedIn])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-0 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-white/80">{t("subtitle")}</p>
        </div>
        
        <CardContent className="p-8 text-center space-y-6">
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
            <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
              <Gift className="h-5 w-5" />
              <span className="font-semibold">{t("pointsEarned")}</span>
            </div>
            <p
              className="text-3xl font-bold text-purple-600 dark:text-purple-400"
              data-testid="thank-you-points"
            >
              +{displayPoints}
            </p>
          </div>

          <p className="text-gray-600 dark:text-gray-400">
            {t("message")}
          </p>

          {claimContext ? (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="font-semibold text-amber-900">{t("claimTitle")}</p>
              <p className="text-sm text-amber-800">{t("claimDescription")}</p>
              {claimError ? <p className="text-sm text-red-700">{claimError}</p> : null}
              {claimLoading ? (
                <p className="text-sm text-amber-800">
                  {isLoggedIn ? t("claimLoading") : t("authChecking")}
                </p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {isLoggedIn ? (
                    <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => void claimPoints()}>
                      {t("claimAction")}
                    </Button>
                  ) : (
                    <Button asChild className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                      <a href={loginHref}>{t("claimAction")}</a>
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1" onClick={() => void forfeitPoints()}>
                    {t("forfeitAction")}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {claimResult === "claimed" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {t("claimSuccess")}
            </div>
          ) : null}

          {claimResult === "forfeited" ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {t("forfeitSuccess")}
            </div>
          ) : null}

          {isLoggedIn ? (
            <div className="space-y-3">
              <Button asChild className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                <Link href={withLocalePath("/explore")}>
                  {t("findMore")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={withLocalePath("/dashboard")}>
                  {t("goDashboard")}
                </Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

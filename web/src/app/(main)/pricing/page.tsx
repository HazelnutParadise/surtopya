"use client"

import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { PricingPlan, UserProfile } from "@/lib/api"

const formatUsd = (priceCentsUsd: number) => {
  const price = (priceCentsUsd || 0) / 100
  return `$${price.toFixed(price % 1 === 0 ? 0 : 2)}`
}

export default function PricingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null)
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations("Pricing")
  const locale = useLocale()

  useEffect(() => {
    let isMounted = true
    const loadData = async () => {
      setLoading(true)
      try {
        const [meRes, plansRes] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch(`/api/pricing/plans?locale=${encodeURIComponent(locale)}`, { cache: "no-store" }),
        ])

        const mePayload = await meRes.json().catch(() => null)
        const plansPayload = await plansRes.json().catch(() => ({ plans: [] }))

        if (isMounted) {
          setIsAuthenticated(meRes.ok)
          setCurrentProfile(meRes.ok ? mePayload : null)
          setPlans(plansRes.ok ? plansPayload.plans || [] : [])
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false)
          setCurrentProfile(null)
          setPlans([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [locale])

  const currentTier = currentProfile?.membershipTier
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.priceCentsUsd - b.priceCentsUsd),
    [plans]
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-20">
      <div className="container px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white mb-4">
            {t("title")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              {t("titleHighlight")}
            </span>
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400">{t("description")}</p>
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-500">Loading...</div>
        ) : sortedPlans.length === 0 ? (
          <div className="text-center text-sm text-gray-500">No plans available</div>
        ) : (
          <div className={`grid grid-cols-1 gap-8 ${sortedPlans.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {sortedPlans.map((plan) => {
              const isCurrent = isAuthenticated && currentTier === plan.code
              const planButtonLabel = isCurrent
                ? t("currentPlan")
                : plan.isPurchasable
                  ? isAuthenticated
                    ? t("upgradePro")
                    : t("getStarted")
                  : t("contactSales")

              return (
                <div
                  key={plan.code}
                  className={`relative flex flex-col p-8 bg-white dark:bg-gray-900 rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
                    isCurrent
                      ? "border-2 border-purple-600"
                      : "border-gray-200 dark:border-gray-800 hover:border-purple-500/30"
                  }`}
                >
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{plan.description}</p>
                  </div>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {formatUsd(plan.priceCentsUsd)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {plan.billingInterval === "month" ? t("perMonth") : ""}
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.benefits.map((benefit) => (
                      <li key={`${plan.code}-${benefit.key}`} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <Check className="h-4 w-4 text-green-500" /> {benefit.name}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={isCurrent ? "outline" : "default"}
                    className={isCurrent ? "w-full" : "w-full bg-purple-600 hover:bg-purple-700 text-white"}
                    disabled={loading || !plan.isPurchasable || isCurrent}
                  >
                    {planButtonLabel}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

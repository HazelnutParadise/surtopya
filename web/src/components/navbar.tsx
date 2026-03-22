"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  LayoutDashboard,
  Compass,
  PlusCircle,
  Info,
  CreditCard,
  Settings,
  User,
  LogOut,
  Shield,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import type { UserProfile } from "@/lib/api";
import { subscribePointsBalanceChanged } from "@/lib/points-balance-events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false)
  const [countdownMs, setCountdownMs] = useState<number | null>(null)
  const locale = getLocaleFromPath(pathname);
  const withLocalePath = (href: string) => withLocale(href, locale);
  const t = useTranslations("Navigation");
  const tDashboard = useTranslations("Dashboard");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const mountedRef = useRef(false);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshProfile = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false;
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    if (!background && mountedRef.current) {
      setAuthLoading(true);
    }

    try {
      const response = await fetch("/api/app/me", { cache: "no-store" });
      if (requestVersion !== requestVersionRef.current || !mountedRef.current) {
        return;
      }

      if (!response.ok) {
        if (!background) {
          setUser(null);
        }
        return;
      }

      const payload = await response.json();
      if (requestVersion !== requestVersionRef.current || !mountedRef.current) {
        return;
      }
      setUser(payload);
    } catch (error) {
      if (requestVersion !== requestVersionRef.current || !mountedRef.current) {
        return;
      }
      if (!background) {
        setUser(null);
      }
    } finally {
      if (!background && requestVersion === requestVersionRef.current && mountedRef.current) {
        setAuthLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshProfile({ background: hasLoadedOnceRef.current });
    hasLoadedOnceRef.current = true;
  }, [pathname, refreshProfile]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshProfile({ background: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void refreshProfile({ background: true });
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshProfile]);

  useEffect(() => {
    return subscribePointsBalanceChanged(() => {
      void refreshProfile({ background: true });
    });
  }, [refreshProfile]);

  const isAuthenticated = !!user;
  const userLabel = user?.displayName || user?.email || "";
  const pointsBalanceText = Number(user?.pointsBalance || 0).toLocaleString();
  const monthlyPointsGrant = Number(user?.monthlyPointsGrant || 0)
  const monthlyPointsGrantText = monthlyPointsGrant.toLocaleString()
  const nextMonthlyPointsGrantAtMs = (() => {
    const value = user?.nextMonthlyPointsGrantAt
    if (!value) return null
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  })()
  const hasMonthlyGrantCountdown =
    monthlyPointsGrant > 0 && nextMonthlyPointsGrantAtMs !== null

  const navItems = [
    { name: t("explore"), href: "/explore", icon: Compass },
    { name: t("datasets"), href: "/datasets", icon: Info },
    { name: t("pricing"), href: "/pricing", icon: CreditCard },
    { name: t("about"), href: "/about", icon: Info },
  ];

  const authItems = [{ name: t("create"), href: "/create", icon: PlusCircle }];

  const allItems = isAuthenticated ? [...navItems, ...authItems] : navItems;

  const handleLogout = () => {
    window.location.assign("/api/logto/sign-out");
  };

  useEffect(() => {
    if (!isPointsModalOpen || !hasMonthlyGrantCountdown || nextMonthlyPointsGrantAtMs === null) {
      setCountdownMs(null)
      return
    }

    const update = () => {
      setCountdownMs(Math.max(0, nextMonthlyPointsGrantAtMs - Date.now()))
    }

    update()
    const timer = window.setInterval(update, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [hasMonthlyGrantCountdown, isPointsModalOpen, nextMonthlyPointsGrantAtMs])

  const countdownParts = (() => {
    if (countdownMs === null) return null
    const totalSeconds = Math.floor(countdownMs / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return { days, hours, minutes, seconds }
  })()

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 shadow-sm backdrop-blur-md transition-all duration-300 dark:border-gray-800 dark:bg-gray-950/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href={withLocalePath("/")} className="flex items-center gap-2 transition-transform duration-300 ease-out hover:scale-[1.01]">
          <Image
            src="/logo-full.svg"
            alt="Surtopya logo"
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg object-contain"
            priority
          />
          <span className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-gray-900 leading-none dark:text-white">Surtopya</span>
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              beta
            </span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex md:items-center md:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={withLocalePath(item.href)}
              className={cn(
                "transform-gpu text-sm font-medium transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-purple-600 dark:hover:text-purple-400",
                pathname === withLocalePath(item.href) ? "text-purple-600 dark:text-purple-400" : "text-gray-600 dark:text-gray-300"
              )}
            >
              {item.name}
            </Link>
          ))}

          <div className="ml-4 flex items-center gap-4">
            {authLoading ? null : isAuthenticated ? (
              <>
                <button
                  type="button"
                  data-testid="navbar-points-desktop"
                  aria-label={tDashboard("pointsModalOpen")}
                  className="inline-flex min-w-24 cursor-pointer flex-col rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-left text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-800/70 dark:bg-purple-900/30 dark:text-purple-200 dark:hover:bg-purple-900/40"
                  onClick={() => setIsPointsModalOpen(true)}
                >
                  <span className="text-[10px] font-medium leading-none">{tDashboard("pointsBalance")}</span>
                  <span className="mt-1 text-sm font-semibold leading-none tabular-nums">{pointsBalanceText}</span>
                </button>

                <Button asChild variant="ghost" className="transform-gpu text-gray-600 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400">
                  <Link href={withLocalePath("/create")}>{t("create")}</Link>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 overflow-hidden rounded-full p-0 hover:bg-transparent">
                      <Avatar className="h-9 w-9 transform-gpu ring-2 ring-transparent transition-all duration-300 ease-out hover:scale-[1.03] hover:ring-purple-500">
                        <AvatarImage src={user?.avatarUrl} alt={userLabel} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 font-semibold text-white">
                          {userLabel.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="mt-1 w-56 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2" align="end" sideOffset={8} alignOffset={-4} forceMount>
                    <DropdownMenuLabel className="border-b px-4 py-3 font-normal dark:border-gray-800">
                      <div className="flex flex-col space-y-1 py-1">
                        <p className="text-sm font-semibold leading-none">{userLabel}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {user?.isAdmin && (
                        <DropdownMenuItem asChild>
                          <Link href={withLocalePath("/admin")} className="flex w-full cursor-pointer items-center">
                            <Shield className="mr-2 h-4 w-4" />
                            <span>{t("admin")}</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={withLocalePath("/dashboard")} className="flex w-full cursor-pointer items-center">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          <span>{t("dashboard")}</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={withLocalePath("/dashboard/profile")} className="flex w-full cursor-pointer items-center">
                          <User className="mr-2 h-4 w-4" />
                          <span>{t("profile")}</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={withLocalePath("/dashboard/settings")} className="flex w-full cursor-pointer items-center">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>{t("settings")}</span>
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/20" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t("logout")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <a href="/api/logto/sign-in">{t("login")}</a>
                </Button>
                <Button asChild size="sm" className="transform-gpu bg-purple-600 text-white shadow-md shadow-purple-500/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-purple-700 active:scale-[0.98]">
                  <a href="/api/logto/sign-in">{t("getStarted")}</a>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          {!authLoading && isAuthenticated ? (
            <button
              type="button"
              data-testid="navbar-points-mobile"
              title={`${tDashboard("pointsBalance")}: ${pointsBalanceText}`}
              aria-label={tDashboard("pointsModalOpen")}
              className="inline-flex min-w-[74px] cursor-pointer flex-col rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-left text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-800/70 dark:bg-purple-900/30 dark:text-purple-200 dark:hover:bg-purple-900/40"
              onClick={() => setIsPointsModalOpen(true)}
            >
              <span className="text-[9px] font-medium leading-none">{tDashboard("pointsBalance")}</span>
              <span className="mt-1 text-xs font-semibold leading-none tabular-nums">{pointsBalanceText}</span>
            </button>
          ) : null}
          <button
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? t("closeMenu") : t("openMenu")}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="animate-in slide-in-from-top-1 border-t border-gray-200 bg-white px-4 py-6 shadow-xl dark:border-gray-800 dark:bg-gray-950 md:hidden">
          <div className="flex flex-col gap-4">
            {allItems.map((item) => (
              <Link
                key={item.href}
                href={withLocalePath(item.href)}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex transform-gpu items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-gray-50 dark:hover:bg-gray-900",
                  pathname === withLocalePath(item.href)
                    ? "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                    : "text-gray-600 dark:text-gray-300"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}

            <div className="mt-4 border-t border-gray-100 pt-6 dark:border-gray-800">
              {authLoading ? null : isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  {user?.isAdmin && (
                    <Button asChild variant="outline" className="h-12 w-full justify-start rounded-xl">
                      <Link href={withLocalePath("/admin")} onClick={() => setIsMenuOpen(false)}>
                        <Shield className="mr-3 h-5 w-5" />
                        {t("admin")}
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" className="h-12 w-full justify-start rounded-xl">
                    <Link href={withLocalePath("/dashboard")} onClick={() => setIsMenuOpen(false)}>
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      {t("dashboard")}
                    </Link>
                  </Button>
                  <Button variant="ghost" className="h-12 w-full justify-start rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleLogout}>
                    <LogOut className="mr-3 h-5 w-5" />
                    {t("logout")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base">
                    <a href="/api/logto/sign-in">{t("login")}</a>
                  </Button>
                  <Button asChild className="h-12 w-full transform-gpu rounded-xl bg-purple-600 text-base text-white shadow-lg shadow-purple-500/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-purple-700 active:scale-[0.98]">
                    <a href="/api/logto/sign-in">{t("getStarted")}</a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={isPointsModalOpen} onOpenChange={setIsPointsModalOpen}>
        <DialogContent data-testid="navbar-points-modal" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tDashboard("pointsModalTitle")}</DialogTitle>
            <DialogDescription>{tDashboard("pointsModalDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800/60 dark:bg-purple-900/20">
              <p className="text-xs font-medium text-purple-700 dark:text-purple-300">{tDashboard("pointsBalance")}</p>
              <p className="mt-1 text-2xl font-semibold text-purple-900 tabular-nums dark:text-purple-100">{pointsBalanceText}</p>
            </div>

            {hasMonthlyGrantCountdown && countdownParts ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {tDashboard("pointsModalMonthlyGrant", { points: monthlyPointsGrantText })}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg border bg-gray-50 p-2 text-center dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-lg font-semibold tabular-nums">{countdownParts.days}</p>
                    <p className="text-[10px] text-gray-500">{tDashboard("pointsModalCountdownDays")}</p>
                  </div>
                  <div className="rounded-lg border bg-gray-50 p-2 text-center dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-lg font-semibold tabular-nums">{countdownParts.hours}</p>
                    <p className="text-[10px] text-gray-500">{tDashboard("pointsModalCountdownHours")}</p>
                  </div>
                  <div className="rounded-lg border bg-gray-50 p-2 text-center dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-lg font-semibold tabular-nums">{countdownParts.minutes}</p>
                    <p className="text-[10px] text-gray-500">{tDashboard("pointsModalCountdownMinutes")}</p>
                  </div>
                  <div className="rounded-lg border bg-gray-50 p-2 text-center dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-lg font-semibold tabular-nums">{countdownParts.seconds}</p>
                    <p className="text-[10px] text-gray-500">{tDashboard("pointsModalCountdownSeconds")}</p>
                  </div>
                </div>
                {countdownMs === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{tDashboard("pointsModalGrantingSoon")}</p>
                ) : null}
              </div>
            ) : (
              <p data-testid="navbar-points-modal-no-grant" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {tDashboard("pointsModalNoMonthlyGrant")}
              </p>
            )}

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tDashboard("pointsModalWhatForTitle")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                <li>{tDashboard("pointsModalUseBoost")}</li>
                <li>{tDashboard("pointsModalUseDataset")}</li>
                <li>{tDashboard("pointsModalUseEarn")}</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  );
}

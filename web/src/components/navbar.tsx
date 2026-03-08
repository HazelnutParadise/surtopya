"use client";

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

export function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
      const response = await fetch("/api/me?optional=1", { cache: "no-store" });
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

  const isAuthenticated = !!user;
  const userLabel = user?.displayName || user?.email || "";
  const pointsBalanceText = Number(user?.pointsBalance || 0).toLocaleString();

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

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 shadow-sm backdrop-blur-md transition-all duration-300 dark:border-gray-800 dark:bg-gray-950/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href={withLocalePath("/")} className="flex items-center gap-2 transition-transform duration-300 ease-out hover:scale-[1.01]">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 transition-all duration-300 ease-out"></div>
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Surtopya</span>
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
                <div
                  data-testid="navbar-points-desktop"
                  className="inline-flex min-w-24 flex-col rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-purple-700 dark:border-purple-800/70 dark:bg-purple-900/30 dark:text-purple-200"
                >
                  <span className="text-[10px] font-medium leading-none">{tDashboard("pointsBalance")}</span>
                  <span className="mt-1 text-sm font-semibold leading-none tabular-nums">{pointsBalanceText}</span>
                </div>

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
            <div
              data-testid="navbar-points-mobile"
              title={`${tDashboard("pointsBalance")}: ${pointsBalanceText}`}
              className="inline-flex min-w-[74px] flex-col rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-purple-700 dark:border-purple-800/70 dark:bg-purple-900/30 dark:text-purple-200"
            >
              <span className="text-[9px] font-medium leading-none">{tDashboard("pointsBalance")}</span>
              <span className="mt-1 text-xs font-semibold leading-none tabular-nums">{pointsBalanceText}</span>
            </div>
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
    </nav>
  );
}

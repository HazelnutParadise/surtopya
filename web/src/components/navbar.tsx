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
  Shield
} from "lucide-react";
import { useEffect, useState } from "react";
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!response.ok) {
          if (isMounted) {
            setUser(null);
          }
          return;
        }
        const payload = await response.json();
        if (isMounted) {
          setUser(payload);
        }
      } catch (error) {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const isAuthenticated = !!user;
  const userLabel = user?.displayName || user?.email || "";

  const navItems = [
    { name: t("explore"), href: "/explore", icon: Compass },
    { name: t("datasets"), href: "/datasets", icon: Info },
    { name: t("pricing"), href: "/pricing", icon: CreditCard },
    { name: t("about"), href: "/about", icon: Info },
  ];

  const authItems = [
    { name: t("create"), href: "/create", icon: PlusCircle },
  ];

  const allItems = isAuthenticated ? [...navItems, ...authItems] : navItems;

  const handleLogout = () => {
    window.location.assign("/api/logto/sign-out");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href={withLocalePath("/")} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600"></div>
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Surtopya
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex md:items-center md:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={withLocalePath(item.href)}
              className={cn(
                "text-sm font-medium transition-colors hover:text-purple-600 dark:hover:text-purple-400",
                pathname === withLocalePath(item.href)
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-gray-600 dark:text-gray-300"
              )}
            >
              {item.name}
            </Link>
          ))}
          
          <div className="flex items-center gap-4 ml-4">
             {authLoading ? null : isAuthenticated ? (
               <>
                 <Button asChild variant="ghost" className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400">
                   <Link href={withLocalePath("/create")}>{t("create")}</Link>
                 </Button>
                 
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 overflow-hidden hover:bg-transparent">
                       <Avatar className="h-9 w-9 ring-2 ring-transparent hover:ring-purple-500 transition-all">
                         <AvatarImage src={user?.avatarUrl} alt={userLabel} />
                         <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold">
                           {userLabel.charAt(0)}
                         </AvatarFallback>
                       </Avatar>
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent className="w-56 mt-1 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2" align="end" sideOffset={8} alignOffset={-4} forceMount>
                     <DropdownMenuLabel className="font-normal px-4 py-3 border-b dark:border-gray-800">
                       <div className="flex flex-col space-y-1 py-1">
                         <p className="text-sm font-semibold leading-none">{userLabel}</p>
                         <p className="text-xs leading-none text-muted-foreground">
                           {user?.email}
                         </p>
                       </div>
                     </DropdownMenuLabel>
                     <DropdownMenuSeparator />
                     <DropdownMenuGroup>
                       {user?.isAdmin && (
                         <DropdownMenuItem asChild>
                           <Link href={withLocalePath("/admin")} className="flex w-full items-center cursor-pointer">
                             <Shield className="mr-2 h-4 w-4" />
                             <span>{t("admin")}</span>
                           </Link>
                         </DropdownMenuItem>
                       )}
                       <DropdownMenuItem asChild>
                         <Link href={withLocalePath("/dashboard")} className="flex w-full items-center cursor-pointer">
                           <LayoutDashboard className="mr-2 h-4 w-4" />
                           <span>{t("dashboard")}</span>
                         </Link>
                       </DropdownMenuItem>
                       <DropdownMenuItem asChild>
                         <Link href={withLocalePath("/dashboard/profile")} className="flex w-full items-center cursor-pointer">
                           <User className="mr-2 h-4 w-4" />
                           <span>{t("profile")}</span>
                         </Link>
                       </DropdownMenuItem>
                       <DropdownMenuItem asChild>
                         <Link href={withLocalePath("/dashboard/settings")} className="flex w-full items-center cursor-pointer">
                           <Settings className="mr-2 h-4 w-4" />
                           <span>{t("settings")}</span>
                         </Link>
                       </DropdownMenuItem>
                     </DropdownMenuGroup>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer" onClick={handleLogout}>
                       <LogOut className="mr-2 h-4 w-4" />
                       <span>{t("logout")}</span>
                     </DropdownMenuItem>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </>
             ) : (
               <>
                 <Button asChild variant="ghost" size="sm">
                   <Link href="/api/logto/sign-in">{t("login")}</Link>
                 </Button>
                 <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20">
                   <Link href="/api/logto/sign-in">{t("getStarted")}</Link>
                 </Button>
               </>
             )}
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-6 dark:border-gray-800 dark:bg-gray-950 shadow-xl animate-in slide-in-from-top-1">
          <div className="flex flex-col gap-4">
            {allItems.map((item) => (
              <Link
                key={item.href}
                href={withLocalePath(item.href)}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-900",
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
                      <Button asChild variant="outline" className="w-full justify-start rounded-xl h-12">
                        <Link href={withLocalePath("/admin")} onClick={() => setIsMenuOpen(false)}>
                          <Shield className="mr-3 h-5 w-5" />
                          {t("admin")}
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" className="w-full justify-start rounded-xl h-12">
                      <Link href={withLocalePath("/dashboard")} onClick={() => setIsMenuOpen(false)}>
                        <LayoutDashboard className="mr-3 h-5 w-5" />
                        {t("dashboard")}
                      </Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl h-12" onClick={handleLogout}>
                      <LogOut className="mr-3 h-5 w-5" />
                      {t("logout")}
                    </Button>
                  </div>
               ) : (
                  <div className="flex flex-col gap-3">
                    <Button asChild variant="outline" className="w-full rounded-xl h-12 text-base">
                      <Link href="/api/logto/sign-in">{t("login")}</Link>
                    </Button>
                    <Button asChild className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 text-base shadow-lg shadow-purple-500/20">
                      <Link href="/api/logto/sign-in">{t("getStarted")}</Link>
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

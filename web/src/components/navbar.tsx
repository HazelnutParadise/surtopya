"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  LogOut
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
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
  
  // Mock Auth State
  const isAuthenticated = true; 
  const user = {
    name: "Tim Lai",
    email: "tim@example.com",
    avatar: "" 
  };

  const navItems = [
    { name: "Explore", href: "/explore", icon: Compass },
    { name: "Datasets", href: "/datasets", icon: Info },
    { name: "Pricing", href: "/pricing", icon: CreditCard },
    { name: "About", href: "/about", icon: Info },
  ];

  const authItems = [
    { name: "Create", href: "/create", icon: PlusCircle },
  ];

  const allItems = isAuthenticated ? [...navItems, ...authItems] : navItems;

  const handleLogout = () => {
    console.log("Logging out...");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
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
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-purple-600 dark:hover:text-purple-400",
                pathname === item.href
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-gray-600 dark:text-gray-300"
              )}
            >
              {item.name}
            </Link>
          ))}
          
          <div className="flex items-center gap-4 ml-4">
             {isAuthenticated ? (
               <>
                 <Button asChild variant="ghost" className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400">
                   <Link href="/create">Create</Link>
                 </Button>
                 
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 overflow-hidden hover:bg-transparent">
                       <Avatar className="h-9 w-9 ring-2 ring-transparent hover:ring-purple-500 transition-all">
                         <AvatarImage src={user.avatar} alt={user.name} />
                         <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold">
                           {user.name.charAt(0)}
                         </AvatarFallback>
                       </Avatar>
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent className="w-56 mt-1 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2" align="end" sideOffset={8} alignOffset={-4} forceMount>
                     <DropdownMenuLabel className="font-normal px-4 py-3 border-b dark:border-gray-800">
                       <div className="flex flex-col space-y-1 py-1">
                         <p className="text-sm font-semibold leading-none">{user.name}</p>
                         <p className="text-xs leading-none text-muted-foreground">
                           {user.email}
                         </p>
                       </div>
                     </DropdownMenuLabel>
                     <DropdownMenuSeparator />
                     <DropdownMenuGroup>
                       <DropdownMenuItem asChild>
                         <Link href="/dashboard" className="flex w-full items-center cursor-pointer">
                           <LayoutDashboard className="mr-2 h-4 w-4" />
                           <span>Dashboard</span>
                         </Link>
                       </DropdownMenuItem>
                       <DropdownMenuItem asChild>
                         <Link href="/dashboard/profile" className="flex w-full items-center cursor-pointer">
                           <User className="mr-2 h-4 w-4" />
                           <span>Profile</span>
                         </Link>
                       </DropdownMenuItem>
                       <DropdownMenuItem asChild>
                         <Link href="/dashboard/settings" className="flex w-full items-center cursor-pointer">
                           <Settings className="mr-2 h-4 w-4" />
                           <span>Settings</span>
                         </Link>
                       </DropdownMenuItem>
                     </DropdownMenuGroup>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer" onClick={handleLogout}>
                       <LogOut className="mr-2 h-4 w-4" />
                       <span>Log out</span>
                     </DropdownMenuItem>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </>
             ) : (
               <>
                 <Button variant="ghost" size="sm">Sign In</Button>
                 <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20">Get Started</Button>
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
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-900",
                  pathname === item.href
                    ? "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                    : "text-gray-600 dark:text-gray-300"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
            
            <div className="mt-4 border-t border-gray-100 pt-6 dark:border-gray-800">
               {isAuthenticated ? (
                  <div className="flex flex-col gap-2">
                    <Button asChild variant="outline" className="w-full justify-start rounded-xl h-12">
                      <Link href="/dashboard" onClick={() => setIsMenuOpen(false)}>
                        <LayoutDashboard className="mr-3 h-5 w-5" />
                        Dashboard
                      </Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl h-12" onClick={handleLogout}>
                      <LogOut className="mr-3 h-5 w-5" />
                      Log out
                    </Button>
                  </div>
               ) : (
                  <div className="flex flex-col gap-3">
                    <Button variant="outline" className="w-full rounded-xl h-12 text-base">Sign In</Button>
                    <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 text-base shadow-lg shadow-purple-500/20">Get Started</Button>
                  </div>
               )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

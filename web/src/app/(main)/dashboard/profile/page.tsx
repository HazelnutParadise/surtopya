"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Mail, User, Phone, MapPin } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
  const tProfile = useTranslations("Profile");
  const tCommon = useTranslations("Common");
  const [user, setUser] = useState({
    name: "Tim Lai",
    email: "tim@example.com",
    avatar: "",
    phone: "+886 912 345 678",
    bio: "Passionate about market research and data analytics. Exploring the future of survey technology.",
    location: "Taipei, Taiwan"
  });

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{tProfile("title")}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {tProfile("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Avatar & Summary */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <CardContent className="p-0">
                <div className="h-24 bg-gradient-to-r from-purple-600 to-pink-600"></div>
                <div className="px-6 pb-6 text-center">
                  <div className="relative -mt-12 mb-4 inline-block">
                    <Avatar className="h-24 w-24 ring-4 ring-white dark:ring-gray-950 shadow-lg">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl font-bold">
                        {user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <Button size="icon" variant="secondary" className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md hover:scale-110 transition-transform">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                  
                  <Separator className="my-6 dark:bg-gray-800" />
                  
                  <div className="space-y-4 text-left">
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4 text-purple-500" />
                      <span>{user.location}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="h-4 w-4 text-purple-500" />
                      <span>{user.phone}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle className="text-lg">{tProfile("accountStats")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">{tProfile("memberSince")}</span>
                  <span className="font-medium">Dec 2023</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">{tProfile("surveysCompleted")}</span>
                  <span className="font-medium text-purple-600 font-bold">42</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">{tProfile("pointsEarned")}</span>
                  <span className="font-medium text-pink-600 font-bold">1,250</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Edit Settings */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle>{tProfile("personalInfoTitle")}</CardTitle>
                <CardDescription>{tProfile("personalInfoDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{tProfile("fullName")}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input id="name" defaultValue={user.name} className="pl-10 h-11 focus:ring-purple-500/20" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{tProfile("emailAddress")}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input id="email" defaultValue={user.email} className="pl-10 h-11 focus:ring-purple-500/20" disabled />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">{tProfile("bio")}</Label>
                  <Input id="bio" defaultValue={user.bio} className="h-11 focus:ring-purple-500/20" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{tProfile("phoneNumber")}</Label>
                    <Input id="phone" defaultValue={user.phone} className="h-11 focus:ring-purple-500/20" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">{tProfile("location")}</Label>
                    <Input id="location" defaultValue={user.location} className="h-11 focus:ring-purple-500/20" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline">{tCommon("cancel")}</Button>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-transform">
                    {tProfile("saveChanges")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
              <CardHeader>
                <CardTitle>{tProfile("securityTitle")}</CardTitle>
                <CardDescription>{tProfile("securityDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{tProfile("changePasswordTitle")}</p>
                    <p className="text-sm text-gray-500">{tProfile("changePasswordDescription")}</p>
                  </div>
                  <Button variant="secondary" className="md:w-32">{tProfile("reset")}</Button>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{tProfile("twoFactorTitle")}</p>
                    <p className="text-sm text-gray-500">{tProfile("twoFactorDescription")}</p>
                  </div>
                  <Button variant="secondary" className="md:w-32">{tProfile("enable")}</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

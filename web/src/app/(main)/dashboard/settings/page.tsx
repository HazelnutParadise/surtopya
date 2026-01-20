"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Shield, Palette, Globe, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    surveys: true,
    marketing: false
  });

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your account preferences and application settings.
          </p>
        </div>

        <div className="space-y-6">
          {/* Notifications */}
          <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Control how you receive updates and survey invitations.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-gray-500">Receive survey results and account alerts via email.</p>
                </div>
                <Switch checked={notifications.email} onCheckedChange={(val) => setNotifications({...notifications, email: val})} />
              </div>
              <Separator className="dark:bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Survey Invitations</Label>
                  <p className="text-sm text-gray-500">Be notified when new surveys matching your profile are available.</p>
                </div>
                <Switch checked={notifications.surveys} onCheckedChange={(val) => setNotifications({...notifications, surveys: val})} />
              </div>
              <Separator className="dark:bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Marketing Updates</Label>
                  <p className="text-sm text-gray-500">Get news about new features and promotions.</p>
                </div>
                <Switch checked={notifications.marketing} onCheckedChange={(val) => setNotifications({...notifications, marketing: val})} />
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Privacy</CardTitle>
                <CardDescription>Manage your data visibility and privacy settings.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Public Profile</Label>
                  <p className="text-sm text-gray-500">Show your profile to other researchers and survey creators.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="dark:bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Data Sharing</Label>
                  <p className="text-sm text-gray-500">Anonymously share your responses for larger market studies.</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Appearance & Language */}
          <Card className="border-0 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Appearance & Locale</CardTitle>
                <CardDescription>Personalize the visual language of Surtopya.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Dark Mode</Label>
                  <p className="text-sm text-gray-500">Toggle between light and dark themes.</p>
                </div>
                <Switch />
              </div>
              <Separator className="dark:bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Language
                  </Label>
                  <p className="text-sm text-gray-500">Choose your preferred language for the interface.</p>
                </div>
                <Button variant="outline" size="sm">English (US)</Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-2 border-red-100 dark:border-red-900/30 shadow-none bg-red-50/50 dark:bg-red-950/10">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-lg">Danger Zone</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-900 dark:text-white">Delete Account</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Permanently delete your account and all associated data. This action is irreversible.</p>
                </div>
                <Button variant="destructive" className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

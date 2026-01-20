"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Gift } from "lucide-react";
import Link from "next/link";

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-0 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Thank You!</h1>
          <p className="text-white/80">Your response has been submitted</p>
        </div>
        
        <CardContent className="p-8 text-center space-y-6">
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
            <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
              <Gift className="h-5 w-5" />
              <span className="font-semibold">Points Earned</span>
            </div>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">+50</p>
          </div>

          <p className="text-gray-600 dark:text-gray-400">
            Thank you for taking the time to complete this survey. Your feedback is valuable to us.
          </p>

          <div className="space-y-3">
            <Button asChild className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
              <Link href="/explore">
                Find More Surveys
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">
                Go to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

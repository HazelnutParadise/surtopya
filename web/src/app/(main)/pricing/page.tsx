"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useState } from "react";

export default function PricingPage() {
  // Mock Auth - consistent with Navbar
  const isAuthenticated = true; 
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-20">
      <div className="container px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white mb-4">
            Simple, Transparent <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Pricing</span>
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400">
            Choose the plan that fits your research needs. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Free Plan */}
          <div className="relative flex flex-col p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:border-purple-500/30">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Free</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">For students and hobbyists</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">$0</span>
              <span className="text-gray-500 dark:text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-green-500" /> 3 Active Surveys
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-green-500" /> 100 Responses / Survey
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-green-500" /> Basic Analytics
              </li>
            </ul>
            <Button variant="outline" className="w-full" disabled={isAuthenticated}>
              {isAuthenticated ? "Current Plan" : "Get Started"}
            </Button>
          </div>

          {/* Pro Plan */}
          <div className="relative flex flex-col p-8 bg-white dark:bg-gray-900 rounded-2xl border-2 border-purple-600 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
            <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
              POPULAR
            </div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pro</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">For researchers and pros</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">$29</span>
              <span className="text-gray-500 dark:text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-purple-500" /> Unlimited Surveys
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-purple-500" /> 1,000 Responses / Survey
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-purple-500" /> Advanced Analytics & Export
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-purple-500" /> Exclude from Open Datasets
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-purple-500" /> Priority Support
              </li>
            </ul>
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              {isAuthenticated ? "Upgrade to Pro" : "Start Free Trial"}
            </Button>
          </div>

          {/* Enterprise Plan */}
          <div className="relative flex flex-col p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:border-purple-500/30">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enterprise</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">For large organizations</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">Custom</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-green-500" /> Unlimited Everything
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-green-500" /> Dedicated Account Manager
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <Check className="h-4 w-4 text-green-500" /> SSO & Advanced Security
              </li>
            </ul>
            <Button variant="outline" className="w-full">Contact Sales</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

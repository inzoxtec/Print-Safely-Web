// app/pricing/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function PricingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300">
      
      {/* Shared Main Header (Same as Home Page) */}
      <Header />

      {/* Main Content Grid */}
      <main className="max-w-6xl w-full mx-auto px-6 py-16 flex-1 flex flex-col justify-center gap-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto mt-6">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Flexible Plans for <span className="text-blue-600 dark:text-blue-500">Every Print Job</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Ensure maximum security for your documents. Choose a plan that fits your volume, or top-up a single link on-the-fly.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Card 1: One-Time Pass */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-bold uppercase tracking-wider block w-fit">
                <i className="ri-flashlight-line"></i> One-Link Pass
              </span>
              <h3 className="text-lg font-black">Quick Top-Up</h3>
              <p className="text-3xl font-black">₹9<span className="text-xs font-normal text-zinc-500"> /once</span></p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">Upgrade a single active secure link to load up to 20 documents simultaneously.</p>
              <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                <li>✓ 20 Documents in package</li>
                <li>✓ Image & PDF support</li>
                <li>✓ Instant auto-destruction</li>
              </ul>
            </div>
            <Link
              href={user ? "/dashboard/billing" : "/login?redirect=/pricing"}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wide transition text-center shadow-lg shadow-blue-500/10"
            >
              Buy One-Link Pass
            </Link>
          </div>

          {/* Card 2: Starter Plan */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-[9px] font-bold uppercase tracking-wider block w-fit">
                <i className="ri-rocket-line"></i> Monthly Plan
              </span>
              <h3 className="text-lg font-black">Starter Premium</h3>
              <p className="text-3xl font-black">₹99<span className="text-xs font-normal text-zinc-500"> /mo</span></p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">Best for individuals and small businesses sending files occasionally.</p>
              <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                <li>✓ 20 Secure Links / month</li>
                <li>✓ Up to 10 files per link</li>
                <li>✓ Full client-side PDF tools</li>
                <li>✓ Standard 24h link life</li>
              </ul>
            </div>
            <Link
              href={user ? "/dashboard/billing" : "/login?redirect=/pricing"}
              className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-white rounded-xl text-xs font-bold tracking-wide transition text-center"
            >
              Subscribe Starter
            </Link>
          </div>

          {/* Card 3: Pro Plan */}
          <div className="bg-white dark:bg-zinc-900 border-2 border-blue-500 p-6 rounded-3xl relative flex flex-col justify-between space-y-6 shadow-lg shadow-blue-500/5">
            <span className="absolute -top-3 right-6 px-3 py-1 bg-blue-600 text-white font-extrabold text-[9px] rounded-full uppercase tracking-wider shadow">Most Popular</span>
            <div className="space-y-4">
              <span className="px-2.5 py-1 bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-bold uppercase tracking-wider block w-fit">
                <i className="ri-vip-crown-line"></i> Monthly Plan
              </span>
              <h3 className="text-lg font-black">Standard Pro</h3>
              <p className="text-3xl font-black">₹249<span className="text-xs font-normal text-zinc-500"> /mo</span></p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">Perfect for lawyers, accountants, and businesses sending sensitive prints daily.</p>
              <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                <li>✓ 100 Secure Links / month</li>
                <li>✓ Up to 20 files per link</li>
                <li>✓ Custom Header Branding</li>
                <li>✓ Advanced link access logs</li>
              </ul>
            </div>
            <Link
              href={user ? "/dashboard/billing" : "/login?redirect=/pricing"}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wide transition text-center shadow-lg shadow-blue-500/10"
            >
              Subscribe Pro
            </Link>
          </div>

          {/* Card 4: Advanced/Enterprise Plan */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full text-[9px] font-bold uppercase tracking-wider block w-fit">
                <i className="ri-global-line"></i> Monthly Plan
              </span>
              <h3 className="text-lg font-black">Advanced Team</h3>
              <p className="text-3xl font-black">₹399<span className="text-xs font-normal text-zinc-500"> /mo</span></p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">Unlimited secure links, team collaboration workspace, and 24/7 client support.</p>
              <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                <li>✓ Unlimited Secure Links</li>
                <li>✓ Up to 50 files per link</li>
                <li>✓ Dedicated billing panel</li>
                <li>✓ Priority support access</li>
              </ul>
            </div>
            <Link
              href={user ? "/dashboard/billing" : "/login?redirect=/pricing"}
              className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-white rounded-xl text-xs font-bold tracking-wide transition text-center"
            >
              Go Enterprise
            </Link>
          </div>
        </div>
      </main>

      {/* Shared Main Footer (Same as Home Page) */}
      <Footer />
    </div>
  );
}

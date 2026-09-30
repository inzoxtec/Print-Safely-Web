// app/components/ToolLayout.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Header from "./Header";
import Footer from "./Footer";
import ToolAdSidebar from "./ToolAdSidebar";
import BreadcrumbSchema from "./BreadcrumbSchema";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface ToolLayoutProps {
  children: React.ReactNode;
  breadcrumbs: BreadcrumbItem[];
  className?: string;
}

export default function ToolLayout({
  children,
  breadcrumbs,
  className = "",
}: ToolLayoutProps) {
  const { isPremium } = useAuth();

  return (
    <div className={`min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300 ${!isPremium ? "pb-16 lg:pb-0" : ""} ${className}`}>
      <Header />

      <div className="flex-1 flex-col md:flex-row flex w-full max-w-[100vw] justify-center overflow-hidden">
        {/* LEFT SIDEBAR (Ads for Free Users / Related Tools for Paid Users) */}
        <ToolAdSidebar position="left" />

        {/* CENTER MAIN WORKSPACE */}
        <main className="flex-1 max-w-4xl p-6 md:p-8 overflow-auto space-y-8">
          <BreadcrumbSchema items={breadcrumbs} />
          {children}
        </main>

        {/* RIGHT SIDEBAR (Ads for Free Users / Related Tools for Paid Users) */}
        <ToolAdSidebar position="right" />
      </div>

      {/* MOBILE BOTTOM BANNER (Mobile only for free users) */}
      {!isPremium && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center z-45 transition-colors shadow-lg">
          <div className="w-full max-w-lg mx-auto flex items-center justify-between px-4 h-full text-xs text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <span className="bg-zinc-100 dark:bg-zinc-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded text-zinc-500">AD</span>
              <p className="font-semibold text-[12px] text-zinc-500 dark:text-zinc-400">Upgrade to remove ads and unlock pro features.</p>
            </div>
            <Link href="/pricing" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[12px] transition whitespace-nowrap shadow">
              Upgrade
            </Link>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}


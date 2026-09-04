// app/HomePageClient.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import OnboardingModal from "@/app/components/OnboardingModal";

interface ToolItem {
  name: string;
  href: string;
  desc: string;
  category: "Organize" | "Convert" | "Security" | "Sign & Edit";
  badge?: string;
  color: string; // Tailwind bg color class for icon container
  icon: React.ReactNode;
}

export default function HomePageClient() {
  const [activeTab, setActiveTab] = useState<string>("All");
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean | undefined>(undefined);

  // 1. Configure the comprehensive list of tools
  const toolsList: ToolItem[] = [
    // Organize Category
    {
      name: "Merge PDF",
      href: "/tools/merge-pdf",
      desc: "Combine multiple PDF files into one document in any page order.",
      category: "Organize",
      color: "bg-blue-500/10 text-blue-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 7h8m0 0v8a2 2 0 01-2 2h-4m2 0h2" />
    },
    {
      name: "Split PDF",
      href: "/tools/split-pdf",
      desc: "Extract specific page ranges or split each page into a separate PDF file.",
      category: "Organize",
      color: "bg-indigo-500/10 text-indigo-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    },
    {
      name: "Reorder Pages",
      href: "/tools/reorder-pdf",
      desc: "Drag-and-drop page thumbnails to sort and rearrange pages visually.",
      category: "Organize",
      color: "bg-violet-500/10 text-violet-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
    },
    {
      name: "Delete Pages",
      href: "/tools/delete-pdf",
      desc: "Remove unwanted pages from your document using a thumbnail grid.",
      category: "Organize",
      color: "bg-purple-500/10 text-purple-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    },

    // Convert Category
    {
      name: "Image to PDF",
      href: "/tools/image-to-pdf",
      desc: "Convert JPG, PNG, and WebP images into a combined PDF layout.",
      category: "Convert",
      color: "bg-orange-500/10 text-orange-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    },
    {
      name: "PDF to Image",
      href: "/tools/pdf-to-image",
      desc: "Extract all pages from a PDF and convert them to JPG or PNG files.",
      category: "Convert",
      color: "bg-amber-500/10 text-amber-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    },
    {
      name: "Docx to PDF",
      href: "/tools/doc-to-pdf",
      desc: "Convert Microsoft Word (.docx) documents into standard PDF format.",
      category: "Convert",
      badge: "Beta",
      color: "bg-sky-500/10 text-sky-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    },
    {
      name: "XLSX to PDF",
      href: "/tools/excel-to-pdf",
      desc: "Convert Excel sheets (.xlsx/.xls) into standard PDF format locally.",
      category: "Convert",
      color: "bg-emerald-500/10 text-emerald-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    },
    {
      name: "CSV to PDF",
      href: "/tools/csv-to-pdf",
      desc: "Convert CSV spreadsheets into clean visual PDF tables locally.",
      category: "Convert",
      color: "bg-teal-500/10 text-teal-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    },
    {
      name: "Text to PDF",
      href: "/tools/txt-to-pdf",
      desc: "Convert plain text (.txt) and Markdown (.md) to styled PDF offline.",
      category: "Convert",
      color: "bg-slate-500/10 text-slate-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    },
    {
      name: "Extract Text",
      href: "/tools/extract-text",
      desc: "Parse and extract raw text data from searchable PDF files.",
      category: "Convert",
      color: "bg-yellow-500/10 text-yellow-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    },

    // Security Category
    {
      name: "Protect PDF",
      href: "/tools/protect",
      desc: "Encrypt your PDF document with a secure password restriction.",
      category: "Security",
      color: "bg-red-500/10 text-red-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    },
    {
      name: "Unlock PDF",
      href: "/tools/unlock",
      desc: "Remove password protection from your encrypted PDF documents.",
      category: "Security",
      color: "bg-rose-500/10 text-rose-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    },
    {
      name: "Watermark PDF",
      href: "/tools/watermark",
      desc: "Stamp text or image watermarks onto all pages of a PDF.",
      category: "Security",
      color: "bg-pink-500/10 text-pink-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    },
    {
      name: "Page Numbers",
      href: "/tools/page-numbers",
      desc: "Insert headers and footers with custom sequential page numbers.",
      category: "Security",
      color: "bg-fuchsia-500/10 text-fuchsia-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    },

    // Sign & Edit Category
    {
      name: "Sign PDF",
      href: "/tools/sign-pdf",
      desc: "Draw, type, or upload custom signatures to place onto PDF pages.",
      category: "Sign & Edit",
      color: "bg-emerald-500/10 text-emerald-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    },
    {
      name: "Annotate PDF",
      href: "/tools/annotate-pdf",
      desc: "Add custom text notes, highlights, shapes, and markings directly.",
      category: "Sign & Edit",
      color: "bg-teal-500/10 text-teal-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    },
  ];

  // 2. Filter tabs configuration
  const tabs = ["All", "Organize", "Convert", "Security", "Sign & Edit"];

  // 3. Filtered list calculation
  const filteredTools = activeTab === "All" 
    ? toolsList 
    : toolsList.filter(t => t.category === activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 font-sans">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 px-4 text-center sm:px-6 lg:px-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-64 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none" />
        
        <div className="relative max-w-3xl mx-auto space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30">
            🛡️ 100% Secure & Client-Side Processing
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-[1.12]">
            <span className="text-blue-600">Secure PDF Printing </span> &amp; Private Document Suite
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Generate zero-download print links for printer shops to protect your IDs &amp; confidential documents. Merge, split, sign, lock, and convert PDFs 100% offline in your browser.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link 
              href="/upload" 
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/10 active:scale-[0.98] transition-all text-sm"
            >
              Generate Secure Print Link
            </Link>
            <button
              type="button"
              onClick={() => {
                const toolsEl = document.getElementById("tools-catalog");
                toolsEl?.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-6 py-3 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm active:scale-[0.98] transition-all text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>Explore Tools</span>
              <span className="text-xs">↓</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="px-5 py-3 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 active:scale-[0.98] transition-all text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>💡 How It Works</span>
            </button>
          </div>
        </div>
      </section>

      {/* Enterprise Tech Stack & Security Infrastructure Trust Bar */}
      <section 
        aria-labelledby="tech-stack-heading"
        className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 mb-4"
      >
          <div className="text-center max-w-2xl mx-auto mb-6 space-y-1.5">
            <h2 
              id="tech-stack-heading"
              className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white"
            >
              Engineered with Enterprise-Grade Security & Cloud Standards
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              End-to-end zero-retention security architecture powered by industry-leading technologies.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Next.js 16 */}
            <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200/40 dark:border-zinc-800/50 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-9 w-9 rounded-xl bg-black text-white flex items-center justify-center p-2 font-bold text-xs shadow-md">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 180 180">
                    <mask height="180" id="mask-next" maskUnits="userSpaceOnUse" width="180" x="0" y="0">
                      <rect fill="#fff" height="180" width="180" />
                    </mask>
                    <path d="M149.237 158.847L67.669 54H54V126H66.6853V70.1983L138.253 175.045C142.138 170.217 145.83 164.77 149.237 158.847Z" fill="#fff" />
                    <rect fill="#fff" height="72" width="12.6853" x="113.315" y="54" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Next.js 16 Edge</h3>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Serverless Routing</span>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Generates ephemeral print links with instant global edge routing and serverless sandbox isolation.
              </p>
            </div>

            {/* 2. Google Firebase */}
            <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200/40 dark:border-zinc-800/50 hover:border-amber-500/50 dark:hover:border-amber-500/50 transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center p-2 shadow-md">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M3.89 15.672L6.255.476A.543.543 0 017.22.257l2.846 5.378-6.176 10.037zm16.273 1.341l-2.73-15.037a.54.54 0 00-.938-.282L3.25 17.013l7.983 4.475a1.51 1.51 0 001.45 0l7.48-4.475zM12.87 6.441l1.71 3.238-1.71-3.238z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Google Firebase</h3>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">AES-256 Cloud Purge</span>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Real-time atomic document chunking with self-destructing attempt purge triggers.
              </p>
            </div>

            {/* 3. Chrome Native Messaging */}
            <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200/40 dark:border-zinc-800/50 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center p-2 shadow-md">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 18a6 6 0 110-12 6 6 0 010 12z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Chrome Native API</h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Hardware Spooler</span>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Bypasses browser downloads by spooling directly to physical shop printer hardware drivers.
              </p>
            </div>

            {/* 4. Web Crypto API */}
            <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200/40 dark:border-zinc-800/50 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center p-2 shadow-md">
                  <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Web Crypto API</h3>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Zero-Memory Buffer</span>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Decrypts documents in-memory inside browser RAM and wipes bytes immediately after printing.
              </p>
            </div>

          </div>
      </section>
      {/* Main Grid Catalog */}
      <main id="tools-catalog" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8 scroll-mt-6">
        
        {/* Dynamic Category Tabs */}
        <div className="flex justify-center border-b border-zinc-200/60 dark:border-zinc-800/60 pb-px">
          <div className="flex gap-2 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap px-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3.5 px-3 border-b-2 text-sm font-bold transition-all relative cursor-pointer ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tools Catalog Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
          {filteredTools.map((tool) => (
            <Link
              key={tool.name}
              href={tool.href}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-4">
                
                {/* Icon & Badge Container */}
                <div className="flex justify-between items-start">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tool.color} group-hover:scale-110 transition-transform`}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {tool.icon}
                    </svg>
                  </div>
                  {tool.badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200/30">
                      {tool.badge}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {tool.name}
                  </h3>
                  <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {tool.desc}
                  </p>
                </div>
              </div>

              {/* Action Link Footer */}
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-6">
                Open Tool <span className="transform group-hover:translate-x-1 transition-transform">&rarr;</span>
              </span>
            </Link>
          ))}
        </div>

      </main>

      {/* Why SafelyPrint Was Created: Stopping Document Leakage & Identity Theft */}
      <section 
        aria-labelledby="why-created-heading"
        className="w-full bg-gradient-to-b from-zinc-100 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 border-t border-b border-zinc-200/80 dark:border-zinc-800/80 py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl h-96 bg-red-500/5 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 uppercase tracking-wider">
              🚨 Our Mission &amp; Identity Protection Story
            </span>
            <h2 
              id="why-created-heading"
              className="text-2xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white leading-tight"
            >
              Why We Created SafelyPrint: <span className="text-blue-600">Stopping Document Theft</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Every day, millions of government IDs, driving licenses, bank statements, and tax records are left saved on print shop computers—vulnerable to unauthorized forwarding, WhatsApp leaks, and financial fraud.
            </p>
          </div>

          {/* 3 Core Threat vs Protection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Govt IDs & Licenses */}
            <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 space-y-4 shadow-xl hover:border-red-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-500 dark:text-red-400 flex items-center justify-center text-2xl border border-red-500/20">
                  💳
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/30">
                      High Risk Threat
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Government ID &amp; License Leaks</h3>
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Print shop PCs often retain downloaded PDFs of Driving Licenses, Passports, and Government IDs. Fraudsters exploit saved files for identity theft and fake SIM registration.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
                <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span> SafelyPrint Protection:
                </span>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug">
                  1-time hardware print links block file downloads completely and self-destruct after paper printing.
                </p>
              </div>
            </div>

            {/* Card 2: Financial & Bank Statements */}
            <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 space-y-4 shadow-xl hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center text-2xl border border-amber-500/20">
                  🏦
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                      Financial Risk
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Bank Statement &amp; Tax Exposure</h3>
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Printing loan forms, salary slips, or bank statements reveals sensitive account numbers, balances, and income details to strangers.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
                <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span> SafelyPrint Protection:
                </span>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug">
                  Encrypted zero-memory buffers wipe financial data from memory instantly after execution.
                </p>
              </div>
            </div>

            {/* Card 3: Cloud & Third-Party Leaks */}
            <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 space-y-4 shadow-xl hover:border-blue-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl border border-blue-500/20">
                  🔒
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                      Privacy First
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Zero Cloud Server Retention</h3>
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Standard online PDF tools upload your private documents to remote server disks, leaving permanent digital traces on third-party cloud hosts.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
                <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span> SafelyPrint Protection:
                </span>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug">
                  100% offline WebAssembly processing. Your PDF tools run locally inside your browser with 0 server uploads.
                </p>
              </div>
            </div>

          </div>

          {/* Banner Call to Action */}
          <div className="bg-gradient-to-r from-blue-50 via-zinc-100 to-indigo-50 dark:from-blue-950/40 dark:via-zinc-900 dark:to-indigo-950/40 border border-blue-200/60 dark:border-blue-500/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left shadow-sm">
            <div className="space-y-1.5 max-w-xl">
              <h4 className="text-lg font-extrabold text-zinc-900 dark:text-white">Ready to Protect Your Next Print Job?</h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Generate a 1-time secure print link now and ensure your sensitive documents never stay behind.
              </p>
            </div>
            <Link
              href="/upload"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 transition cursor-pointer whitespace-nowrap"
            >
              Protect &amp; Print Now ➔
            </Link>
          </div>

        </div>
      </section>

      <OnboardingModal 
        isOpen={isOnboardingOpen} 
        onClose={() => setIsOnboardingOpen(false)} 
      />
      <Footer />
    </div>
  );
}

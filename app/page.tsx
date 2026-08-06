// app/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

interface ToolItem {
  name: string;
  href: string;
  desc: string;
  category: "Organize" | "Convert" | "Security" | "Sign & Edit";
  badge?: string;
  color: string; // Tailwind bg color class for icon container
  icon: React.ReactNode;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<string>("All");

  // 1. Configure the comprehensive list of tools
  const toolsList: ToolItem[] = [
    // Organize Category
    {
      name: "Merge PDF",
      href: "/tools/merge",
      desc: "Combine multiple PDF files into one document in any page order.",
      category: "Organize",
      color: "bg-blue-500/10 text-blue-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 7h8m0 0v8a2 2 0 01-2 2h-4m2 0h2" />
    },
    {
      name: "Split PDF",
      href: "/tools/split",
      desc: "Extract specific page ranges or split each page into a separate PDF file.",
      category: "Organize",
      color: "bg-indigo-500/10 text-indigo-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    },
    {
      name: "Reorder Pages",
      href: "/tools/reorder",
      desc: "Drag-and-drop page thumbnails to sort and rearrange pages visually.",
      category: "Organize",
      color: "bg-violet-500/10 text-violet-600",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
    },
    {
      name: "Delete Pages",
      href: "/tools/delete",
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
      href: "/tools/word-to-pdf",
      desc: "Convert Microsoft Word (.docx) documents into standard PDF format.",
      category: "Convert",
      badge: "Beta",
      color: "bg-sky-500/10 text-sky-500",
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
      href: "/tools/sign",
      desc: "Draw, type, or upload custom signatures to place onto PDF pages.",
      category: "Sign & Edit",
      color: "bg-emerald-500/10 text-emerald-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    },
    {
      name: "Annotate PDF",
      href: "/tools/annotate",
      desc: "Add custom text notes, highlights, shapes, and markings directly.",
      category: "Sign & Edit",
      color: "bg-teal-500/10 text-teal-500",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    }
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
            The Safe Document & <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">PDF Toolbox</span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Generate protected web pages for printer shops to disable downloads. Edit, merge, sign, lock, and convert PDFs locally in your browser.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link 
              href="/upload" 
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/10 active:scale-[0.98] transition-all text-sm"
            >
              Generate Secure Print Link
            </Link>
          </div>
        </div>
      </section>

      {/* Main Grid Catalog */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
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

      <Footer />
    </div>
  );
}
// components/Header.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface ToolLink {
  name: string;
  href: string;
  desc: string;
  icon: React.ReactNode;
}

interface Category {
  name: string;
  items: ToolLink[];
}

export default function Header() {
  const { user, logout } = useAuth();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // 1. Initialize Theme on Mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initialTheme = savedTheme || systemTheme;
    
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // 2. Toggle Theme Action
  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    if (activeDropdown === name) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(name);
    }
  };

  const categories: Category[] = [
    {
      name: "Organize",
      items: [
        { name: "Merge PDF", href: "/tools/merge", desc: "Combine multiple PDFs into one", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 7h8m0 0v8a2 2 0 01-2 2h-4m2 0h2" /> },
        { name: "Split PDF", href: "/tools/split", desc: "Separate pages by range", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /> },
        { name: "Reorder Pages", href: "/tools/reorder", desc: "Drag and drop to sort pages", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /> },
        { name: "Delete Pages", href: "/tools/delete", desc: "Remove unwanted pages visually", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> },
      ]
    },
    {
      name: "Convert",
      items: [
        { name: "Image to PDF", href: "/tools/image-to-pdf", desc: "Convert JPG/PNG to PDF format", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
        { name: "PDF to Image", href: "/tools/pdf-to-image", desc: "Export PDF pages as JPG/PNG", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /> },
        { name: "Docx to PDF", href: "/tools/word-to-pdf", desc: "Convert Word documents to PDF", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
        { name: "Extract Text", href: "/tools/extract-text", desc: "Extract raw readable text data", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
      ]
    },
    {
      name: "Security",
      items: [
        { name: "Protect PDF", href: "/tools/protect", desc: "Add opening password encryption", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> },
        { name: "Unlock PDF", href: "/tools/unlock", desc: "Remove password encryption", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /> },
        { name: "Watermark PDF", href: "/tools/watermark", desc: "Stamp custom text or image text", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /> },
        { name: "Page Numbers", href: "/tools/page-numbers", desc: "Embed sequential page numbers", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /> },
      ]
    },
    {
      name: "Sign & Edit",
      items: [
        { name: "Sign PDF", href: "/tools/sign", desc: "Draw or upload your signature", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /> },
        { name: "Annotate PDF", href: "/tools/annotate", desc: "Add shapes, comments, highlights", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /> },
      ]
    }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between" ref={dropdownRef}>
        
        {/* Logo and Nav links */}
        <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center">
            <img
                src="/logo-dark.svg"
                alt="SafelyPrint Logo"
                className="h-7 w-auto block dark:hidden"
            />
            <img
                src="/logo-light.svg" 
                alt="SafelyPrint Logo"
                className="h-7 w-auto hidden dark:block"
            />
        </Link>
        </div>
        <div>
                      <nav className="hidden md:flex items-center gap-1">
            <Link 
              href="/upload" 
              className="text-sm font-semibold px-3 py-2 rounded-lg text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition"
            >
              Secure Share
            </Link>

            {categories.map((category) => (
              <div key={category.name} className="relative">
                <button
                  onClick={() => toggleDropdown(category.name)}
                  className={`flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-lg transition cursor-pointer ${
                    activeDropdown === category.name 
                      ? "text-blue-600 bg-blue-50/50 dark:bg-blue-950/20" 
                      : "text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                  }`}
                >
                  <span>{category.name}</span>
                  <svg className={`h-4 w-4 transform transition-transform duration-200 ${activeDropdown === category.name ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {activeDropdown === category.name && (
                  <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl p-4 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                    {category.items.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setActiveDropdown(null)}
                        className="flex gap-3 items-start p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-950 transition"
                      >
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex-shrink-0 flex items-center justify-center">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {item.icon}
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-white leading-none mb-1">{item.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">{item.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
        {/* Action Buttons & Theme Toggle */}
        <div className="flex items-center gap-4">
          
          {/* Light/Dark Toggle Button */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? (
                // Moon Icon (Switch to Dark)
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                // Sun Icon (Switch to Light)
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828 0l-.707-.707m12.828-12.828l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              )}
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Hi, {user.displayName || user.email?.split("@")[0]}
              </span>
              <Link 
                href="/upload" 
                className="text-sm font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2 rounded-xl transition"
              >
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="text-sm font-semibold text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <Link 
                href="/login" 
                className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
              >
                Sign In
              </Link>
              <Link 
                href="/signup" 
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-500/10 transition"
              >
                Get Started
              </Link>
            </>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1 text-zinc-600 dark:text-zinc-400 hover:text-blue-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 px-4 py-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {categories.map((category) => (
            <div key={category.name} className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {category.name}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {category.items.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex flex-col p-3 rounded-xl border border-zinc-100 dark:border-zinc-900 hover:border-blue-500 dark:hover:border-blue-500 bg-zinc-50/50 dark:bg-zinc-900/30 transition"
                  >
                    <span className="text-sm font-bold text-zinc-900 dark:text-white mb-0.5">{item.name}</span>
                    <span className="text-[10px] text-zinc-500 leading-tight">{item.desc}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
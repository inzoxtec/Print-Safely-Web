// app/dashboard/components/Header.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Initialize Theme from localStorage or system preference
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

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-900/45 backdrop-blur-md px-4 md:px-8 flex items-center justify-between flex-shrink-0 transition-colors duration-300">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onMenuClick}
          className="p-2 md:hidden text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-150 dark:hover:bg-zinc-850 cursor-pointer"
          title="Open Menu"
        >
          <i className="ri-menu-line text-lg"></i>
        </button>

        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Light/Dark Toggle Button */}
        {mounted && (
          <button
            onClick={toggleTheme}
            className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? (
              <i className="ri-moon-line text-base"></i>
            ) : (
              <i className="ri-sun-line text-base"></i>
            )}
          </button>
        )}

        <Link
          href="/upload"
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
        >
          + Create Link
        </Link>
      </div>
    </header>
  );
}

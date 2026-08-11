// app/dashboard/components/Sidebar.tsx
"use client";

import React from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface SidebarProps {
  userEmail: string | null;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  isOpen: boolean; // Mobile Drawer Open
  onClose: () => void; // Mobile Drawer Close
}

export default function Sidebar({
  userEmail,
  isCollapsed,
  setIsCollapsed,
  isOpen,
  onClose
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navItems = [
    {
      name: "Link Manager",
      href: "/dashboard",
      icon: "ri-links-line",
      tooltip: "Link Manager"
    },
    {
      name: "Account & Security",
      href: "/dashboard/account",
      icon: "ri-user-settings-line",
      tooltip: "Account & Security"
    },
    {
      name: "Billing & Pricing",
      href: "/dashboard/billing",
      icon: "ri-wallet-3-line",
      tooltip: "Billing & Pricing"
    }
  ];

  return (
    <>
      {/* 1. MOBILE BACKDROP OVERLAY */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-xs transition-opacity duration-300"
        />
      )}

      {/* 2. SIDEBAR CONTAINER */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 md:sticky md:flex flex-col justify-between flex-shrink-0 transition-all duration-300 bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 ${
          isOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"
        } ${isCollapsed ? "md:w-16" : "md:w-64"}`}
      >
        <div className="p-4 md:p-5 space-y-6 md:space-y-8">
          
          {/* Logo & Close Menu button */}
          <div className={`flex items-center justify-between ${isCollapsed ? "md:justify-center" : ""}`}>
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/logo-dark.svg"
                alt="SafelyPrint Logo"
                className={`h-7 w-auto ${isCollapsed ? "md:hidden" : "block dark:hidden"}`}
              />
              <img
                src="/logo-light.svg"
                alt="SafelyPrint Logo"
                className={`h-7 w-auto ${isCollapsed ? "md:hidden" : "hidden dark:block"}`}
              />
              {isCollapsed && (
                <i className="ri-shield-keyhole-line text-blue-600 dark:text-blue-500 text-2xl" title="SafelyPrint Console"></i>
              )}
            </Link>

            {/* Mobile close drawer button */}
            <button
              onClick={onClose}
              className="p-1 md:hidden text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>

          {/* Sidebar Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`relative group flex items-center py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isCollapsed ? "md:justify-center px-0" : "px-4"
                  } ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-950/40"
                  }`}
                >
                  <i className={`${item.icon} text-base flex-shrink-0`}></i>
                  <span className={`ml-3 transition-opacity ${isCollapsed ? "md:hidden" : "inline"}`}>
                    {item.name}
                  </span>

                  {/* Tooltip bubble when collapsed */}
                  {isCollapsed && (
                    <span className="hidden md:block absolute left-20 bg-zinc-900 dark:bg-zinc-800 text-white border border-zinc-700 px-3 py-1.5 rounded-lg text-[10px] font-bold opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-md whitespace-nowrap z-50">
                      {item.tooltip}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer and Collapse Action Toggle Button */}
        <div className="flex flex-col">
          {/* Desktop collapse toggle action button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-3 border-t border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white justify-center transition cursor-pointer hover:bg-zinc-200/30 dark:hover:bg-zinc-950/30"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <i className="ri-arrow-right-double-line text-sm"></i>
            ) : (
              <i className="ri-arrow-left-double-line text-sm"></i>
            )}
          </button>

          {/* User profile footer details */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30 flex items-center justify-between">
            <div className={`overflow-hidden pr-2 ${isCollapsed ? "md:hidden" : "block"}`}>
              <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold block uppercase tracking-wider">
                Logged In As
              </p>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 font-bold truncate mt-0.5" title={userEmail || ""}>
                {userEmail}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className={`text-zinc-400 dark:text-zinc-505 hover:text-red-600 dark:hover:text-red-400 transition text-xs p-2 cursor-pointer rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-900 ${
                isCollapsed ? "mx-auto" : ""
              }`}
              title="Logout Account"
            >
              <i className="ri-logout-box-r-line"></i>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

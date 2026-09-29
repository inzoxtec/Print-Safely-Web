// app/dashboard/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// Import modular components
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import LinkManager from "./components/LinkManager";
import ShopManager from "./components/ShopManager";

interface LinkItem {
  docId: string;
  files: Array<{
    name: string;
    type: string;
    totalChunks: number;
  }>;
  createdAt: any;
  expiresAt: any;
  printLimit: number;
  printCount: number;
  status: string;
  pinCode?: string | null;
}

function DashboardContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get("tab") === "shop" ? "shop" : "links";

  // Sidebar Layout States
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Links & Shop Data
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [hasShop, setHasShop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const checkShop = async () => {
      try {
        const snap = await getDoc(doc(db, "shops", user.uid));
        setHasShop(snap.exists());
      } catch (e) {}
    };
    checkShop();
  }, [user]);

  const fetchUserLinks = async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    try {
      const q = query(
        collection(db, "documents"),
        where("ownerUid", "==", user.uid)
      );

      const querySnapshot = await getDocs(q);
      const items: LinkItem[] = [];

      querySnapshot.forEach((docSnap) => {
        items.push(docSnap.data() as LinkItem);
      });

      items.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      setLinks(items);
    } catch (err: any) {
      console.error("Dashboard link fetch error:", err);
      setError("Unable to retrieve secure print links. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === "links") {
      fetchUserLinks();
    }
  }, [user, activeTab]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin h-10 w-10 text-blue-600 dark:text-blue-500 rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col md:flex-row overflow-hidden transition-colors duration-300">
      
      {/* Sidebar Panel */}
      <Sidebar 
        userEmail={user ? user.email : ""}
        hasShop={hasShop}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Content Pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Toolbar Header */}
        <Header 
          title={activeTab === "shop" ? "Print Shop Profile" : "Secure Printing Dashboard"}
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        {/* Dashboard Main Workspace */}
        <div className="flex-1 p-6 md:p-8 overflow-auto bg-zinc-50 dark:bg-zinc-950 space-y-6">
          
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-zinc-900 text-white rounded-3xl p-6 md:p-8 space-y-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-500/20 text-blue-200 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border border-blue-400/30 tracking-wider">
                    {hasShop ? "🏪 Verified Print Shop Partner" : "👤 Customer Account"}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black">
                  Welcome back, {displayName}!
                </h2>
                <p className="text-xs md:text-sm text-blue-100 max-w-xl leading-relaxed">
                  Generate self-destructing print links, manage active document security, or customize your local shop listing.
                </p>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/upload"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1.5"
                >
                  <i className="ri-file-shield-line text-sm"></i>
                  <span>+ Upload Document</span>
                </Link>
                <Link
                  href="/shops"
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition active:scale-95 flex items-center gap-1.5"
                >
                  <i className="ri-store-2-line text-sm"></i>
                  <span>Find Print Shops</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Top Tab Switcher */}
          <div className="flex items-center gap-2 bg-zinc-200/60 dark:bg-zinc-900/60 p-1.5 rounded-2xl w-fit border border-zinc-200 dark:border-zinc-800 text-xs font-bold">
            <button
              onClick={() => router.push("/dashboard?tab=links")}
              className={`px-5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                activeTab === "links"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <i className="ri-links-line text-sm"></i>
              <span>My Secure Documents</span>
            </button>
            <button
              onClick={() => router.push("/dashboard?tab=shop")}
              className={`px-5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                activeTab === "shop"
                  ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <i className="ri-store-2-line text-sm"></i>
              <span>{hasShop ? "My Print Shop Profile" : "+ Register Print Shop"}</span>
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 rounded-xl text-xs">
              {error}
            </div>
          )}

          {activeTab === "links" ? (
            <LinkManager 
              links={links} 
              setLinks={setLinks} 
              refreshList={fetchUserLinks} 
            />
          ) : (
            <ShopManager />
          )}
        </div>

      </div>

    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin h-10 w-10 text-blue-600 rounded-full border-4 border-t-transparent" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
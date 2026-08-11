// app/dashboard/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// Import modular components
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import LinkManager from "./components/LinkManager";

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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Sidebar Layout States
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Links Data
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

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
    if (user) {
      fetchUserLinks();
    }
  }, [user]);

  if (authLoading || (loading && links.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-955">
        <div className="animate-spin h-10 w-10 text-blue-600 dark:text-blue-500 rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col md:flex-row overflow-hidden transition-colors duration-300">
      
      {/* Sidebar Panel */}
      <Sidebar 
        userEmail={user ? user.email : ""}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Content Pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Toolbar Header */}
        <Header 
          title="Link Manager Panel"
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        {/* Dashboard Main Workspace */}
        <div className="flex-1 p-6 md:p-8 overflow-auto bg-zinc-50 dark:bg-zinc-950">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 rounded-xl text-xs">
              {error}
            </div>
          )}

          <LinkManager 
            links={links} 
            setLinks={setLinks} 
            refreshList={fetchUserLinks} 
          />
        </div>

      </div>

    </div>
  );
}
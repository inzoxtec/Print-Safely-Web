// app/dashboard/account/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default function AccountPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Sidebar states
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handlePasswordReset = async () => {
    if (!user || !user.email) return;
    setError("");
    setResetSent(false);

    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
    } catch (err: any) {
      console.error(err);
      setError("Failed to send reset link. Try logging out and back in.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin h-10 w-10 text-blue-600 dark:text-blue-500 rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col md:flex-row overflow-hidden transition-colors duration-300">
      <Sidebar 
        userEmail={user ? user.email : ""}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Account Settings"
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        <div className="flex-1 p-6 md:p-8 overflow-auto space-y-6">
          <div className="max-w-2xl space-y-6">
            
            {/* Profile Details Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <i className="ri-profile-line text-blue-600 dark:text-blue-500 text-lg"></i> Profile Details
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-xs text-zinc-650 dark:text-zinc-300">
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 block font-medium">Registered Email</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-bold mt-1 block">{user?.email}</span>
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500 block font-medium">Account Status</span>
                  <span className="px-2 py-0.5 mt-1 bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 rounded-md font-bold text-[9px] uppercase tracking-wider w-fit block">
                    Free Spark Plan
                  </span>
                </div>
              </div>
            </div>

            {/* Credentials & Security Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-6 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <i className="ri-lock-password-line text-blue-600 dark:text-blue-500 text-lg"></i> Credentials & Security
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
                  Request an encrypted reset link to change your console login password. A security email link will be dispatched immediately.
                </p>
              </div>

              {resetSent && (
                <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  Success! An email reset link has been dispatched to your inbox. Check spam if not found.
                </div>
              )}

              {error && (
                <div className="p-3 text-xs bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 rounded-xl">
                  {error}
                </div>
              )}

              <button
                onClick={handlePasswordReset}
                className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold rounded-xl text-xs border border-zinc-300 dark:border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
              >
                <i className="ri-mail-send-line"></i> Send Password Reset Email
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// app/dashboard/account/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  sendPasswordResetEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from "firebase/auth";
import { doc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
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
  const [deleteError, setDeleteError] = useState("");

  // Modal / Confirmation States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isPasswordUser = user?.providerData.some((p) => p.providerId === "password");

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

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (confirmInput.trim().toUpperCase() !== "DELETE") {
      setDeleteError("Please type DELETE to confirm account removal.");
      return;
    }

    if (isPasswordUser && !passwordInput) {
      setDeleteError("Please enter your current password to authorize account deletion.");
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const uid = user.uid;

      // 1. Re-authenticate to ensure Firebase Auth deletes the user record permanently
      if (isPasswordUser) {
        if (!user.email) throw new Error("User email not found.");
        const credential = EmailAuthProvider.credential(user.email, passwordInput);
        await reauthenticateWithCredential(user, credential);
      } else {
        // Google auth reauthentication
        const googleProvider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, googleProvider);
      }

      // 2. Delete user document in Firestore
      try {
        await deleteDoc(doc(db, "users", uid));
      } catch (e) {
        console.warn("Failed to delete user doc:", e);
      }

      // 3. Delete shop document in Firestore if exists
      try {
        await deleteDoc(doc(db, "shops", uid));
      } catch (e) {
        console.warn("Failed to delete shop doc:", e);
      }

      // 4. Delete user documents in Firestore
      try {
        const docsQuery = query(collection(db, "documents"), where("ownerUid", "==", uid));
        const docsSnap = await getDocs(docsQuery);
        docsSnap.forEach(async (d) => {
          await deleteDoc(doc(db, "documents", d.id));
        });
      } catch (e) {
        console.warn("Failed to delete user documents:", e);
      }

      // 5. Delete user permanently from Firebase Authentication Console
      await deleteUser(user);

      // Redirect to home page
      router.push("/?account_deleted=true");
    } catch (err: any) {
      console.error("Failed to delete user account:", err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setDeleteError("Incorrect password. Please enter your correct current password.");
      } else if (err.code === "auth/popup-closed-by-user") {
        setDeleteError("Google authentication popup was closed. Please try again.");
      } else {
        setDeleteError(err.message || "Failed to delete account. Please verify credentials.");
      }
    } finally {
      setDeleting(false);
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
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
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
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <i className="ri-lock-password-line text-blue-600 dark:text-blue-500 text-lg"></i> Credentials & Security
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Request an encrypted reset link to change your login password.
                </p>
              </div>

              {resetSent && (
                <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  Success! An email reset link has been sent to your inbox.
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

            {/* Danger Zone - Delete Account Card */}
            <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-6 rounded-2xl space-y-4 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <i className="ri-delete-bin-line text-lg"></i> Danger Zone
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Permanently delete your account, saved print shop profile, and all active print links. This action cannot be undone.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowDeleteModal(true);
                  setPasswordInput("");
                  setConfirmInput("");
                  setDeleteError("");
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-2"
              >
                <i className="ri-delete-bin-line"></i> Delete Account
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="h-12 w-12 bg-red-100 dark:bg-red-950/60 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                <i className="ri-error-warning-line"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Delete Account Permanently</h3>
                <p className="text-xs text-zinc-500">This will permanently remove your login from Firebase Console.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Deleting your account will erase your login credentials from Firebase Authentication and delete all shop listings and documents.
            </p>

            {isPasswordUser && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Type <span className="text-red-600 dark:text-red-400">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            {deleteError && (
              <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || confirmInput.trim().toUpperCase() !== "DELETE" || (isPasswordUser && !passwordInput)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-delete-bin-line"></i>
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

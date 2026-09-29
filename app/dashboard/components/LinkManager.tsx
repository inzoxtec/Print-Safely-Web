// app/dashboard/components/LinkManager.tsx
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

interface LinkManagerProps {
  links: LinkItem[];
  setLinks: React.Dispatch<React.SetStateAction<LinkItem[]>>;
  refreshList: () => Promise<void>;
}

export default function LinkManager({ links, setLinks, refreshList }: LinkManagerProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "active" | "expired">("all");

  const handleTerminateLink = async (link: LinkItem) => {
    const confirmWipe = window.confirm(`Permanently erase all documents in link: ${link.docId}?`);
    if (!confirmWipe) return;

    setActionLoading(link.docId);
    try {
      const deletePromises: Promise<any>[] = [];
      link.files.forEach((file: any, fileIndex: number) => {
        for (let chunkIndex = 0; chunkIndex < file.totalChunks; chunkIndex++) {
          const chunkRef = doc(db, "documents", link.docId, "chunks", `${fileIndex}_${chunkIndex}`);
          deletePromises.push(deleteDoc(chunkRef).catch((err) => console.warn(err)));
        }
      });
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, "documents", link.docId));
      setLinks((prev) => prev.filter((item) => item.docId !== link.docId));
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete link.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyLink = (docId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/p/${docId}`);
    setCopiedId(docId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimeRemaining = (expiresAtData: any, status: string) => {
    if (status === "printed") return "Purged";
    const now = new Date();
    const expiresAt = expiresAtData?.toDate ? expiresAtData.toDate() : new Date(expiresAtData);
    if (now > expiresAt) return "Expired";
    const diffMins = Math.round((expiresAt.getTime() - now.getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m remaining`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h remaining`;
    return `${Math.round(diffHours / 24)}d remaining`;
  };

  const getStatusBadge = (link: LinkItem) => {
    const now = new Date();
    const expiresAt = link.expiresAt?.toDate ? link.expiresAt.toDate() : new Date(link.expiresAt);
    if (link.status === "printed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-full text-[10px] font-extrabold uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Purged
        </span>
      );
    }
    if (now > expiresAt) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-full text-[10px] font-extrabold uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-extrabold uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
      </span>
    );
  };

  // Stats Calculations
  const activeLinksCount = useMemo(() => {
    return links.filter((l) => {
      const expiresAt = l.expiresAt?.toDate ? l.expiresAt.toDate() : new Date(l.expiresAt);
      return l.status === "active" && new Date() < expiresAt;
    }).length;
  }, [links]);

  const totalPrintsUsed = useMemo(() => {
    return links.reduce((acc, curr) => acc + (curr.printCount || 0), 0);
  }, [links]);

  // Filtered links list
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      const now = new Date();
      const expiresAt = link.expiresAt?.toDate ? link.expiresAt.toDate() : new Date(link.expiresAt);
      const isActive = link.status === "active" && now < expiresAt;

      // Filter Tab logic
      if (filterTab === "active" && !isActive) return false;
      if (filterTab === "expired" && isActive) return false;

      // Search Query logic
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesId = link.docId.toLowerCase().includes(queryLower);
        const matchesFile = link.files.some((f) => f.name.toLowerCase().includes(queryLower));
        return matchesId || matchesFile;
      }

      return true;
    });
  }, [links, filterTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        {/* Active Links Stat Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 rounded-3xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] uppercase font-extrabold text-zinc-400 dark:text-zinc-500 tracking-wider">
              Active Secure Links
            </span>
            <div className="h-9 w-9 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center text-base font-bold border border-blue-100 dark:border-blue-900/40">
              <i className="ri-link"></i>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 relative z-10">
            <p className="text-3xl font-black text-zinc-900 dark:text-white">{activeLinksCount}</p>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live & Ready
            </span>
          </div>
        </div>

        {/* Total Documents / Prints Stat Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 rounded-3xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] uppercase font-extrabold text-zinc-400 dark:text-zinc-500 tracking-wider">
              Total Prints Collected
            </span>
            <div className="h-9 w-9 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center text-base font-bold border border-indigo-100 dark:border-indigo-900/40">
              <i className="ri-printer-line"></i>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 relative z-10">
            <p className="text-3xl font-black text-zinc-900 dark:text-white">{totalPrintsUsed}</p>
            <span className="text-xs text-zinc-400 font-medium">Across {links.length} links</span>
          </div>
        </div>

        {/* Self-Destruct / Storage Stat Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 rounded-3xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] uppercase font-extrabold text-zinc-400 dark:text-zinc-500 tracking-wider">
              Privacy Guarantee
            </span>
            <div className="h-9 w-9 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center text-base font-bold border border-emerald-100 dark:border-emerald-900/40">
              <i className="ri-shield-check-line"></i>
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">Auto Self-Destruct</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">100% Client-Side Decrypted</p>
          </div>
        </div>
      </div>

      {/* Main Links Management Panel */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
        {/* Panel Header & Control Bar */}
        <div className="p-5 md:p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/40">
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <i className="ri-folder-shield-2-line text-blue-600 dark:text-blue-400"></i>
              Secure Print Documents Console
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Manage, copy, or manually wipe your active encrypted print links.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              <i className="ri-add-line text-sm"></i>
              <span>Create Print Link</span>
            </Link>

            <button
              onClick={refreshList}
              className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl transition cursor-pointer text-sm"
              title="Refresh Links List"
            >
              <i className="ri-refresh-line"></i>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Box */}
        <div className="p-4 md:px-6 md:py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900">
          {/* Status Filter Tabs */}
          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold w-full sm:w-auto">
            <button
              onClick={() => setFilterTab("all")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                filterTab === "all"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              All ({links.length})
            </button>
            <button
              onClick={() => setFilterTab("active")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                filterTab === "active"
                  ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active ({activeLinksCount})
            </button>
            <button
              onClick={() => setFilterTab("expired")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                filterTab === "expired"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Expired / Wiped ({links.length - activeLinksCount})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
              <i className="ri-search-line"></i>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Link ID or File Name..."
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Links Data Listing */}
        {filteredLinks.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3 space-y-1">
            <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-3xl flex items-center justify-center text-3xl">
              <i className="ri-folder-open-line"></i>
            </div>
            <h4 className="text-base font-bold text-zinc-900 dark:text-white mt-2">
              {links.length === 0 ? "No Print Links Created Yet" : "No Matching Links Found"}
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
              {links.length === 0
                ? "Generate your first end-to-end encrypted print link to share documents safely with local shop partners."
                : "Try adjusting your search query or switching filter tabs."}
            </p>
            {links.length === 0 && (
              <Link
                href="/upload"
                className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                <i className="ri-file-shield-line text-sm"></i> Upload & Create Link
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/80 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-extrabold text-[9px]">
                  <th className="px-6 py-3.5">Document Code</th>
                  <th className="px-6 py-3.5">File(s) Included</th>
                  <th className="px-6 py-3.5">Print Limit</th>
                  <th className="px-6 py-3.5">Expiration</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50 text-zinc-700 dark:text-zinc-300">
                {filteredLinks.map((link) => {
                  const now = new Date();
                  const expiresAt = link.expiresAt?.toDate ? link.expiresAt.toDate() : new Date(link.expiresAt);
                  const isLinkActive = link.status === "active" && now < expiresAt;

                  return (
                    <tr key={link.docId} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-950/30 transition-colors">
                      {/* Document Code & Security Pill */}
                      <td className="px-6 py-4 font-mono font-extrabold text-zinc-900 dark:text-zinc-200">
                        <div className="flex items-center gap-2">
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg text-xs tracking-wider">
                            {link.docId}
                          </span>
                        </div>
                        {link.pinCode && (
                          <span className="inline-flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                            <i className="ri-key-2-line"></i> PIN Protected
                          </span>
                        )}
                      </td>

                      {/* Included Files */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="font-semibold text-zinc-900 dark:text-white truncate" title={link.files.map((f) => f.name).join(", ")}>
                          {link.files.map((f) => f.name).join(", ")}
                        </div>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">
                          {link.files.length} document{link.files.length > 1 ? "s" : ""}
                        </span>
                      </td>

                      {/* Print Counter */}
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-zinc-900 dark:text-white">
                          {link.printCount} / {link.printLimit}
                        </span>
                        <span className="block text-[10px] text-zinc-400 mt-0.5">prints used</span>
                      </td>

                      {/* Time Remaining */}
                      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-medium">
                        {formatTimeRemaining(link.expiresAt, link.status)}
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4">{getStatusBadge(link)}</td>

                      {/* Action Controls */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleCopyLink(link.docId)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                          >
                            <i className="ri-file-copy-line"></i>
                            <span>{copiedId === link.docId ? "Copied!" : "Copy"}</span>
                          </button>

                          {isLinkActive && (
                            <a
                              href={`/p/${link.docId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                            >
                              <i className="ri-external-link-line"></i> Open
                            </a>
                          )}

                          <button
                            onClick={() => handleTerminateLink(link)}
                            disabled={actionLoading === link.docId}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-[11px] font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            title="Purge & Delete Now"
                          >
                            <i className="ri-delete-bin-line"></i>
                            <span>{actionLoading === link.docId ? "Wiping..." : "Wipe"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

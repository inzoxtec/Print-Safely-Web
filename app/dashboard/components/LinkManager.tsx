// app/dashboard/components/LinkManager.tsx
"use client";

import React, { useState } from "react";
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
      return <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-full text-[10px] font-bold uppercase">🔴 Purged</span>;
    }
    if (now > expiresAt) {
      return <span className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full text-[10px] font-bold uppercase">⚪ Expired</span>;
    }
    return <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold uppercase">🟢 Active</span>;
  };

  const activeLinks = links.filter((l) => {
    const expiresAt = l.expiresAt?.toDate ? l.expiresAt.toDate() : new Date(l.expiresAt);
    return l.status === "active" && new Date() < expiresAt;
  }).length;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Active Links</span>
            <p className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{activeLinks}</p>
          </div>
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500 rounded-xl flex items-center justify-center text-lg">
            <i className="ri-link"></i>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Wiped & Purged</span>
            <p className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{links.length - activeLinks}</p>
          </div>
          <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-xl flex items-center justify-center text-lg">
            <i className="ri-shield-check-line"></i>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Recycled Space</span>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">100% Storage Saved</p>
          </div>
          <div className="h-10 w-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-xl flex items-center justify-center text-lg">
            <i className="ri-bubble-chart-line"></i>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
          <span className="font-bold text-sm text-zinc-900 dark:text-white">Active Secures Console</span>
          <button onClick={refreshList} className="text-xs font-semibold text-blue-600 dark:text-blue-500 hover:underline cursor-pointer flex items-center gap-1.5">
            <i className="ri-refresh-line"></i> Refresh List
          </button>
        </div>

        {links.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <i className="ri-folder-open-line text-4xl text-zinc-400"></i>
            <p className="text-sm font-semibold text-zinc-500">No print links found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-extrabold text-[9px]">
                  <th className="px-6 py-4">Link ID</th>
                  <th className="px-6 py-4">File Name(s)</th>
                  <th className="px-6 py-4">Prints Used</th>
                  <th className="px-6 py-4">Remaining Time</th>
                  <th className="px-6 py-4">Security Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50 text-zinc-700 dark:text-zinc-300">
                {links.map((link) => {
                  const isLinkActive = 
                    link.status === "active" && 
                    new Date() < (link.expiresAt?.toDate ? link.expiresAt.toDate() : new Date(link.expiresAt));

                  return (
                    <tr key={link.docId} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-zinc-800 dark:text-zinc-350">
                        {link.docId}
                        {link.pinCode && <span className="block text-[8px] text-amber-600 dark:text-amber-500 font-extrabold mt-0.5"><i className="ri-key-2-line"></i> PIN REQUIRED</span>}
                      </td>
                      <td className="px-6 py-4 font-medium max-w-xs truncate">
                        {link.files.map((file) => file.name).join(", ")}
                        <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{link.files.length} file(s)</span>
                      </td>
                      <td className="px-6 py-4 font-bold">{link.printCount} / {link.printLimit}</td>
                      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">{formatTimeRemaining(link.expiresAt, link.status)}</td>
                      <td className="px-6 py-4">{getStatusBadge(link)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3.5">
                          <button onClick={() => handleCopyLink(link.docId)} className="text-[10px] font-bold text-blue-600 dark:text-blue-500 hover:underline cursor-pointer flex items-center gap-0.5">
                            <i className="ri-file-copy-line"></i> {copiedId === link.docId ? "Copied!" : "Copy"}
                          </button>
                          {isLinkActive && (
                            <a href={`/p/${link.docId}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:underline flex items-center gap-0.5">
                              <i className="ri-external-link-line"></i> Test
                            </a>
                          )}
                          <button 
                            onClick={() => handleTerminateLink(link)} 
                            disabled={actionLoading === link.docId}
                            className="text-[10px] font-bold text-red-600 hover:text-red-500 hover:underline cursor-pointer disabled:opacity-55 flex items-center gap-0.5"
                          >
                            <i className="ri-delete-bin-line"></i> {actionLoading === link.docId ? "Deleting..." : "Wipe"}
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

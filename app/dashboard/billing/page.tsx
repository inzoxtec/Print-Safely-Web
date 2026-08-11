// app/dashboard/billing/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

interface InvoiceItem {
  id: string;
  date: string;
  type: "Subscription" | "Top-up";
  amount: string;
  status: "Completed" | "Pending";
  method: string;
}

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Sidebar layout states
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [invoices] = useState<InvoiceItem[]>([
    { id: "INV-9241", date: "2026-08-11", type: "Top-up", amount: "₹9.00", status: "Completed", method: "UPI (PhonePe)" },
    { id: "INV-8742", date: "2026-08-01", type: "Subscription", amount: "₹99.00", status: "Completed", method: "UPI (GPay)" }
  ]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

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
          title="Billing Overview"
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        <div className="flex-1 p-6 md:p-8 overflow-auto space-y-6">
          {/* Upgrade Prompt Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-3xl text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <h4 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <i className="ri-vip-crown-fill text-yellow-400"></i> Unlock Premium Capabilities
              </h4>
              <p className="text-xs text-blue-100 max-w-lg leading-relaxed font-medium">
                Upgrade your account to support up to 20 documents, custom branding layout, and priority processing. Plans start at only ₹99/mo.
              </p>
            </div>
            <Link
              href="/pricing"
              className="px-5 py-2.5 bg-white text-blue-600 font-bold rounded-xl text-xs hover:bg-zinc-100 transition whitespace-nowrap shadow-sm text-center"
            >
              View Plans & Pricing
            </Link>
          </div>

          {/* Receipt history table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/40">
              <i className="ri-file-list-3-line text-blue-600 dark:text-blue-500 text-lg"></i>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Order Receipt History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-extrabold text-[9px]">
                    <th className="px-6 py-4">Receipt ID</th>
                    <th className="px-6 py-4">Transaction Date</th>
                    <th className="px-6 py-4">Charge Category</th>
                    <th className="px-6 py-4">Gateway Source</th>
                    <th className="px-6 py-4">Total Paid</th>
                    <th className="px-6 py-4 text-right">Method Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50 text-zinc-700 dark:text-zinc-300">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-zinc-900 dark:text-zinc-350">{inv.id}</td>
                      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">{inv.date}</td>
                      <td className="px-6 py-4 font-semibold">{inv.type}</td>
                      <td className="px-6 py-4 text-zinc-500">{inv.method}</td>
                      <td className="px-6 py-4 font-bold">{inv.amount}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md font-bold text-[9px] uppercase tracking-wider">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

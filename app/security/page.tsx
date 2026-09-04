// app/security/page.tsx
import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import BreadcrumbSchema from "@/app/components/BreadcrumbSchema";

export const metadata: Metadata = {
  title: "Security Rules & Infrastructure Architecture | SafelyPrint",
  description: "Explore SafelyPrint's security architecture. Learn how client-side WebAssembly isolation, AES-256 cloud encryption, and Chrome Native Spooling protect your documents.",
  alternates: {
    canonical: "https://printsafely.app/security",
  },
  openGraph: {
    title: "Security Rules & Infrastructure Architecture | SafelyPrint",
    description: "Explore SafelyPrint's security architecture: WebAssembly client-side sandbox, AES-256 GCM encryption, and anti-download canvas protection.",
    url: "https://printsafely.app/security",
    type: "website",
    siteName: "SafelyPrint",
  },
  twitter: {
    card: "summary_large_image",
    title: "Security Rules | SafelyPrint",
    description: "Zero-Knowledge client-side architecture and hardware print isolation rules.",
  },
};

export default function SecurityPage() {
  const lastUpdated = "September 5, 2026";

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-300">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <BreadcrumbSchema
          items={[
            { name: "Home", url: "https://printsafely.app" },
            { name: "Security Rules", url: "https://printsafely.app/security" },
          ]}
        />

        {/* Hero Header */}
        <div className="space-y-3 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-semibold">
            <i className="ri-shield-check-line"></i> Verified Infrastructure Safeguards
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
            Security Rules & Architecture
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Last Updated: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{lastUpdated}</span>
          </p>
        </div>

        {/* Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white text-base">
              <i className="ri-cpu-line text-blue-500 text-xl"></i> Local WASM Sandbox
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              All PDF manipulations occur within client WebAssembly RAM (`pdf-lib`, `Tesseract.js`). No file buffers leave your browser during tool execution.
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white text-base">
              <i className="ri-key-2-line text-amber-500 text-xl"></i> AES-256 GCM Cloud Encryption
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Print payload fragments are encrypted client-side using Web Crypto API. Encryption keys reside only in the link hash fragment (`#key=...`).
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white text-base">
              <i className="ri-forbid-2-line text-red-500 text-xl"></i> Anti-Save & Anti-Download Safeguards
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Recipient view pages render in secure canvas sandboxes with disabled context menus, disabled download triggers, and anti-save barriers.
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white text-base">
              <i className="ri-printer-cloud-line text-emerald-500 text-xl"></i> Native Hardware Spooling
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              The SafelyPrint Chrome Extension interfaces with Windows native `win32print` hardware directly, bypassing shop computer file saving.
            </p>
          </div>
        </div>

        {/* Deep-Dive Security Rules */}
        <div className="space-y-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          
          {/* Rule 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-black">1</span>
              Zero-Knowledge Storage Architecture
            </h2>
            <p>
              SafelyPrint does not store unencrypted document data, user passwords, or file contents on remote servers. When creating a secure print link:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-600 dark:text-zinc-400 text-xs">
              <li>Documents are chunked into encrypted base64 fragments before transmission.</li>
              <li>Secret key strings are appended to the URL hash fragment (`#key=...`) which is never transmitted to the web server in HTTP requests.</li>
              <li>Database administrators cannot decrypt or view your stored document payloads.</li>
            </ul>
          </section>

          {/* Rule 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-black">2</span>
              Hardware Printer Isolation & Anti-Leak Safeguards
            </h2>
            <p>
              SafelyPrint technical safeguards are engineered to protect sensitive documents (such as bank statements, government IDs, tax filings, or legal agreements) during printing:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-600 dark:text-zinc-400 text-xs">
              <li><strong>Direct Spooling:</strong> Native Messaging bridges web pages directly to Windows physical printer spools (`DEVMODE` paper size, margins, orientation).</li>
              <li><strong>Zero Spool Copies:</strong> No intermediate `.pdf` or `.tmp` files are left in the shop machine&apos;s Downloads folder.</li>
              <li><strong>Self-Destruct Trigger:</strong> Once a print command completes or the view count reaches zero, the Firestore payload is automatically purged.</li>
            </ul>
          </section>

          {/* Rule 3 */}
          <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-black">3</span>
              Responsible Vulnerability Disclosure
            </h2>
            <p>
              We welcome security researchers and developers to audit our open client-side cryptography. If you discover a security concern, please report it privately to our team:
            </p>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200">
              Security Operations: security@printsafely.app | PGP Key fingerprint available upon request.
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// app/privacy/page.tsx
import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import BreadcrumbSchema from "@/app/components/BreadcrumbSchema";

export const metadata: Metadata = {
  title: "Privacy Policy - Client-Side Document Security | SafelyPrint",
  description: "Learn how SafelyPrint protects your privacy. PDF tools process locally in browser memory with zero server file uploads.",
  alternates: {
    canonical: "https://printsafely.app/privacy",
  },
  openGraph: {
    title: "Privacy Policy - Client-Side Document Security | SafelyPrint",
    description: "Your documents stay private. Local browser processing for PDF tools, client-side AES-256 cloud encryption for secure print links.",
    url: "https://printsafely.app/privacy",
    type: "website",
    siteName: "SafelyPrint",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | SafelyPrint",
    description: "Zero-knowledge document security and client-side browser privacy.",
  },
};

export default function PrivacyPage() {
  const lastUpdated = "September 5, 2026";

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-300">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <BreadcrumbSchema
          items={[
            { name: "Home", url: "https://printsafely.app" },
            { name: "Privacy Policy", url: "https://printsafely.app/privacy" },
          ]}
        />

        {/* Hero Header */}
        <div className="space-y-3 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold">
            <i className="ri-shield-keyhole-line"></i> Privacy First Architecture
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Last Updated: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{lastUpdated}</span>
          </p>
        </div>

        {/* Policy Content Body */}
        <div className="space-y-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {/* Summary Box */}
          <div className="p-5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-300 text-base">
              <i className="ri-lock-2-line text-lg"></i> Executive Summary: Privacy Safeguards
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300/90 leading-relaxed">
              At SafelyPrint, your document confidentiality is protected through two core engineering principles:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-blue-800 dark:text-blue-300/90 pl-1">
              <li><strong>Offline PDF Tools:</strong> Zero Server File Uploads. PDF editing, merging, splitting, signing, and converting execute locally inside your browser memory (`RAM`). Your files do not leave your device.</li>
              <li><strong>Secure Print Links:</strong> End-to-End Client Encryption. Documents are encrypted on your device using Web Crypto AES-256 prior to cloud transmission. Decryption keys remain exclusively in your URL link hash (`#key=...`).</li>
            </ul>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">1</span>
              Local Browser Processing (PDF Toolbox)
            </h2>
            <p>
              When using our PDF tools on <Link href="/#tools-catalog" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">printsafely.app/tools</Link>, your files are processed directly inside local WebAssembly memory on your device:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-600 dark:text-zinc-400 text-xs">
              <li>No document data is uploaded to remote servers or external databases during PDF utility execution.</li>
              <li>Rendering, vector manipulation, OCR text extraction, and page sorting execute in local browser RAM.</li>
              <li>Closing your browser tab immediately releases all temporary memory allocations.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">2</span>
              Secure Print Link Transmission & Cloud Encryption
            </h2>
            <p>
              When generating a <Link href="/upload" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Secure Print Link</Link> to share documents for recipient printing:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-600 dark:text-zinc-400 text-xs">
              <li><strong>Client-Side AES-256 Encryption:</strong> Documents are encrypted on your device using Web Crypto AES-256-GCM prior to cloud dispatch.</li>
              <li><strong>Zero-Knowledge Key Storage:</strong> Encryption keys reside strictly within your link hash fragment (`#key=...`), keeping content unreadable on servers.</li>
              <li><strong>Anti-Download Protection:</strong> Recipient view pages render documents in secure canvas sandboxes with disabled context menus, disabled download triggers, and anti-save barriers.</li>
              <li><strong>Self-Destructing Lifecycle:</strong> Once printed or upon link expiration (up to 24 hours), document payloads are permanently purged from encrypted cloud storage.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">3</span>
              Information We Collect & Local Storage
            </h2>
            <p>
              We do not track document content, build user profiles, or sell telemetry data. We utilize local browser storage (`localStorage`) only for:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-600 dark:text-zinc-400 text-xs">
              <li><strong>Theme Preference:</strong> Saving your preference for Light Mode or Dark Mode (`theme`).</li>
              <li><strong>First-Time Visitor Onboarding:</strong> Storing a flag (`safelyprint_onboarding_seen`) so the tutorial modal does not repeat.</li>
              <li><strong>Local Forwarding Queue:</strong> Temporarily storing processed tool outputs in browser IndexedDB when selecting &quot;Forward to Secure Print Link&quot;.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">4</span>
              Third-Party Infrastructure & Extensions
            </h2>
            <p>
              SafelyPrint integrates with minimal, audited cloud infrastructure:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-600 dark:text-zinc-400 text-xs">
              <li><strong>Google Firebase Cloud Storage:</strong> Used exclusively to host short-lived encrypted print payloads with self-destructing lifecycles.</li>
              <li><strong>SafelyPrint Chrome Extension:</strong> Interfaces directly with Windows hardware printers (`win32print`) without saving spool copies to local disk.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">5</span>
              Contact Privacy Team
            </h2>
            <p>
              If you have any questions regarding our privacy architecture or technical safeguards, please reach out:
            </p>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200">
              Email: privacy@printsafely.app | support@printsafely.app
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

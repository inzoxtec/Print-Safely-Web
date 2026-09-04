// app/terms/page.tsx
import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import BreadcrumbSchema from "@/app/components/BreadcrumbSchema";

export const metadata: Metadata = {
  title: "Terms of Service - Usage Terms & Responsibilities | SafelyPrint",
  description: "Read the Terms of Service for SafelyPrint. Terms governing secure print link generation, client-side PDF utility tool usage, and native spooler tools.",
  alternates: {
    canonical: "https://printsafely.app/terms",
  },
  openGraph: {
    title: "Terms of Service - Usage Terms & Responsibilities | SafelyPrint",
    description: "Read the Terms of Service for SafelyPrint. Rules governing secure print link generation and client-side PDF utility tools.",
    url: "https://printsafely.app/terms",
    type: "website",
    siteName: "SafelyPrint",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | SafelyPrint",
    description: "Terms governing the use of SafelyPrint applications, extensions, and PDF services.",
  },
};

export default function TermsPage() {
  const lastUpdated = "September 5, 2026";

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-300">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <BreadcrumbSchema
          items={[
            { name: "Home", url: "https://printsafely.app" },
            { name: "Terms of Service", url: "https://printsafely.app/terms" },
          ]}
        />

        {/* Hero Header */}
        <div className="space-y-3 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold">
            <i className="ri-file-paper-line"></i> User Agreement
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Last Updated: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{lastUpdated}</span>
          </p>
        </div>

        {/* Policy Content Body */}
        <div className="space-y-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">1</span>
              Acceptance of Terms
            </h2>
            <p>
              By accessing or using <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">printsafely.app</Link> (&quot;SafelyPrint&quot;, &quot;the Service&quot;), including our web application, browser extensions, and native printing utilities, you agree to be bound by these Terms of Service. If you do not agree to these terms, you must discontinue your use of the service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">2</span>
              Permitted Use & User Conduct
            </h2>
            <p>
              SafelyPrint provides privacy-focused document printing links and client-side PDF utility tools. You agree to use the Service solely for lawful purposes. You shall not:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-600 dark:text-zinc-400 text-xs">
              <li>Upload, transmit, or share documents containing illegal material, malware, viruses, or unauthorized proprietary data.</li>
              <li>Attempt to reverse-engineer, exploit, or bypass technical safeguards or access control PIN systems.</li>
              <li>Use automated scripts, bots, or scrapers to overload or disrupt our infrastructure.</li>
              <li>Attempt unauthorized interception or tampering with third-party hardware printer spoolers.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">3</span>
              Document Ownership & User Responsibilities
            </h2>
            <p>
              You retain full 100% ownership of all documents, images, and content processed through SafelyPrint. SafelyPrint claims no intellectual property rights over any file or data you upload or process locally.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Users are responsible for verifying document accuracy prior to printing and ensuring that documents shared via secure link comply with applicable privacy laws and third-party confidentiality obligations.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">4</span>
              Secure Print Link Expiration & Self-Destruct
            </h2>
            <p>
              Documents shared via <Link href="/upload" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Secure Print Link</Link> are governed by automatic self-destruct mechanisms. Upon reaching the designated print limit, PIN threshold, or time limit (up to 24 hours), encrypted payloads are permanently deleted from cloud storage.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">5</span>
              Limitation of Liability & Service Availability
            </h2>
            <p>
              SafelyPrint continuously maintains high availability and technical safeguards across our browser utilities and encrypted link infrastructure. The Service is provided as-is for user convenience. SafelyPrint shall not be held liable for third-party hardware printer malfunctions, paper jams, network connectivity interruptions, or external recipient actions.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black">6</span>
              Questions & Legal Contact
            </h2>
            <p>
              For inquiries regarding these Terms of Service or legal compliance, please contact us:
            </p>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200">
              Legal Dept: legal@printsafely.app | support@printsafely.app
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

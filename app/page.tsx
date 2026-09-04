// app/page.tsx
import { Metadata } from "next";
import HomePageClient from "./HomePageClient";
import BreadcrumbSchema from "@/app/components/BreadcrumbSchema";

export const metadata: Metadata = {
  title: "SafelyPrint - Secure Print Link Generator & Offline PDF Toolbox",
  description: "Generate secure, one-time print links for printer shops that disable file downloads. Built with Next.js 16 Edge, Google Firebase Encryption, and Chrome Native Messaging. Merge, split, sign, protect, and convert PDFs 100% locally.",
  keywords: [
    "secure printing",
    "one-time print link",
    "pdf tools offline",
    "client-side pdf merger",
    "print shop security",
    "next.js 16 pdf tools",
    "google firebase encrypted document storage",
    "chrome extension hardware print",
    "merge pdf offline",
    "sign pdf free",
    "delete pdf pages"
  ],
  alternates: {
    canonical: "https://printsafely.app",
  },
  openGraph: {
    title: "SafelyPrint - Secure Print Link Generator & Offline PDF Toolbox",
    description: "Bypass file downloads at printer shops. Share documents securely via print-only links.",
    url: "https://printsafely.app",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SafelyPrint Secure Document Sandbox"
      }
    ]
  }
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SafelyPrint",
    "operatingSystem": "All",
    "applicationCategory": "SecurityApplication",
    "description": "Secure document sharing platform built on Next.js Edge, Google Firebase AES-256 Cloud Encryption, and Chrome Native Messaging API.",
    "softwareRequirements": "Modern Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://printsafely.app" },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageClient />
    </>
  );
}
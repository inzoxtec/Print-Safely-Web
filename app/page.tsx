// app/page.tsx
import { Metadata } from "next";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = {
  title: "SafelyPrint - Secure Print Link Generator & Offline PDF Toolbox",
  description: "Generate secure, one-time print links for printer shops that disable file downloads. Merge, split, sign, protect, and convert PDFs 100% locally in your browser. No server uploads, keeping your documents 100% private.",
  keywords: [
    "secure printing",
    "one-time print link",
    "pdf tools offline",
    "client-side pdf merger",
    "print shop security",
    "merge pdf offline",
    "sign pdf free",
    "delete pdf pages"
  ],
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
  return <HomePageClient />;
}
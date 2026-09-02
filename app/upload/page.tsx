// app/upload/page.tsx
import { Metadata } from "next";
import UploadClient from "./UploadClient";

export const metadata: Metadata = {
  title: "Secure Document Link Generator - Print-Only Sharing | SafelyPrint",
  description: "Share sensitive documents safely with print-only links. Prevent file downloads and PDF saving at print shops with client-side AES-256 encryption and self-destructing links.",
  keywords: [
    "secure document sharing",
    "docsend alternative",
    "print safe document sharing",
    "one time print link",
    "prevent save as pdf",
    "secure document link",
    "print shop leak protection",
    "self destructing document link"
  ],
  alternates: {
    canonical: "https://printsafely.app/upload",
  },
  openGraph: {
    title: "Secure Document Link Generator - Print-Only Sharing | SafelyPrint",
    description: "Share sensitive documents safely with print-only links. Prevent file downloads and PDF saving at print shops.",
    url: "https://printsafely.app/upload",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Secure Document Link Generator" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Secure Document Link Generator - Print-Only Sharing | SafelyPrint",
    description: "Prevent file downloads at print shops with secure, self-destructing print links."
  }
};

export default function Page() {
  return <UploadClient />;
}
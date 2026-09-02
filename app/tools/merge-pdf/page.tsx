// app/tools/merge-pdf/page.tsx
import { Metadata } from "next";
import MergePdf from "./MergePdf";

export const metadata: Metadata = {
  title: "Merge PDF Online Free - Combine PDF Files Privately | SafelyPrint",
  description: "Combine multiple PDF files into a single document online for free. Rearrange page order easily with 100% client-side browser privacy. No server uploads required.",
  keywords: [
    "merge pdf online free",
    "combine pdf files",
    "pdf joiner",
    "merge pdf offline",
    "combine pdf pages",
    "merge multiple pdfs free",
    "secure pdf merger",
    "ilovepdf merge alternative"
  ],
  alternates: {
    canonical: "https://printsafely.app/tools/merge-pdf",
  },
  openGraph: {
    title: "Merge PDF Online Free - Combine PDF Files Privately | SafelyPrint",
    description: "Combine multiple PDF documents into a single organized file online for free with 100% client-side privacy.",
    url: "https://printsafely.app/tools/merge-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Merger" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Merge PDF Online Free - Combine PDF Files Privately | SafelyPrint",
    description: "Combine multiple PDF files easily and securely in your browser for free."
  }
};

export default function Page() {
  return <MergePdf />;
}
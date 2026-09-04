import { Metadata } from "next";
import SplitPdf from "./SplitPdf";

export const metadata: Metadata = {
  title: "Split PDF Online Free - Separate PDF Pages | SafelyPrint",
  description: "Extract specific page ranges or split your PDF into individual files online for free. 100% client-side browser processing with zero file uploads.",
  keywords: [
    "split pdf online free",
    "extract pdf pages",
    "separate pdf pages",
    "pdf splitter free",
    "split pdf by page range",
    "ilovepdf split alternative",
    "secure pdf splitter"
  ],
  alternates: {
    canonical: "https://printsafely.app/tools/split-pdf",
  },
  openGraph: {
    title: "Split PDF Online Free - Separate PDF Pages | SafelyPrint",
    description: "Extract specific page ranges or split PDF pages into individual documents instantly in your browser.",
    url: "https://printsafely.app/tools/split-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Splitter" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Split PDF Online Free - Separate PDF Pages | SafelyPrint",
    description: "Extract pages from your PDF documents for free with 100% client-side privacy."
  }
};

export default function Page() {
  return <SplitPdf />;
}
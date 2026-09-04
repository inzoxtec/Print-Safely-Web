import { Metadata } from "next";
import TxtToPdf from "./TxtToPdf";

export const metadata: Metadata = {
  title: "Convert Text & Markdown to PDF Online Free | SafelyPrint",
  description: "Convert your plain text (.txt) and Markdown (.md) documents into standard styled PDF files directly in your browser online for free with 100% privacy.",
  keywords: ["convert txt to pdf", "convert markdown to pdf", "txt to pdf offline", "md to pdf local", "secure txt converter"],
  alternates: {
    canonical: "https://printsafely.app/tools/txt-to-pdf",
  },
  openGraph: {
    title: "Convert Text & Markdown to PDF Online Free | SafelyPrint",
    description: "Convert plain text and Markdown files to clean PDF documents online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/txt-to-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online Text to PDF Converter" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Convert Text & Markdown to PDF Online Free | SafelyPrint",
    description: "Convert TXT and MD files to PDF easily and securely in your browser."
  }
};

export default function Page() {
  return <TxtToPdf />;
}

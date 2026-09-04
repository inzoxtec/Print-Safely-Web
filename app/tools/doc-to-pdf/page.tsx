import { Metadata } from "next";
import DocxToPdf from "./DocxToPdf";

export const metadata: Metadata = {
  title: "Convert Word DOCX to PDF Online Free | SafelyPrint",
  description: "Convert your Microsoft Word (.docx) files into standard PDF documents directly in your browser online for free with 100% privacy. No server uploads required.",
  keywords: ["convert docx to pdf", "word to pdf offline", "docx to pdf local", "secure word converter", "pdf tools offline"],
  alternates: {
    canonical: "https://printsafely.app/tools/doc-to-pdf",
  },
  openGraph: {
    title: "Convert Word DOCX to PDF Online Free | SafelyPrint",
    description: "Convert Microsoft Word documents to clean PDF files online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/doc-to-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online Word to PDF Converter" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Convert Word DOCX to PDF Online Free | SafelyPrint",
    description: "Convert Word documents to PDF easily and securely in your browser."
  }
};

export default function Page() {
  return <DocxToPdf />;
}
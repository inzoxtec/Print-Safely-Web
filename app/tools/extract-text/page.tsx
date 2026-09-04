import { Metadata } from "next";
import ExtractText from "./ExtractText";

export const metadata: Metadata = {
  title: "Extract Text from PDF & OCR Online Free | SafelyPrint",
  description: "Extract text from PDFs and images (PNG, JPG, WebP) locally in your browser for free. Utilizes secure client-side WebAssembly OCR with 100% privacy.",
  keywords: ["extract text from pdf", "pdf ocr local", "image to text offline", "jpg to text converter", "secure text extractor"],
  alternates: {
    canonical: "https://printsafely.app/tools/extract-text",
  },
  openGraph: {
    title: "Extract Text from PDF & OCR Online Free | SafelyPrint",
    description: "Extract text from PDFs and scanned documents online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/extract-text",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Text Extractor & OCR" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Extract Text from PDF & OCR Online Free | SafelyPrint",
    description: "Convert PDFs and images to text easily and securely in your browser."
  }
};

export default function Page() {
  return <ExtractText />;
}
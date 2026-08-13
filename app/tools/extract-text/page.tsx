// app/tools/extract-text/page.tsx
import { Metadata } from "next";
import ExtractText from "./ExtractText";

export const metadata: Metadata = {
  title: "Extract Text & OCR Online - 100% Private & Local | SafelyPrint",
  description: "Extract text from PDFs and images (PNG, JPG, WebP) locally in your browser. Utilizes secure client-side OCR. No server uploads, keeping files 100% private.",
  keywords: ["extract text from pdf", "pdf ocr local", "image to text offline", "jpg to text converter", "secure text extractor"],
};

export default function Page() {
  return <ExtractText />;
}
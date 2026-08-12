// app/tools/doc-to-pdf/page.tsx
import { Metadata } from "next";
import DocxToPdf from "./DocxToPdf";

export const metadata: Metadata = {
  title: "Convert Word DOCX to PDF Online - 100% Private & Local | SafelyPrint",
  description: "Convert your Microsoft Word (.docx) files into standard PDF documents directly in your browser. No server uploads, keeping your documents 100% private.",
  keywords: ["convert docx to pdf", "word to pdf offline", "docx to pdf local", "secure word converter", "pdf tools offline"],
};

export default function Page() {
  return <DocxToPdf />;
}
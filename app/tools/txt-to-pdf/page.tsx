// app/tools/txt-to-pdf/page.tsx
import { Metadata } from "next";
import TxtToPdf from "./TxtToPdf";

export const metadata: Metadata = {
  title: "Convert Text & Markdown to PDF Online - 100% Private | SafelyPrint",
  description: "Convert your plain text (.txt) and Markdown (.md) documents into standard styled PDF files directly in your browser. No server uploads, keeping your documents 100% private.",
  keywords: ["convert txt to pdf", "convert markdown to pdf", "txt to pdf offline", "md to pdf local", "secure txt converter"],
};

export default function Page() {
  return <TxtToPdf />;
}

import { Metadata } from "next";
import ReorderPdf from "./ReorderPdf";
export const metadata: Metadata = {
  title: "Reorder PDF Online - 100% Secure & Local | SafelyPrint",
  description: "Easily reorder pages in your PDF documents directly in your browser. No server uploads, keeping your documents 100% private.",
  keywords: ["reorder pdf", "pdf pages", "pdf tools", "secure pdf editor"],
};

export default function Page() {
  return <ReorderPdf />;
}
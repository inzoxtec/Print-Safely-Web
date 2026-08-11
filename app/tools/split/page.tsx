import { Metadata } from "next";
import SplitPdf from "./SplitPdf";

export const metadata: Metadata = {
  title: "Split PDF Online - 100% Secure & Local | SafelyPrint",
  description: "Extract specific page ranges or split your PDF into individual files locally in your browser. No server uploads, keeping your documents 100% private.",
  keywords: ["split pdf", "extract pdf pages", "pdf tools", "secure pdf splitter"],
};

export default function Page() {
  return <SplitPdf />;
}
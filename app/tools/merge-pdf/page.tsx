import { Metadata } from "next";
import MergePdf from "./MergePdf";
export const metadata: Metadata = {
  title: "Merge PDF Online - 100% Secure & Local | SafelyPrint",
  description: "Combine multiple PDF files into a single document locally in your browser. No server uploads, keeping your documents 100% private.",
  keywords: ["merge pdf", "combine pdf", "pdf tools", "secure pdf merger"],
};

export default function Page() {
  return <MergePdf />;
}
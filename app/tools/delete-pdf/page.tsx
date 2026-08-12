import { Metadata } from "next";
import DeletePdf from "./DeletePdf";
export const metadata: Metadata = {
  title: "Delete PDF Pages Online - 100% Secure & Local | SafelyPrint",
  description: "Easily delete pages from your PDF documents directly in your browser. No server uploads, keeping your documents 100% private.",
  keywords: ["delete pdf", "pdf pages", "pdf tools", "secure pdf editor"],
};

export default function Page() {
  return <DeletePdf />;
}
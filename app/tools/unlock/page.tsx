// app/tools/unlock/page.tsx
import { Metadata } from "next";
import UnlockPdf from "./UnlockPdf";

export const metadata: Metadata = {
  title: "Unlock PDF Online - Remove PDF Password | SafelyPrint",
  description: "Remove password encryption from locked PDF documents entirely client-side. No server uploads, keeping your documents 100% private.",
  keywords: ["unlock pdf", "remove password from pdf", "decrypt pdf offline", "pdf password remover", "pdf-lib"],
};

export default function Page() {
  return <UnlockPdf />;
}

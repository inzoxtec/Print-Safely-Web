import { Metadata } from "next";
import UnlockPdf from "./UnlockPdf";

export const metadata: Metadata = {
  title: "Unlock PDF Online Free - Remove PDF Password & Restrictions | SafelyPrint",
  description: "Remove password protection and decryption restrictions from PDF documents online for free. 100% client-side browser privacy.",
  keywords: ["unlock pdf", "remove password from pdf", "decrypt pdf offline", "pdf password remover", "pdf-lib unlock"],
  alternates: {
    canonical: "https://printsafely.app/tools/unlock",
  },
  openGraph: {
    title: "Unlock PDF Online Free - Remove PDF Password | SafelyPrint",
    description: "Decrypt protected PDF files securely in your browser with 100% client-side privacy.",
    url: "https://printsafely.app/tools/unlock",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Unlocker" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Unlock PDF Online Free - Remove PDF Password | SafelyPrint",
    description: "Remove PDF passwords easily and securely in your browser for free."
  }
};

export default function Page() {
  return <UnlockPdf />;
}

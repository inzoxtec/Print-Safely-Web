import { Metadata } from "next";
import ProtectPdf from "./ProtectPdf";

export const metadata: Metadata = {
  title: "Protect PDF Online Free - Add Password Encryption | SafelyPrint",
  description: "Encrypt and password-protect your PDF documents online for free. Prevent unauthorized viewing with 256-bit browser-level security.",
  keywords: [
    "protect pdf online free",
    "password protect pdf",
    "encrypt pdf online",
    "lock pdf file",
    "pdf password generator",
    "secure pdf password"
  ],
  alternates: {
    canonical: "https://printsafely.app/tools/protect",
  },
  openGraph: {
    title: "Protect PDF Online Free - Add Password Encryption | SafelyPrint",
    description: "Encrypt your PDF documents with custom passwords online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/protect",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Protector" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Protect PDF Online Free - Add Password Encryption | SafelyPrint",
    description: "Lock and password-protect your PDF files easily and securely in your browser."
  }
};

export default function Page() {
  return <ProtectPdf />;
}

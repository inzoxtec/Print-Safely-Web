// app/tools/sign-pdf/page.tsx
import { Metadata } from "next";
import SignPdf from "./SignPdf";

export const metadata: Metadata = {
  title: "Sign PDF Online Free - Fill & Sign PDFs Privately | SafelyPrint",
  description: "Sign PDF documents online for free in your browser. Add electronic signatures by drawing, typing names in cursive, or uploading signature images. 100% private with no server uploads.",
  keywords: [
    "sign pdf online free",
    "electronic signature pdf",
    "fill and sign pdf",
    "draw signature on pdf",
    "free docusign alternative",
    "sign pdf without registration",
    "digital signature pdf free",
    "type cursive signature pdf"
  ],
  alternates: {
    canonical: "https://printsafely.app/tools/sign-pdf",
  },
  openGraph: {
    title: "Sign PDF Online Free - Fill & Sign PDFs Privately | SafelyPrint",
    description: "Create electronic signatures by drawing, typing cursive signatures, or uploading image signatures. 100% client-side browser privacy.",
    url: "https://printsafely.app/tools/sign-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Signer" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign PDF Online Free - Fill & Sign PDFs Privately | SafelyPrint",
    description: "Add electronic signatures to your PDFs for free. 100% client-side privacy in your browser."
  }
};

export default function Page() {
  return <SignPdf />;
}
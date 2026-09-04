import { Metadata } from "next";
import ReorderPdf from "./ReorderPdf";

export const metadata: Metadata = {
  title: "Reorder PDF Online Free - Organize & Rearrange PDF Pages | SafelyPrint",
  description: "Easily drag and drop to reorder or rearrange pages in your PDF documents online for free. 100% private client-side browser processing.",
  keywords: ["reorder pdf", "organize pdf pages", "rearrange pdf online", "pdf page order", "pdf-lib reorder"],
  alternates: {
    canonical: "https://printsafely.app/tools/reorder-pdf",
  },
  openGraph: {
    title: "Reorder PDF Online Free - Organize PDF Pages | SafelyPrint",
    description: "Drag and drop to rearrange PDF page ordering online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/reorder-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Page Organizer" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Reorder PDF Online Free - Organize PDF Pages | SafelyPrint",
    description: "Reorder PDF document pages easily and securely in your browser for free."
  }
};

export default function Page() {
  return <ReorderPdf />;
}
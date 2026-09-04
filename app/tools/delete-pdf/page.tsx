import { Metadata } from "next";
import DeletePdf from "./DeletePdf";

export const metadata: Metadata = {
  title: "Delete PDF Pages Online Free - Remove Unwanted Pages | SafelyPrint",
  description: "Easily select and delete pages from your PDF documents online for free. 100% private client-side browser processing.",
  keywords: ["delete pdf pages", "remove pages from pdf", "pdf page remover", "delete pdf pages free", "pdf-lib delete"],
  alternates: {
    canonical: "https://printsafely.app/tools/delete-pdf",
  },
  openGraph: {
    title: "Delete PDF Pages Online Free - Remove Unwanted Pages | SafelyPrint",
    description: "Visually select and remove pages from your PDF files online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/delete-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Page Remover" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Delete PDF Pages Online Free | SafelyPrint",
    description: "Remove PDF pages easily and securely in your browser for free."
  }
};

export default function Page() {
  return <DeletePdf />;
}
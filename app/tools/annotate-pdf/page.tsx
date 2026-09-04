import { Metadata } from "next";
import AnnotatePdf from "./AnnotatePdf";

export const metadata: Metadata = {
  title: "Annotate PDF Online Free - Draw, Highlight & Text Comments | SafelyPrint",
  description: "Annotate your PDF documents locally online for free. Draw with pen tool, highlight text, add text comments, and erase annotations in browser memory.",
  keywords: ["annotate pdf", "highlight pdf offline", "pdf drawing tool", "write on pdf free", "pdf-lib annotation"],
  alternates: {
    canonical: "https://printsafely.app/tools/annotate-pdf",
  },
  openGraph: {
    title: "Annotate PDF Online Free - Draw, Highlight & Write Comments | SafelyPrint",
    description: "Annotate your PDF documents online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/annotate-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Annotator" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Annotate PDF Online Free | SafelyPrint",
    description: "Draw, highlight, and write comments on your PDF files easily and securely."
  }
};

export default function Page() {
  return <AnnotatePdf />;
}
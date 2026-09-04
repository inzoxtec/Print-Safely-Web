import { Metadata } from "next";
import PageNumbersPdf from "./PageNumbersPdf";

export const metadata: Metadata = {
  title: "Add Page Numbers to PDF Online Free - Stamp Page Numbers | SafelyPrint",
  description: "Stamp customized page numbers (header or footer, left/center/right alignment) onto each page of your PDF locally in browser memory.",
  keywords: ["add page numbers to pdf", "page numbering pdf offline", "secure pdf page numbers", "pdf-lib page numbering"],
  alternates: {
    canonical: "https://printsafely.app/tools/page-numbers",
  },
  openGraph: {
    title: "Add Page Numbers to PDF Online Free - Stamp Page Numbers | SafelyPrint",
    description: "Stamp customized page numbers onto your PDF documents online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/page-numbers",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Page Numbering" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Add Page Numbers to PDF Online Free | SafelyPrint",
    description: "Add page numbers to your PDF documents easily and securely in your browser."
  }
};

export default function Page() {
  return <PageNumbersPdf />;
}

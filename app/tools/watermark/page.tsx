import { Metadata } from "next";
import WatermarkPdf from "./WatermarkPdf";

export const metadata: Metadata = {
  title: "Add Watermark to PDF Online Free - Stamp Text on PDF | SafelyPrint",
  description: "Stamp text watermarks onto each page of your PDF documents locally. Control size, color, opacity, and rotation in browser memory.",
  keywords: ["add watermark to pdf", "watermark pdf offline", "secure pdf stamper", "pdf-lib watermark"],
  alternates: {
    canonical: "https://printsafely.app/tools/watermark",
  },
  openGraph: {
    title: "Add Watermark to PDF Online Free - Stamp PDF Pages | SafelyPrint",
    description: "Add text watermarks to your PDF pages online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/watermark",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF Watermarker" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Add Watermark to PDF Online Free | SafelyPrint",
    description: "Watermark your PDF documents easily and securely in your browser for free."
  }
};

export default function Page() {
  return <WatermarkPdf />;
}

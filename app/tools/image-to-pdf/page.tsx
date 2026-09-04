import { Metadata } from "next";
import ImageToPdf from "./ImageToPdf";

export const metadata: Metadata = {
  title: "Convert JPG & PNG to PDF Online Free | SafelyPrint",
  description: "Convert JPG, PNG, WebP, and SVG images to PDF files directly in your browser online for free. Rearrange page order easily with 100% browser privacy.",
  keywords: ["convert image to pdf", "jpg to pdf", "png to pdf", "webp to pdf", "images to pdf offline", "secure pdf converter"],
  alternates: {
    canonical: "https://printsafely.app/tools/image-to-pdf",
  },
  openGraph: {
    title: "Convert JPG & PNG to PDF Online Free | SafelyPrint",
    description: "Convert images to clean PDF documents online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/image-to-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online Image to PDF Converter" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Convert JPG & PNG to PDF Online Free | SafelyPrint",
    description: "Convert photos and images to PDF easily and securely in your browser."
  }
};

export default function Page() {
  return <ImageToPdf />;
}
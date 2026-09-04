import { Metadata } from "next";
import PdfToImage from "./PdfToImage";

export const metadata: Metadata = {
  title: "Convert PDF to JPG & PNG Online Free | SafelyPrint",
  description: "Convert your PDF pages into high-quality PNG or JPEG image files directly inside your browser online for free. 100% private client-side browser processing.",
  keywords: ["pdf to image", "pdf to jpg", "pdf to png", "extract images from pdf", "pdf converter local", "secure pdf to image"],
  alternates: {
    canonical: "https://printsafely.app/tools/pdf-to-image",
  },
  openGraph: {
    title: "Convert PDF to JPG & PNG Online Free | SafelyPrint",
    description: "Convert PDF document pages to PNG or JPG images online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/pdf-to-image",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online PDF to Image Converter" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Convert PDF to JPG & PNG Online Free | SafelyPrint",
    description: "Convert PDF pages to image files easily and securely in your browser."
  }
};

export default function Page() {
  return <PdfToImage />;
}
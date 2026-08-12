// app/tools/image-to-pdf/page.tsx
import { Metadata } from "next";
import ImageToPdf from "./ImageToPdf";

export const metadata: Metadata = {
  title: "Convert Image to PDF Online - 100% Private & Local | SafelyPrint",
  description: "Convert JPG, PNG, WebP, and SVG images to PDF files directly in your browser. Rearrange page order easily. No server uploads, keeping your documents 100% private.",
  keywords: ["convert image to pdf", "jpg to pdf", "png to pdf", "webp to pdf", "images to pdf offline", "secure pdf converter"],
};

export default function Page() {
  return <ImageToPdf />;
}
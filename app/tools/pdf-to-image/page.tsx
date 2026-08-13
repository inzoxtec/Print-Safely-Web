// app/tools/pdf-to-image/page.tsx
import { Metadata } from "next";
import PdfToImage from "./PdfToImage";

export const metadata: Metadata = {
  title: "Convert PDF to Image Online - 100% Private & Local | SafelyPrint",
  description: "Convert your PDF pages into high-quality PNG or JPEG image files directly inside your browser. No server uploads, keeping your documents 100% private.",
  keywords: ["pdf to image", "pdf to jpg", "pdf to png", "extract images from pdf", "pdf converter local", "secure pdf to image"],
};

export default function Page() {
  return <PdfToImage />;
}
// app/tools/watermark/page.tsx
import { Metadata } from "next";
import WatermarkPdf from "./WatermarkPdf";

export const metadata: Metadata = {
  title: "Add Watermark to PDF Online - 100% Private & Local | SafelyPrint",
  description: "Stamp text watermarks onto each page of your PDF documents locally. Control size, color, opacity, and rotation in browser memory.",
  keywords: ["add watermark to pdf", "watermark pdf offline", "secure pdf stamper", "pdf-lib watermark"],
};

export default function Page() {
  return <WatermarkPdf />;
}

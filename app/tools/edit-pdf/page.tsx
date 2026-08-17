// app/tools/edit-pdf/page.tsx
import { Metadata } from "next";
import EditPdf from "./EditPdf";

export const metadata: Metadata = {
  title: "Edit PDF Online - Add Text, Images & Shapes | SafelyPrint",
  description: "Edit PDF files directly in your browser. Add draggable text blocks, insert custom PNG/JPG images, draw vector shapes, and sketch freehand offline.",
  keywords: ["edit pdf online", "pdf editor free", "add image to pdf", "draw shapes on pdf", "browser pdf editor"],
};

export default function Page() {
  return <EditPdf />;
}
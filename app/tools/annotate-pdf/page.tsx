// app/tools/annotate-pdf/page.tsx
import { Metadata } from "next";
import AnnotatePdf from "./AnnotatePdf";

export const metadata: Metadata = {
  title: "Annotate PDF Online - Draw, Highlight & Write Comments | SafelyPrint",
  description: "Annotate your PDF documents locally. Free Pen drawing, text comments, highlighter overlays, and erasers running entirely in browser memory.",
  keywords: ["annotate pdf", "highlight pdf offline", "pdf drawing tool", "write on pdf free", "pdf-lib annotation"],
};

export default function Page() {
  return <AnnotatePdf />;
}
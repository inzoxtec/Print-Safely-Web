// app/tools/page-numbers/page.tsx
import { Metadata } from "next";
import PageNumbersPdf from "./PageNumbersPdf";

export const metadata: Metadata = {
  title: "Add Page Numbers to PDF Online - 100% Private & Local | SafelyPrint",
  description: "Stamp customized page numbers (header or footer, left/center/right alignment) onto each page of your PDF locally in browser memory.",
  keywords: ["add page numbers to pdf", "page numbering pdf offline", "secure pdf page numbers", "pdf-lib page numbering"],
};

export default function Page() {
  return <PageNumbersPdf />;
}

// app/tools/sign-pdf/page.tsx
import { Metadata } from "next";
import SignPdf from "./SignPdf";

export const metadata: Metadata = {
  title: "Sign PDF Online - Draw, Type or Upload Signatures | SafelyPrint",
  description: "Sign PDF documents online entirely in your browser. Add digital signatures by drawing, typing names with cursive fonts, or uploading images securely.",
  keywords: ["sign pdf", "electronic signature pdf", "draw signature offline", "docusign free alternative", "pdf-lib signing"],
};

export default function Page() {
  return <SignPdf />;
}
// app/tools/protect/page.tsx
import { Metadata } from "next";
import ProtectPdf from "./ProtectPdf";

export const metadata: Metadata = {
  title: "Protect PDF with Password Online - 100% Private | SafelyPrint",
  description: "Encrypt and password-protect your PDF documents locally. Keep your files 100% safe without server uploads.",
  keywords: ["protect pdf", "lock pdf with password", "encrypt pdf offline", "pdf security", "pdf-lib"],
};

export default function Page() {
  return <ProtectPdf />;
}

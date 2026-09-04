import { Metadata } from "next";
import ExcelToPdf from "./ExcelToPdf";

export const metadata: Metadata = {
  title: "Convert Excel XLSX to PDF Online Free | SafelyPrint",
  description: "Convert your Microsoft Excel (.xlsx or .xls) spreadsheets into standard PDF documents directly in your browser online for free with 100% privacy. No server file uploads.",
  keywords: ["convert excel to pdf", "xlsx to pdf offline", "xls to pdf local", "secure excel converter", "pdf tools offline"],
  alternates: {
    canonical: "https://printsafely.app/tools/excel-to-pdf",
  },
  openGraph: {
    title: "Convert Excel XLSX to PDF Online Free | SafelyPrint",
    description: "Convert Excel spreadsheets to formatted PDF documents online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/excel-to-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online Excel to PDF Converter" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Convert Excel XLSX to PDF Online Free | SafelyPrint",
    description: "Convert Excel spreadsheets to PDF easily and securely in your browser."
  }
};

export default function Page() {
  return <ExcelToPdf />;
}
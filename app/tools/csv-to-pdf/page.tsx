import { Metadata } from "next";
import CsvToPdf from "./CsvToPdf";

export const metadata: Metadata = {
  title: "Convert CSV to PDF Online Free | SafelyPrint",
  description: "Convert your CSV files into formatted PDF documents directly in your browser online for free with 100% privacy. No server file uploads.",
  keywords: ["convert csv to pdf", "csv to pdf offline", "csv converter local", "secure csv viewer", "pdf tools offline"],
  alternates: {
    canonical: "https://printsafely.app/tools/csv-to-pdf",
  },
  openGraph: {
    title: "Convert CSV to PDF Online Free | SafelyPrint",
    description: "Convert CSV spreadsheets to PDF tables online for free with 100% browser privacy.",
    url: "https://printsafely.app/tools/csv-to-pdf",
    type: "website",
    siteName: "SafelyPrint",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SafelyPrint Free Online CSV to PDF Converter" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Convert CSV to PDF Online Free | SafelyPrint",
    description: "Convert CSV files to PDF tables easily and securely in your browser."
  }
};

export default function Page() {
  return <CsvToPdf />;
}

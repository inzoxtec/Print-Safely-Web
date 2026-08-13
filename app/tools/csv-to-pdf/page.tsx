// app/tools/csv-to-pdf/page.tsx
import { Metadata } from "next";
import CsvToPdf from "./CsvToPdf";

export const metadata: Metadata = {
  title: "Convert CSV to PDF Online - 100% Private & Local | SafelyPrint",
  description: "Convert your CSV files into styled PDF documents directly in your browser. No server uploads, keeping your data 100% private.",
  keywords: ["convert csv to pdf", "csv to pdf offline", "csv converter local", "secure csv viewer", "pdf tools offline"],
};

export default function Page() {
  return <CsvToPdf />;
}

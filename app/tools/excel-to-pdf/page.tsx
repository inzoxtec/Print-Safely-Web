// app/tools/excel-to-pdf/page.tsx
import { Metadata } from "next";
import ExcelToPdf from "./ExcelToPdf";

export const metadata: Metadata = {
  title: "Convert Excel XLSX to PDF Online - 100% Private & Local | SafelyPrint",
  description: "Convert your Microsoft Excel (.xlsx or .xls) spreadsheets into standard PDF documents directly in your browser. No server uploads, keeping your data 100% private.",
  keywords: ["convert excel to pdf", "xlsx to pdf offline", "xls to pdf local", "secure excel converter", "pdf tools offline"],
};

export default function Page() {
  return <ExcelToPdf />;
}
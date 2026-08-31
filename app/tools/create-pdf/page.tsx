// app/tools/create-pdf/page.tsx
import CreatePdf from "./CreatePdf";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create PDF Document - Print Safely",
  description: "Build custom A4 slides, place typography, draw vectors, upload images, and compile new PDF documents entirely offline.",
};

export default function Page() {
  return <CreatePdf />;
}
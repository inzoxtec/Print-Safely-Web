import CropPdf from "./CropPdf";

export const metadata = {
  title: "Crop & Trim PDF Margins Online Free | PrintSafely",
  description: "Trim extra white margins off PDF pages before printing. Fast, free, and 100% private in-browser cropper tool.",
  alternates: {
    canonical: "https://print-safely.com/tools/crop-pdf",
  },
};

export default function Page() {
  return <CropPdf />;
}

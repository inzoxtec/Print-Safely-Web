import ShopsClient from "./ShopsClient";

export const metadata = {
  title: "Print Shops Near Me | PrintSafely Directory",
  description:
    "Find registered PrintSafely print shop partners near you. Get physical document printing, scanning, and direct Google Maps directions.",
  alternates: {
    canonical: "https://print-safely.com/shops",
  },
};

export default function ShopsPage() {
  return <ShopsClient />;
}

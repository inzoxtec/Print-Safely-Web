import ShopDetailsClient from "./ShopDetailsClient";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateShopSlug } from "@/lib/slug";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;

  try {
    let data: any = null;

    // 1. Try querying by slug
    const q = query(collection(db, "shops"), where("slug", "==", id));
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      data = querySnap.docs[0].data();
    } else {
      // 2. Fallback to doc ID
      const shopRef = doc(db, "shops", id);
      const snap = await getDoc(shopRef);
      if (snap.exists()) {
        data = snap.data();
      }
    }

    // 3. Fallback: match dynamically generated slug or owner ID
    if (!data) {
      const allShopsSnap = await getDocs(collection(db, "shops"));
      allShopsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const sName = d.shopName || "Print Shop";
        const sCity = d.city || "";
        const computedSlug = d.slug || generateShopSlug(sName, sCity);
        if (docSnap.id === id || computedSlug === id || d.ownerId === id) {
          data = d;
        }
      });
    }

    if (data) {
      const shopName = data.shopName || "Print Shop";
      const city = data.city || "";
      const slug = data.slug || id;
      return {
        title: `${shopName} - Print Shop in ${city} | PrintSafely`,
        description: `View services, operating hours, address, and Google Maps directions for ${shopName} in ${city}. Print documents safely and privately.`,
        alternates: {
          canonical: `https://print-safely.com/shops/${slug}`,
        },
      };
    }
  } catch (err) {
    console.error("Metadata fetch error:", err);
  }

  return {
    title: "Print Shop Details | PrintSafely Directory",
    description: "View registered print shop details, physical address, operating hours, and direct Google Maps directions.",
    alternates: {
      canonical: `https://print-safely.com/shops/${id}`,
    },
  };
}

export default async function ShopDetailsPage({ params }: PageProps) {
  const { id } = await params;
  return <ShopDetailsClient shopId={id} />;
}

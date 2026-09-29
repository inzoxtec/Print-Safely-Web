// app/shops/[id]/ShopDetailsClient.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import BreadcrumbSchema from "@/app/components/BreadcrumbSchema";
import { ShopItem } from "../ShopsClient";
import { generateShopSlug } from "@/lib/slug";

interface ShopDetailsClientProps {
  shopId: string;
}

export default function ShopDetailsClient({ shopId }: ShopDetailsClientProps) {
  const [shop, setShop] = useState<ShopItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchShop = async () => {
      setLoading(true);
      try {
        let data: any = null;
        let realDocId = shopId;

        // 1. Try querying by slug
        const q = query(collection(db, "shops"), where("slug", "==", shopId));
        const querySnap = await getDocs(q);

        if (!querySnap.empty) {
          const docSnap = querySnap.docs[0];
          realDocId = docSnap.id;
          data = docSnap.data();
        } else {
          // 2. Fallback to doc ID
          const shopRef = doc(db, "shops", shopId);
          const snap = await getDoc(shopRef);
          if (snap.exists()) {
            realDocId = snap.id;
            data = snap.data();
          }
        }

        // 3. Robust Fallback: query all shops and match generated slug or doc ID or ownerId
        if (!data) {
          const allShopsSnap = await getDocs(collection(db, "shops"));
          allShopsSnap.forEach((docSnap) => {
            const d = docSnap.data();
            const sName = d.shopName || "Print Shop";
            const sCity = d.city || "";
            const computedSlug = d.slug || generateShopSlug(sName, sCity);
            if (docSnap.id === shopId || computedSlug === shopId || d.ownerId === shopId) {
              realDocId = docSnap.id;
              data = d;
            }
          });
        }

        if (data) {
          const shopName = data.shopName || "Print Shop";
          const city = data.city || "";
          setShop({
            id: realDocId,
            ownerId: data.ownerId || realDocId,
            ownerName: data.ownerName || "",
            ownerEmail: data.ownerEmail || "",
            shopName,
            slug: data.slug || generateShopSlug(shopName, city),
            address: data.address || "",
            city,
            zipCode: data.zipCode || "",
            googleMapsUrl: data.googleMapsUrl || "",
            phone: data.phone || "",
            operatingHours: data.operatingHours || "Mon-Sat: 9:00 AM - 7:00 PM",
            services: data.services || ["Black & White Printout", "Color Printout", "Scanning"],
            isSponsored: data.isSponsored || false,
          });
        } else {
          setShop(null);
        }
      } catch (err) {
        console.error("Failed to load shop details:", err);
      } finally {
        setLoading(false);
      }
    };

    if (shopId) {
      fetchShop();
    }
  }, [shopId]);

  const handleShare = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300">
      <Header />

      <div className="flex-1 flex-col md:flex-row flex w-full max-w-[100vw] justify-center overflow-hidden">
        {/* LEFT AD COLUMN */}
        <aside className="hidden md:flex w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
            <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">
              Verified Partner
            </span>
            <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
              <i className="ri-store-3-line text-blue-500 text-2xl"></i>
              <p className="font-bold">PrintSafely Partner</p>
              <p className="text-[12px] leading-relaxed">
                Physical printing partner verified for secure document collection.
              </p>
              <Link href="/shops" className="text-[12px] text-blue-500 hover:underline block pt-2 font-bold">
                View All Shops &rarr;
              </Link>
            </div>
          </div>
        </aside>

        {/* CENTER MAIN WORKSPACE */}
        <main className="flex-1 max-w-4xl p-6 md:p-8 overflow-auto space-y-8">
          <BreadcrumbSchema
            items={[
              { name: "Home", url: "https://printsafely.app" },
              { name: "Print Shops Directory", url: "https://printsafely.app/shops" },
              { name: shop ? shop.shopName : "Shop Details", url: `https://printsafely.app/shops/${shopId}` },
            ]}
          />

          {loading ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 rounded-3xl text-center space-y-4 shadow-sm">
              <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Loading Print Shop Details...</p>
            </div>
          ) : !shop ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 rounded-3xl text-center space-y-4 shadow-sm">
              <div className="h-14 w-14 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl flex items-center justify-center text-2xl mx-auto">
                <i className="ri-store-2-line"></i>
              </div>
              <h2 className="text-xl font-bold">Print Shop Listing Not Found</h2>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                The requested print shop listing does not exist or has been removed.
              </p>
              <Link
                href="/shops"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                <i className="ri-arrow-left-line"></i> Back to Directory
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Banner Card */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800 pb-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {shop.isSponsored && (
                        <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                          <i className="ri-vip-crown-line"></i> Sponsored
                        </span>
                      )}
                      <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <i className="ri-checkbox-circle-line"></i> PrintSafely Partner
                      </span>
                    </div>

                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                      {shop.shopName}
                    </h1>

                    <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                      <i className="ri-map-pin-line text-blue-600 dark:text-blue-400"></i>
                      <span>
                        {shop.address ? `${shop.address}, ` : ""}
                        {shop.city} {shop.zipCode}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={handleShare}
                      className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="ri-share-line"></i>
                      <span>{copied ? "Copied!" : "Share Shop"}</span>
                    </button>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="space-y-3">
                    <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">
                      Contact & Hours
                    </h3>
                    {shop.operatingHours && (
                      <p className="flex items-center gap-2.5">
                        <i className="ri-time-line text-lg text-zinc-400"></i>
                        <span>{shop.operatingHours}</span>
                      </p>
                    )}
                    {shop.phone && (
                      <p className="flex items-center gap-2.5">
                        <i className="ri-phone-line text-lg text-zinc-400"></i>
                        <span>{shop.phone}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">
                      Location Address
                    </h3>
                    <p className="flex items-start gap-2.5">
                      <i className="ri-map-pin-2-line text-lg text-zinc-400 mt-0.5"></i>
                      <span>
                        {shop.address ? `${shop.address}, ` : ""}
                        {shop.city} {shop.zipCode}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Services Section */}
                {shop.services && shop.services.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-zinc-150 dark:border-zinc-800">
                    <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">
                      Offered Services & Printing Options ({shop.services.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {shop.services.map((svc, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold"
                        >
                          ✓ {svc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Directions Primary CTA */}
                <div className="pt-6 border-t border-zinc-150 dark:border-zinc-800 flex flex-col sm:flex-row gap-3">
                  {shop.googleMapsUrl ? (
                    <a
                      href={shop.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="ri-direction-line text-lg"></i>
                      <span>Get Direct Directions on Google Maps</span>
                    </a>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${shop.shopName} ${shop.address} ${shop.city} ${shop.zipCode}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="ri-map-pin-line text-lg"></i>
                      <span>View Location on Google Maps</span>
                    </a>
                  )}

                  <Link
                    href="/shops"
                    className="py-3 px-5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold rounded-2xl text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <i className="ri-arrow-left-line"></i> Back to Directory
                  </Link>
                </div>
              </div>

              {/* Secure Share Banner for Customers */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl p-6 md:p-8 space-y-3 shadow-xl">
                <span className="bg-emerald-500/20 text-emerald-200 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border border-emerald-400/30">
                  🔒 Privacy Guarantee
                </span>
                <h3 className="text-xl font-bold">Print Documents Privately at {shop.shopName}</h3>
                <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
                  Generate a pin-protected self-destructing print link before visiting this shop. Your document auto-deletes immediately after physical printing.
                </p>
                <div className="pt-2">
                  <Link
                    href="/upload"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-900 font-bold text-xs rounded-xl hover:bg-blue-50 transition shadow"
                  >
                    <i className="ri-shield-keyhole-line"></i>
                    <span>Create Secure Print Link Now</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT AD COLUMN */}
        <aside className="hidden lg:flex w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
            <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">
              Secure Share
            </span>
            <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
              <i className="ri-shield-keyhole-line text-emerald-500 text-2xl"></i>
              <p className="font-bold">🔒 Secure Print Links</p>
              <p className="text-[12px] leading-relaxed">
                Generate pin-protected self-destructing print links before visiting any shop.
              </p>
              <Link href="/upload" className="text-[12px] text-blue-500 hover:underline block pt-2 font-bold">
                Create Link &rarr;
              </Link>
            </div>
          </div>
        </aside>
      </div>

      <Footer />
    </div>
  );
}

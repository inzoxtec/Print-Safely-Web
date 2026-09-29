// app/shops/ShopsClient.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { generateShopSlug } from "@/lib/slug";

export { generateShopSlug };

export interface ShopItem {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  shopName: string;
  slug?: string;
  address: string;
  city: string;
  zipCode: string;
  googleMapsUrl: string;
  phone?: string;
  operatingHours?: string;
  services?: string[];
  isSponsored?: boolean;
  lat?: number;
  lng?: number;
  distanceMiles?: number;
}

// Haversine formula for physical distance in miles
function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function ShopsClient() {
  const { user } = useAuth();
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Fetch shops from Firestore on mount
  useEffect(() => {
    const fetchShops = async () => {
      setLoading(true);
      setFirestoreError(null);
      try {
        const shopsRef = collection(db, "shops");
        const querySnapshot = await getDocs(shopsRef);
        const fetchedShops: ShopItem[] = [];

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const shopName = data.shopName || "Print Shop";
          const city = data.city || "";
          fetchedShops.push({
            id: docSnap.id,
            ownerId: data.ownerId || docSnap.id,
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
            services: data.services || ["B&W Printing", "Color Printing", "Scanning"],
            isSponsored: data.isSponsored || false,
            lat: data.lat,
            lng: data.lng,
          });
        });

        setShops(fetchedShops);
      } catch (err: any) {
        console.error("Failed to fetch print shops:", err);
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          setFirestoreError("Firestore Rules Permission Error: Public read access to the 'shops' collection is currently blocked in your Firebase Console.");
        } else {
          setFirestoreError(err?.message || "Failed to load print shops.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchShops();
  }, []);

  // Request Browser Geolocation
  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    setLocationStatus("Detecting your physical location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setLocating(false);
        setLocationStatus("Location updated! Showing nearest print shops.");

        // Calculate distances if shop coords exist
        setShops((prev) =>
          prev.map((s) => {
            if (s.lat && s.lng) {
              const dist = calculateDistanceMiles(coords.lat, coords.lng, s.lat, s.lng);
              return { ...s, distanceMiles: dist };
            }
            return s;
          })
        );
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus("Location access denied. Search by City or Zip Code below.");
        } else {
          setLocationStatus("Unable to determine your position. Please enter your city or zip code.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Filter and Sort Shops
  const filteredShops = shops
    .filter((shop) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        shop.shopName.toLowerCase().includes(q) ||
        shop.city.toLowerCase().includes(q) ||
        shop.zipCode.toLowerCase().includes(q) ||
        shop.address.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // 1. Sponsored shops first
      if (a.isSponsored && !b.isSponsored) return -1;
      if (!a.isSponsored && b.isSponsored) return 1;

      // 2. Nearest distance if available
      if (a.distanceMiles !== undefined && b.distanceMiles !== undefined) {
        return a.distanceMiles - b.distanceMiles;
      }

      // 3. Alphabetical fallback
      return a.shopName.localeCompare(b.shopName);
    });

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300">
      <Header />

      <div className="flex-1 flex-col md:flex-row flex w-full max-w-[100vw] justify-center overflow-hidden">
        {/* LEFT AD COLUMN */}
        <aside className="hidden md:flex w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
            <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">
              Print Shop Partner
            </span>
            <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
              <i className="ri-store-3-line text-blue-500 text-2xl"></i>
              <p className="font-bold">Register Your Print Shop</p>
              <p className="text-[12px] leading-relaxed">
                Connect with local customers seeking privacy-conscious physical printing.
              </p>
              <Link href="/signup" className="text-[12px] text-blue-500 hover:underline block pt-2 font-bold">
                Join Network &rarr;
              </Link>
            </div>
          </div>
        </aside>

        {/* CENTER MAIN WORKSPACE */}
        <main className="flex-1 max-w-4xl p-6 md:p-8 overflow-auto space-y-8">
          {/* Header Title */}
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              Print Shops Near Me
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Find registered PrintSafely print partners nearby. Get direct map directions and physical document services.
            </p>
          </div>

          {/* Search & Location Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                  <i className="ri-search-line text-base"></i>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by city, zip code, or shop name..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 text-xs md:text-sm"
                />
              </div>

              <button
                type="button"
                onClick={handleNearMe}
                disabled={locating}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-2xl text-xs md:text-sm shadow-md transition-all duration-150 flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer disabled:opacity-50"
              >
                {locating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Locating...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-navigation-line text-lg"></i>
                    <span>📍 Find Print Shops Near Me</span>
                  </>
                )}
              </button>
            </div>

            {locationStatus && (
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5">
                <i className="ri-information-line"></i> {locationStatus}
              </p>
            )}
          </div>

          {firestoreError && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-2xl text-xs space-y-1 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-sm">
                <i className="ri-error-warning-fill text-lg text-red-500"></i>
                <span>Database Permission Alert</span>
              </div>
              <p>{firestoreError}</p>
              <p className="text-[11px] text-red-600 dark:text-red-400">
                To fix this, update your Firestore Security Rules in Firebase Console to allow read access for the <code>shops</code> collection.
              </p>
            </div>
          )}

          {/* Directory Listings */}
          {loading ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 rounded-3xl text-center space-y-4 shadow-sm">
              <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Loading Registered Print Shops...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Registered Partner Shops Header & List */}
              {filteredShops.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                    <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <i className="ri-checkbox-circle-fill text-emerald-500 text-sm"></i>
                      PrintSafely Registered Partners ({filteredShops.length})
                    </span>
                    {userLocation && <span className="font-semibold text-blue-600 dark:text-blue-400">Sorted by distance</span>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredShops.map((shop) => (
                      <div
                        key={shop.id}
                        className={`bg-white dark:bg-zinc-900 border rounded-3xl p-6 space-y-4 shadow-sm hover:shadow-md transition duration-200 relative flex flex-col justify-between ${
                          shop.isSponsored
                            ? "border-amber-400/60 dark:border-amber-500/40 ring-1 ring-amber-400/20"
                            : "border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Shop Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {shop.isSponsored && (
                                  <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                                    <i className="ri-vip-crown-line"></i> Sponsored
                                  </span>
                                )}
                                <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                  <i className="ri-checkbox-circle-line"></i> PrintSafely
                                </span>
                              </div>
                              <h3 className="text-lg font-bold text-zinc-900 dark:text-white leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition">
                                <Link href={`/shops/${shop.slug || shop.id}`}>
                                  {shop.shopName}
                                </Link>
                              </h3>
                            </div>

                            {shop.distanceMiles !== undefined && (
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-xl flex-shrink-0">
                                📍 {shop.distanceMiles} mi
                              </span>
                            )}
                          </div>

                          {/* Details */}
                          <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                            <p className="flex items-start gap-2">
                              <i className="ri-map-pin-line text-zinc-400 flex-shrink-0 mt-0.5"></i>
                              <span>
                                {shop.address ? `${shop.address}, ` : ""}
                                {shop.city} {shop.zipCode}
                              </span>
                            </p>

                            {shop.operatingHours && (
                              <p className="flex items-center gap-2">
                                <i className="ri-time-line text-zinc-400 flex-shrink-0"></i>
                                <span>{shop.operatingHours}</span>
                              </p>
                            )}

                            {shop.phone && (
                              <p className="flex items-center gap-2">
                                <i className="ri-phone-line text-zinc-400 flex-shrink-0"></i>
                                <span>{shop.phone}</span>
                              </p>
                            )}
                          </div>

                          {/* Services Pills */}
                          {shop.services && shop.services.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {shop.services.map((svc, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300"
                                >
                                  {svc}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons: View Details & Get Directions */}
                        <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex items-center gap-2">
                          <Link
                            href={`/shops/${shop.slug || shop.id}`}
                            className="flex-1 py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 transition flex items-center justify-center gap-1.5"
                          >
                            <i className="ri-store-2-line"></i>
                            <span>View Details</span>
                          </Link>

                          {shop.googleMapsUrl ? (
                            <a
                              href={shop.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <i className="ri-direction-line"></i>
                              <span>Get Directions</span>
                            </a>
                          ) : (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${shop.shopName} ${shop.address} ${shop.city} ${shop.zipCode}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <i className="ri-map-pin-line"></i>
                              <span>Directions</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-3 shadow-sm">
                  <div className="h-12 w-12 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center text-xl mx-auto">
                    <i className="ri-store-2-line"></i>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">No Registered Partner Shops in This Area Yet</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                      {searchQuery
                        ? `No PrintSafely registered partners match "${searchQuery}".`
                        : "No print shop owners have registered in this immediate area yet."}
                    </p>
                  </div>
                </div>
              )}

              {/* Google Maps General Nearby Fallback & Preset Quick Search */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white rounded-3xl p-6 md:p-8 space-y-5 shadow-xl border border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-[10px] font-bold border border-blue-400/30 mb-1">
                      <i className="ri-google-fill"></i> Google Maps Directory
                    </div>
                    <h3 className="text-lg font-bold">Find Local Print Shops on Google Maps</h3>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    📍 {userLocation ? "Using your live location" : searchQuery ? `Searching near "${searchQuery}"` : "Search near your location"}
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  Looking for nearby copy centers, FedEx Office, Staples, or local print shops? Click below to search all physical print shops directly on Google Maps.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={
                      userLocation
                        ? `https://www.google.com/maps/search/print+shops+near+me/@${userLocation.lat},${userLocation.lng},14z`
                        : searchQuery
                        ? `https://www.google.com/maps/search/print+shops+in+${encodeURIComponent(searchQuery)}`
                        : "https://www.google.com/maps/search/print+shops+near+me"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl shadow transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="ri-map-pin-2-line text-base"></i>
                    <span>Open &quot;Print Shops Near Me&quot; on Google Maps</span>
                    <i className="ri-external-link-line text-xs"></i>
                  </a>

                  <Link
                    href="/signup"
                    className="py-3 px-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-2xl border border-zinc-700 transition flex items-center justify-center gap-2"
                  >
                    <i className="ri-store-2-line text-base"></i>
                    <span>Register Your Shop</span>
                  </Link>
                </div>

                {/* Quick Presets for standard physical chains */}
                <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    Quick Search by Chain (Google Maps):
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {[
                      "FedEx Office",
                      "Staples Printing",
                      "UPS Store",
                      "Local Copy Center",
                      "Passport & Photo Printing",
                    ].map((chain) => (
                      <a
                        key={chain}
                        href={
                          userLocation
                            ? `https://www.google.com/maps/search/${encodeURIComponent(chain)}/@${userLocation.lat},${userLocation.lng},14z`
                            : `https://www.google.com/maps/search/${encodeURIComponent(chain)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700/60 transition flex items-center gap-1.5"
                      >
                        <i className="ri-search-2-line text-[10px] text-zinc-400"></i>
                        <span>{chain}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Smart Shop Owner Callout Banner */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl p-8 space-y-4 shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <span className="bg-blue-500/20 text-blue-200 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border border-blue-400/30">
                Print Shop Partner Network
              </span>
              
              {user && shops.some((s) => s.ownerId === user.uid) ? (
                <>
                  <h3 className="mt-4 text-xl font-bold flex items-center gap-2">
                    <i className="ri-checkbox-circle-fill text-emerald-400"></i>
                    You are registered with SafelyPrint
                  </h3>
                  <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
                    Manage your print shop profile, operating hours, directions link, and custom printing services from your dashboard.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/dashboard?tab=shop"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-900 font-bold text-xs rounded-xl hover:bg-blue-50 transition shadow"
                    >
                      <i className="ri-dashboard-line"></i>
                      <span>Manage My Shop Profile</span>
                    </Link>
                  </div>
                </>
              ) : user ? (
                <>
                  <h3 className="mt-4 text-xl font-bold">Register Your Print Shop ({user.email})</h3>
                  <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
                    Register your physical print shop under your existing account to get listed in local customer searches.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/signup?mode=register_shop"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-900 font-bold text-xs rounded-xl hover:bg-blue-50 transition shadow"
                    >
                      <i className="ri-store-2-line"></i>
                      <span>Register My Shop Now</span>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold">Grow Your Physical Printing Business</h3>
                  <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
                    Register your print shop with PrintSafely to be listed in local customer searches and receive secure, privacy-focused walk-in customers.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-900 font-bold text-xs rounded-xl hover:bg-blue-50 transition shadow"
                    >
                      <i className="ri-store-2-line"></i>
                      <span>Register My Shop Free</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
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

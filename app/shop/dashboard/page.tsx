// app/shop/dashboard/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

const PREDEFINED_SERVICES = [
  "Black & White Printout",
  "Color Printout",
  "Photo Printing / Passport Photos",
  "Lamination",
  "Spiral & Book Binding",
  "Visiting Cards / Business Cards",
  "Flex & Banner Printing",
  "Document Scanning",
  "A4 / A3 Paper Printing",
  "Sticker & Label Printing",
  "ID Card Printing",
  "Project Report Printing",
];

export default function ShopOwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [operatingHours, setOperatingHours] = useState("Mon-Sat: 9:00 AM - 7:00 PM");
  const [services, setServices] = useState<string[]>([
    "Black & White Printout",
    "Color Printout",
    "Document Scanning",
    "Lamination",
  ]);
  const [customServiceInput, setCustomServiceInput] = useState("");
  const [isSponsored, setIsSponsored] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirectTo=/shop/dashboard");
    }
  }, [user, authLoading, router]);

  // Fetch shop document for logged in user
  useEffect(() => {
    const fetchShopDetails = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const shopRef = doc(db, "shops", user.uid);
        const snap = await getDoc(shopRef);

        if (snap.exists()) {
          const data = snap.data();
          setShopName(data.shopName || "");
          setAddress(data.address || "");
          setCity(data.city || "");
          setZipCode(data.zipCode || "");
          setGoogleMapsUrl(data.googleMapsUrl || "");
          setPhone(data.phone || "");
          setOperatingHours(data.operatingHours || "Mon-Sat: 9:00 AM - 7:00 PM");
          setServices(
            data.services || [
              "Black & White Printout",
              "Color Printout",
              "Document Scanning",
              "Lamination",
            ]
          );
          setIsSponsored(data.isSponsored || false);
        } else {
          // If no shop record yet, prefill default name from user profile
          setShopName(user.displayName ? `${user.displayName}'s Print Shop` : "My Print Shop");
        }
      } catch (err) {
        console.error("Failed to load shop details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchShopDetails();
  }, [user]);

  const toggleService = (svc: string) => {
    setServices((prev) =>
      prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
    );
  };

  const handleAddCustomService = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customServiceInput.trim();
    if (trimmed && !services.includes(trimmed)) {
      setServices((prev) => [...prev, trimmed]);
      setCustomServiceInput("");
    }
  };

  const removeService = (svcToRemove: string) => {
    setServices((prev) => prev.filter((s) => s !== svcToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    try {
      const shopRef = doc(db, "shops", user.uid);
      await setDoc(
        shopRef,
        {
          id: user.uid,
          ownerId: user.uid,
          ownerName: user.displayName || user.email?.split("@")[0] || "",
          ownerEmail: user.email || "",
          shopName,
          address,
          city,
          zipCode,
          googleMapsUrl,
          phone,
          operatingHours,
          services,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Also ensure user role is updated
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, { role: "shop_owner" }, { merge: true });

      setMessage({ type: "success", text: "Shop details updated successfully!" });
    } catch (err: any) {
      console.error("Save shop error:", err);
      setMessage({ type: "error", text: "Failed to save shop details. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin h-10 w-10 text-blue-600 rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 md:p-8 space-y-8">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold mb-2">
              <i className="ri-store-2-line"></i> Shop Owner Dashboard
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Print Shop Profile Settings</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Manage your shop listing, address, custom services, and Google Maps directions link.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/shops"
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <i className="ri-external-link-line"></i> View Directory
            </Link>
          </div>
        </div>

        {/* Dual Capability Shortcut Banner */}
        <div className="bg-gradient-to-r from-blue-900/90 to-indigo-900/90 text-white rounded-3xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-extrabold text-blue-300 uppercase tracking-wider">
              <i className="ri-user-star-line"></i> Dual Customer & Shop Access
            </div>
            <p className="text-xs text-blue-100">
              As a Print Shop Owner, you have full access to all customer features: Secure Link Sharing and PDF tools.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/upload"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
            >
              <i className="ri-shield-keyhole-line"></i> Secure Share
            </Link>
            <Link
              href="/dashboard"
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition flex items-center gap-1.5"
            >
              <i className="ri-file-list-line"></i> My Files
            </Link>
          </div>
        </div>

        {/* Success / Error Message */}
        {message && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200 ${
              message.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`}
          >
            <span className="flex items-center gap-2">
              <i className={message.type === "success" ? "ri-checkbox-circle-fill text-lg" : "ri-error-warning-fill text-lg"}></i>
              {message.text}
            </span>
            <button onClick={() => setMessage(null)} className="text-zinc-400 hover:text-zinc-600">
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Edit Form (2 Cols) */}
          <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider border-b border-zinc-150 dark:border-zinc-800 pb-3">
                General Shop Info
              </h3>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Express Print & Copy Center"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs md:text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    value={operatingHours}
                    onChange={(e) => setOperatingHours(e.target.value)}
                    placeholder="Mon-Sat: 9:00 AM - 7:00 PM"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider border-b border-zinc-150 dark:border-zinc-800 pb-3">
                Location & Directions Link
              </h3>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Phase 3B1, Main Market"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs md:text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mohali"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Zip / Pincode
                  </label>
                  <input
                    type="text"
                    required
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="160059"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Google Maps / Business Directions URL
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                    <i className="ri-map-pin-line"></i>
                  </span>
                  <input
                    type="url"
                    required
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Customers clicking &quot;Get Directions&quot; on your card will be redirected straight to this link in Google Maps.
                </p>
              </div>
            </div>

            {/* Services Offered Section with Custom Service Input Box */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Offered Services & Printing Options
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Select popular services or add custom services offered by your shop.
                  </p>
                </div>
              </div>

              {/* Add Custom Service Input Box */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customServiceInput}
                  onChange={(e) => setCustomServiceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomService();
                    }
                  }}
                  placeholder="Type custom service (e.g. Mug Printing, Project Report, Urgent Xerox)..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={handleAddCustomService}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition flex-shrink-0 cursor-pointer"
                >
                  + Add Service
                </button>
              </div>

              {/* Predefined Popular Service Checkboxes */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Popular Services:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PREDEFINED_SERVICES.map((svc) => (
                    <label
                      key={svc}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                        services.includes(svc)
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                          : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={services.includes(svc)}
                        onChange={() => toggleService(svc)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{svc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Selected Service Pills with Remove Action */}
              {services.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    Active Services on Your Card ({services.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((svc) => (
                      <span
                        key={svc}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold"
                      >
                        <span>{svc}</span>
                        <button
                          type="button"
                          onClick={() => removeService(svc)}
                          className="hover:text-red-500 transition text-sm leading-none cursor-pointer"
                          title="Remove service"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs md:text-sm"
            >
              {saving ? (
                <>
                  <div className="animate-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving Shop Profile...</span>
                </>
              ) : (
                <>
                  <i className="ri-save-line text-lg"></i>
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </form>

          {/* Card Live Preview (1 Col) */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              Directory Card Preview
            </h3>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-md sticky top-20">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {isSponsored && (
                    <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                      ★ Sponsored
                    </span>
                  )}
                  <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    ✓ PrintSafely Partner
                  </span>
                </div>
                <h4 className="text-base font-bold text-zinc-900 dark:text-white">
                  {shopName || "Your Shop Name"}
                </h4>
              </div>

              <div className="space-y-1.5 text-xs text-zinc-500">
                <p className="flex items-start gap-2">
                  <i className="ri-map-pin-line text-zinc-400 flex-shrink-0 mt-0.5"></i>
                  <span>
                    {address || "Phase 3B1"}, {city || "Mohali"} {zipCode || "160059"}
                  </span>
                </p>

                {operatingHours && (
                  <p className="flex items-center gap-2">
                    <i className="ri-time-line text-zinc-400 flex-shrink-0"></i>
                    <span>{operatingHours}</span>
                  </p>
                )}

                {phone && (
                  <p className="flex items-center gap-2">
                    <i className="ri-phone-line text-zinc-400 flex-shrink-0"></i>
                    <span>{phone}</span>
                  </p>
                )}
              </div>

              {services.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {services.map((svc, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-4 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 opacity-90 cursor-default"
                >
                  <i className="ri-direction-line text-base"></i>
                  <span>Get Directions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

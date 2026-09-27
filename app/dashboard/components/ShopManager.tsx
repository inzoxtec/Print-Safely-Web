// app/dashboard/components/ShopManager.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { generateShopSlug } from "@/lib/slug";

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

export default function ShopManager() {
  const { user } = useAuth();

  const [hasShop, setHasShop] = useState(false);
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

  // Delete Shop Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingShop, setDeletingShop] = useState(false);

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
          setHasShop(true);
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
          setHasShop(false);
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
          slug: generateShopSlug(shopName, city),
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

      // Ensure user role is updated to shop_owner
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, { role: "shop_owner" }, { merge: true });

      setHasShop(true);
      setMessage({ type: "success", text: "Shop profile saved successfully!" });
    } catch (err: any) {
      console.error("Save shop error:", err);
      setMessage({ type: "error", text: "Failed to save shop details. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShop = async () => {
    if (!user) return;
    setDeletingShop(true);
    try {
      await deleteDoc(doc(db, "shops", user.uid));
      await setDoc(doc(db, "users", user.uid), { role: "user" }, { merge: true });
      setHasShop(false);
      setShowDeleteModal(false);
      setMessage({ type: "success", text: "Your print shop listing has been unlisted and deleted." });
    } catch (err) {
      console.error("Failed to delete shop listing:", err);
      setMessage({ type: "error", text: "Failed to delete shop profile. Please try again." });
    } finally {
      setDeletingShop(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 rounded-3xl text-center space-y-4 shadow-sm">
        <div className="animate-spin h-8 w-8 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs font-bold text-zinc-900 dark:text-white">Loading Shop Profile...</p>
      </div>
    );
  }

  // IF CUSTOMER (NO SHOP REGISTERED YET) - SHOW CLEAN INLINE REGISTRATION CARD
  if (!hasShop) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl p-8 space-y-4 shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <span className="bg-blue-500/20 text-blue-200 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border border-blue-400/30">
              Print Shop Partner Registration
            </span>
            <h3 className="text-2xl font-bold">Register Your Print Shop Profile</h3>
            <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
              Register your physical shop under your current account ({user?.email}) to get listed in local customer searches and receive secure walk-in customers.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between ${
              message.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-zinc-400 hover:text-zinc-600">
              &times;
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 space-y-5 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider border-b border-zinc-150 dark:border-zinc-800 pb-3">
            Create Print Shop Profile
          </h3>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              Print Shop Name
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
              Street Address
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Phase 3B1, Main Market"
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              Google Maps Directions URL
            </label>
            <input
              type="url"
              required
              value={googleMapsUrl}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs md:text-sm"
          >
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                <span>Registering Shop...</span>
              </>
            ) : (
              <>
                <i className="ri-store-2-line text-base"></i>
                <span>Register Shop & Get Listed</span>
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  // REGISTERED SHOP OWNER PROFILE VIEW
  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl">
        <div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
            <i className="ri-checkbox-circle-fill"></i> Shop Listing Active
          </span>
          <p className="text-xs text-zinc-500 mt-0.5">Your shop is published on the PrintSafely directory.</p>
        </div>

        {user && (
          <Link
            href={`/shops/${user.uid}`}
            target="_blank"
            className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-xl hover:bg-blue-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <i className="ri-external-link-line"></i> View Live Public Shop Page
          </Link>
        )}
      </div>

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
            &times;
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
            </div>
          </div>

          {/* Services Section */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Offered Services & Printing Options
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Select popular services or add custom services offered by your shop.
              </p>
            </div>

            {/* Custom Input Box */}
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
                <span>Save Profile Changes</span>
              </>
            )}
          </button>

          {/* Delete Print Shop Listing Card */}
          <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-6 rounded-3xl space-y-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                <i className="ri-delete-bin-line text-base"></i> Delete Print Shop Listing
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Unlist your shop profile from the public directory. Your customer account will remain active.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
            >
              <i className="ri-delete-bin-line"></i> Unlist & Delete Shop Listing
            </button>
          </div>
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

      {/* Delete Shop Listing Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="h-12 w-12 bg-red-100 dark:bg-red-950/60 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                <i className="ri-error-warning-line"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Delete Shop Listing</h3>
                <p className="text-xs text-zinc-500">Unlist your shop from the public directory.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to delete your print shop listing? Your shop will be removed from the public directory. Your customer account will remain active.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingShop}
                className="px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteShop}
                disabled={deletingShop}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
              >
                {deletingShop ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-delete-bin-line"></i>
                    <span>Delete Shop Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// app/signup/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { generateShopSlug } from "@/lib/slug";

function SignupContent() {
  const { user, loginWithGoogle } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const mode = searchParams.get("mode");
  const [accountType, setAccountType] = useState<"user" | "shop_owner">(
    mode === "register_shop" ? "shop_owner" : "user"
  );

  // User details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Shop Owner details
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Pre-fill user data if logged in
  useEffect(() => {
    if (user) {
      setName(user.displayName || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const rawRedirectTo = searchParams.get("redirectTo") || "/dashboard";
  const reason = searchParams.get("reason");
  const redirectTo = rawRedirectTo.startsWith("/") && !rawRedirectTo.startsWith("//") ? rawRedirectTo : "/dashboard";
  const isForwardedDoc = redirectTo === "/upload" || reason === "forwarded_file";

  // Handle registration for LOGGED-IN customer upgrading to a Print Shop
  const handleExistingUserShopRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);

    try {
      const uid = user.uid;
      const ownerName = name || user.displayName || user.email?.split("@")[0] || "Shop Owner";

      // Update User Role to shop_owner
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, {
        role: "shop_owner",
        name: ownerName,
      }, { merge: true });

      // Create or Update Shop Profile
      const shopRef = doc(db, "shops", uid);
      const effectiveShopName = shopName || `${ownerName}'s Print Shop`;
      const effectiveCity = city || "";
      await setDoc(shopRef, {
        id: uid,
        ownerId: uid,
        ownerName: ownerName,
        ownerEmail: user.email || "",
        shopName: effectiveShopName,
        slug: generateShopSlug(effectiveShopName, effectiveCity),
        address: address || "",
        city: effectiveCity,
        zipCode: zipCode || "",
        googleMapsUrl: googleMapsUrl || "",
        phone: "",
        operatingHours: "Mon-Sat: 9:00 AM - 7:00 PM",
        services: ["Black & White Printout", "Color Printout", "Document Scanning", "Lamination"],
        isSponsored: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      router.push("/shop/dashboard");
    } catch (err: any) {
      console.error("Shop registration error:", err);
      setError(err.message || "Failed to register print shop.");
    } finally {
      setLoading(false);
    }
  };

  // Handle registration for NEW user signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await updateProfile(userCredential.user, {
        displayName: name,
      });

      // Save user document in Firestore
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, {
        uid,
        name,
        email,
        role: accountType,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      if (accountType === "shop_owner") {
        const shopRef = doc(db, "shops", uid);
        const effectiveShopName = shopName || `${name}'s Print Shop`;
        const effectiveCity = city || "";
        await setDoc(shopRef, {
          id: uid,
          ownerId: uid,
          ownerName: name,
          ownerEmail: email,
          shopName: effectiveShopName,
          slug: generateShopSlug(effectiveShopName, effectiveCity),
          address: address || "",
          city: effectiveCity,
          zipCode: zipCode || "",
          googleMapsUrl: googleMapsUrl || "",
          phone: "",
          operatingHours: "Mon-Sat: 9:00 AM - 7:00 PM",
          services: ["Black & White Printout", "Color Printout", "Document Scanning", "Lamination"],
          isSponsored: false,
          createdAt: new Date().toISOString(),
        });
        router.push("/shop/dashboard");
      } else {
        router.push(redirectTo);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create an account.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      router.push(redirectTo);
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Failed to sign up with Google.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // IF USER IS ALREADY LOGGED IN
  if (user) {
    return (
      <div className="w-full max-w-lg bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl rounded-3xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold">
            <i className="ri-user-line"></i> Signed In as {user.email}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Register Your Print Shop
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Register your physical shop under your current account to start receiving local customers.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3.5 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleExistingUserShopRegistration} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Owner Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Full Name"
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Print Shop Name
            </label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="e.g. Express Print & Copy Center"
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Zip / Pincode
              </label>
              <input
                type="text"
                required
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 160059"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Google Maps / Directions Link
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer text-xs"
          >
            {loading ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <i className="ri-store-2-line text-base"></i>
                <span>Register Shop & Go to Dashboard</span>
              </>
            )}
          </button>
        </form>

        <div className="border-t border-zinc-200/50 dark:border-zinc-800/50 pt-4 text-center">
          <Link
            href="/shop/dashboard"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:underline transition"
          >
            Skip to Dashboard &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // STANDARD LOGGED-OUT SIGNUP FLOW
  return (
    <div className="w-full max-w-md bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl rounded-2xl p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Create an account
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign up to start printing safely
        </p>
      </div>

      {/* Account Type Tabs */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold">
        <button
          type="button"
          onClick={() => setAccountType("user")}
          className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            accountType === "user"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <i className="ri-user-line"></i> Customer Account
        </button>
        <button
          type="button"
          onClick={() => setAccountType("shop_owner")}
          className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            accountType === "shop_owner"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <i className="ri-store-2-line"></i> Print Shop Owner
        </button>
      </div>

      {/* Forwarded Document Notice */}
      {isForwardedDoc && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 p-3.5 rounded-xl text-xs flex items-center gap-3 animate-in fade-in">
          <i className="ri-file-shield-line text-xl text-blue-600 dark:text-blue-400 flex-shrink-0"></i>
          <div>
            <span className="font-extrabold block text-zinc-900 dark:text-white text-xs mb-0.5">Document Ready to Share!</span>
            <span>Create a free account to generate your secure print link. Your document attachment is saved.</span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm transition-all duration-200 animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </div>
      )}

      {/* Google Sign Up Button */}
      {accountType === "user" && (
        <>
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-955 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] cursor-pointer text-xs md:text-sm"
          >
            {googleLoading ? (
              <svg className="animate-spin h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign up with Google</span>
              </>
            )}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
            <span className="flex-shrink mx-4 text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
              Or
            </span>
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
          </div>
        </>
      )}

      {/* Form */}
      <form onSubmit={handleSignup} className="space-y-4 text-left">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            {accountType === "shop_owner" ? "Owner Full Name" : "Full Name"}
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <i className="ri-user-line"></i>
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 text-xs md:text-sm"
            />
          </div>
        </div>

        {accountType === "shop_owner" && (
          <>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Print Shop Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <i className="ri-store-2-line"></i>
                </span>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Express Print & Copy"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 text-xs md:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  City
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Mohali"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Zip / Pincode
                </label>
                <input
                  type="text"
                  required
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="160059"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Street Address
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street, Suite 4"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Google Maps / Business Directions Link
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 text-xs"
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Email Address
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <i className="ri-mail-line"></i>
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 text-xs md:text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Password
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <i className="ri-lock-line"></i>
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 text-xs md:text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <i className="ri-checkbox-circle-line"></i>
            </span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 text-xs md:text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-blue-500/20 dark:shadow-none hover:shadow-blue-500/30 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer text-xs md:text-sm"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : accountType === "shop_owner" ? (
            "Register Print Shop & Go to Dashboard"
          ) : (
            "Sign Up"
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="border-t border-zinc-200/50 dark:border-zinc-800/50 pt-6 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{" "}
          <Link 
            href={redirectTo !== "/dashboard" ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login"} 
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-semibold hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50/50 via-zinc-50 to-blue-100/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950/20 px-4 py-12 transition-colors duration-300">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading...</div>}>
        <SignupContent />
      </Suspense>
    </div>
  );
}

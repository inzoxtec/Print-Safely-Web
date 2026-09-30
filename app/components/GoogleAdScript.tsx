// app/components/GoogleAdScript.tsx
"use client";

import Script from "next/script";
import { ADS_CONFIG } from "@/lib/config/ads";

export default function GoogleAdScript() {
  if (!ADS_CONFIG.client || ADS_CONFIG.isTestMode) return null;

  return (
    <Script
      id="google-adsense-script"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CONFIG.client}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}

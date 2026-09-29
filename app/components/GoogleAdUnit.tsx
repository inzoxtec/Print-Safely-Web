// app/components/GoogleAdUnit.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { ADS_CONFIG } from "@/lib/config/ads";

interface GoogleAdUnitProps {
  slotId?: string;
  format?: "auto" | "fluid" | "rectangle" | "vertical";
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function GoogleAdUnit({
  slotId = ADS_CONFIG.slots.sidebar,
  format = "auto",
  responsive = true,
  className = "",
  style = { display: "block" }
}: GoogleAdUnitProps) {
  const { isPremium } = useAuth();
  const adRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (isPremium) return;
    if (pushedRef.current) return;

    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushedRef.current = true;
      }
    } catch (err) {
      console.warn("AdSense push notification error:", err);
    }
  }, [isPremium]);

  // If user is paid subscriber, suppress all ads platform-wide
  if (isPremium) return null;

  return (
    <div className={`ad-container relative w-full overflow-hidden text-center space-y-2 ${className}`}>
      {ADS_CONFIG.isTestMode && (
        <div className="w-full bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-zinc-900 border border-amber-500/30 rounded-2xl p-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider">
            <i className="ri-google-fill text-sm"></i>
            <span>Google AdSense (Test Banner)</span>
          </div>
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            AdSense Display Ad Slot
          </p>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-white/60 dark:bg-zinc-950/60 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 font-mono">
            Client: {ADS_CONFIG.client}<br />
            Slot: {slotId}
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
            Live Google Ads will fill this space automatically on your domain once approved by AdSense.
          </p>
        </div>
      )}

      {/* Official Google AdSense Ins Element */}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={style}
        data-ad-client={ADS_CONFIG.client}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-ad-test={ADS_CONFIG.isTestMode ? "on" : undefined}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}

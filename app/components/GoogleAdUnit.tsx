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
    // Don't attempt doubleclick network calls in test mode or with placeholder slot IDs
    if (ADS_CONFIG.isTestMode || slotId === "1234567890") return;

    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushedRef.current = true;
      }
    } catch (err) {
      console.warn("AdSense push notification error:", err);
    }
  }, [isPremium, slotId]);

  // If user is paid subscriber, suppress all ads platform-wide
  if (isPremium) return null;

  return (
    <div className={`ad-container relative w-full overflow-hidden text-center space-y-2 ${className}`}>
      {ADS_CONFIG.isTestMode && (
        <div className="w-full bg-gradient-to-br from-blue-950/40 via-zinc-900 to-zinc-950 border border-blue-500/30 rounded-2xl p-3.5 text-center space-y-3 shadow-md">
          {/* Ad Label & Google Info */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[9px] font-extrabold uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              Ad
            </span>
            <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400">
              <i className="ri-google-fill text-blue-400"></i>
              <span>Google AdSense</span>
            </div>
          </div>

          {/* Ad Graphic & Body */}
          <div className="space-y-2">
            <div className="h-20 w-full bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
              <i className="ri-advertisement-fill text-3xl animate-pulse"></i>
            </div>
            <h4 className="text-xs font-bold text-white">
              Google AdSense Display Ad
            </h4>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Official AdSense ad container. Live advertiser banners will fill this unit automatically on your domain upon Google review completion.
            </p>
          </div>

          {/* Publisher & Slot Info */}
          <div className="bg-zinc-950/80 p-2 rounded-xl border border-zinc-800 text-[9px] font-mono text-zinc-400 space-y-0.5 text-left">
            <div><span className="text-zinc-500">ID:</span> {ADS_CONFIG.client}</div>
            <div><span className="text-zinc-500">Slot:</span> {slotId}</div>
          </div>

          {/* CTA Mock Button */}
          <button
            type="button"
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px] rounded-xl transition shadow-xs cursor-default"
          >
            Google Ad Unit Active &rarr;
          </button>
        </div>
      )}

      {/* Official Google AdSense Ins Element */}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%", minHeight: "200px", ...style }}
        data-ad-client={ADS_CONFIG.client}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-ad-test={ADS_CONFIG.isTestMode ? "on" : undefined}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}

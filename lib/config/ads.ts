// lib/config/ads.ts

/**
 * Google AdSense Configuration
 * Uses official Google AdSense test credentials by default:
 * - Publisher ID: ca-pub-3940256099942544
 * - Slot ID: 1234567890
 *
 * To go live: Simply add NEXT_PUBLIC_ADSENSE_PUB_ID and NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR to your .env.local
 */

export const ADS_CONFIG = {
  client: process.env.NEXT_PUBLIC_ADSENSE_PUB_ID || "ca-pub-3940256099942544",
  slots: {
    sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR || "1234567890",
    inArticle: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE || "1234567890",
  },
  // Set to true if using official test publisher ID
  isTestMode: !process.env.NEXT_PUBLIC_ADSENSE_PUB_ID || process.env.NEXT_PUBLIC_ADSENSE_PUB_ID.includes("3940256099942544"),
};

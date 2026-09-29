// lib/config/ads.ts

/**
 * Google AdSense Configuration
 * Real Publisher ID: ca-pub-7430250170273873
 */

export const ADS_CONFIG = {
  client: process.env.NEXT_PUBLIC_ADSENSE_PUB_ID || "ca-pub-7430250170273873",
  slots: {
    sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR || "1234567890",
    inArticle: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE || "1234567890",
  },
  // Set to true if using official test publisher ID
  isTestMode: true,
};

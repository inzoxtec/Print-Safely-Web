// lib/config/ads.ts

export const ADS_CONFIG = {
  // Your real Google AdSense Publisher ID
  client: process.env.NEXT_PUBLIC_ADSENSE_PUB_ID || "ca-pub-7430250170273873",
  
  slots: {
    sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR || "4625621153", // <--- Your new real slot ID
    banner: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BANNER || "1234567890",
    inArticle: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE || "1234567890",
  },
  
  isTestMode: true, // Keep true for local dev, change to false when live
};
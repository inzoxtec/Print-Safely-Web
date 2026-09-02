import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/p/*",          // Secure print link pages
        "/dashboard/*",  // Client dashboard
        "/api/*",        // Backend api routes
      ],
    },
    sitemap: "https://printsafely.app/sitemap.xml",
  };
}

import { MetadataRoute } from "next";

const BASE_URL = "https://printsafely.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/upload",
    "/privacy",
    "/terms",
    "/security",
    "/pricing",
    "/login",
    "/signup",
  ];

  const tools = [
    "merge-pdf",
    "split-pdf",
    "reorder-pdf",
    "delete-pdf",
    "image-to-pdf",
    "pdf-to-image",
    "doc-to-pdf",
    "excel-to-pdf",
    "csv-to-pdf",
    "txt-to-pdf",
    "extract-text",
    "protect",
    "unlock",
    "watermark",
    "page-numbers",
    "sign-pdf",
    "annotate-pdf",
  ];

  const staticEntries = staticRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/upload" ? ("weekly" as const) : ("monthly" as const),
    priority: route === "" ? 1.0 : route === "/upload" ? 0.9 : 0.8,
  }));

  const toolEntries = tools.map((tool) => ({
    url: `${BASE_URL}/tools/${tool}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...toolEntries];
}

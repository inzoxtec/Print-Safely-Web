// lib/slug.ts

/**
 * Helper to generate SEO-friendly URL slug from Shop Name & City
 */
export function generateShopSlug(name: string, city?: string): string {
  const base = city ? `${name} ${city}` : name;
  return base
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

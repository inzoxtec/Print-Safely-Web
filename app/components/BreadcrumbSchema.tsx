// app/components/BreadcrumbSchema.tsx
"use client";

import React from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
  showVisual?: boolean;
  className?: string;
}

export default function BreadcrumbSchema({
  items,
  showVisual = true,
  className = "w-full mb-3",
}: BreadcrumbSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url,
    })),
  };

  const getRelativeHref = (fullUrl: string) => {
    try {
      if (fullUrl.startsWith("https://printsafely.app")) {
        const path = fullUrl.replace("https://printsafely.app", "");
        return path === "" ? "/" : path;
      }
      return fullUrl;
    } catch (e) {
      return fullUrl;
    }
  };

  return (
    <>
      {/* JSON-LD Microdata for Search Engine Crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Visual UI Breadcrumb Navigation for Website Visitors */}
      {showVisual && items.length > 1 && (
        <nav aria-label="Breadcrumb" className={className}>
          <ol className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 overflow-x-auto whitespace-nowrap no-scrollbar py-0.5">
            {items.map((item, idx) => {
              const isLast = idx === items.length - 1;
              const href = getRelativeHref(item.url);

              return (
                <li key={idx} className="flex items-center gap-1.5">
                  {idx > 0 && <span className="text-zinc-400 dark:text-zinc-600 font-bold">›</span>}
                  {isLast ? (
                    <span className="font-bold text-zinc-900 dark:text-zinc-100" aria-current="page">
                      {item.name}
                    </span>
                  ) : (
                    <Link
                      href={href}
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-semibold flex items-center gap-1"
                    >
                      {idx === 0 && <i className="ri-home-4-line text-xs"></i>}
                      {item.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </>
  );
}

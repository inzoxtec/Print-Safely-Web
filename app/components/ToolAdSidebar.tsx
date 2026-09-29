// app/components/ToolAdSidebar.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import GoogleAdUnit from "./GoogleAdUnit";

interface ToolLinkItem {
  name: string;
  href: string;
  icon: string;
  desc: string;
}

const ALL_PDF_TOOLS: ToolLinkItem[] = [
  { name: "Merge PDF", href: "/tools/merge-pdf", icon: "ri-file-copy-2-line", desc: "Combine multiple PDFs" },
  { name: "Split PDF", href: "/tools/split-pdf", icon: "ri-scissors-2-line", desc: "Extract or split pages" },
  { name: "Compress PDF", href: "/tools/compress-pdf", icon: "ri-file-reduce-line", desc: "Shrink file size" },
  { name: "Rotate PDF", href: "/tools/rotate-pdf", icon: "ri-refresh-line", desc: "Turn pages 90° or 180°" },
  { name: "Crop PDF", href: "/tools/crop-pdf", icon: "ri-crop-line", desc: "Trim page margins" },
  { name: "Reorder Pages", href: "/tools/reorder-pdf", icon: "ri-drag-drop-line", desc: "Sort page sequence" },
  { name: "Delete Pages", href: "/tools/delete-pdf", icon: "ri-delete-bin-line", desc: "Remove unwanted pages" },
  { name: "Image to PDF", href: "/tools/image-to-pdf", icon: "ri-image-line", desc: "Convert JPG/PNG to PDF" },
  { name: "PDF to Image", href: "/tools/pdf-to-image", icon: "ri-file-image-line", desc: "Export pages as JPG/PNG" },
  { name: "Grayscale PDF", href: "/tools/grayscale-pdf", icon: "ri-contrast-line", desc: "Convert to B&W to save ink" },
  { name: "Sign PDF", href: "/tools/sign-pdf", icon: "ri-quill-pen-line", desc: "Draw or add signature" },
  { name: "Annotate PDF", href: "/tools/annotate-pdf", icon: "ri-markup-line", desc: "Draw & highlight text" },
  { name: "Protect PDF", href: "/tools/protect", icon: "ri-lock-password-line", desc: "Encrypt with password" },
  { name: "Unlock PDF", href: "/tools/unlock", icon: "ri-lock-unlock-line", desc: "Remove password encryption" },
  { name: "Watermark PDF", href: "/tools/watermark", icon: "ri-stamp-line", desc: "Add custom text watermark" },
  { name: "Page Numbers", href: "/tools/page-numbers", icon: "ri-hashtag", desc: "Add page numbering" },
  { name: "Redact PDF", href: "/tools/redact-pdf", icon: "ri-eye-off-line", desc: "Blackout sensitive data" },
];

export default function ToolAdSidebar() {
  const { isPremium } = useAuth();
  const pathname = usePathname();

  // Filter out the currently active tool from the related tools list
  const relatedTools = ALL_PDF_TOOLS.filter((tool) => tool.href !== pathname).slice(0, 5);

  return (
    <aside className="hidden md:flex w-52 flex-shrink-0 p-4 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
      <div className="sticky top-20 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 space-y-4 shadow-xs">
        
        {/* IF FREE USER: SHOW GOOGLE ADSENSE UNIT + UPGRADE LINK */}
        {!isPremium ? (
          <div className="space-y-4 text-center">
            <span className="text-[9px] uppercase font-extrabold text-zinc-400 dark:text-zinc-500 tracking-wider">
              Advertisement
            </span>

            {/* Google AdSense Unit */}
            <GoogleAdUnit format="vertical" className="min-h-[250px]" />

            <div className="border-t border-zinc-150 dark:border-zinc-800 pt-3 space-y-2">
              <div className="h-8 w-8 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mx-auto text-base">
                <i className="ri-vip-crown-line"></i>
              </div>
              <p className="font-extrabold text-xs text-zinc-900 dark:text-white">Upgrade to Premium</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Enjoy 100% ad-free processing & unlimited document conversions.
              </p>
              <Link
                href="/pricing"
                className="inline-block w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-xl shadow-xs transition"
              >
                View Plans &rarr;
              </Link>
            </div>
          </div>
        ) : (
          /* IF PAID/PREMIUM USER: SHOW RELATED PDF TOOLS QUICK NAV WIDGET */
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-600 dark:text-blue-400 border-b border-zinc-150 dark:border-zinc-800 pb-2.5">
              <i className="ri-sparkling-fill text-amber-500 text-sm"></i>
              <span>Related PDF Tools</span>
            </div>

            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
              Quick Navigation
            </p>

            <div className="space-y-1">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex items-center gap-2.5 p-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition group"
                >
                  <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 flex-shrink-0 flex items-center justify-center text-xs group-hover:scale-105 transition-transform">
                    <i className={tool.icon}></i>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold leading-tight truncate">{tool.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate mt-0.5">{tool.desc}</p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="border-t border-zinc-150 dark:border-zinc-800 pt-2.5 text-center">
              <Link
                href="/#tools-catalog"
                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
              >
                All Tools Directory &rarr;
              </Link>
            </div>
          </div>
        )}

      </div>
    </aside>
  );
}

// components/Footer.tsx
import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-950 py-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center">
            <img
                src="/logo-dark.svg"
                alt="SafelyPrint Logo"
                className="h-9 w-auto block dark:hidden"
            />
            <img
                src="/logo-light.svg" 
                alt="SafelyPrint Logo"
                className="h-9 w-auto hidden dark:block"
            />
        </Link>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Secure document transmission and browser-side PDF utility toolkit. Built to keep your files confidential.
            </p>
          </div>

          {/* Column 1 - Tools */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white mb-3">Tools</h4>
            <ul className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li><Link href="/upload" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Secure Printer Link</Link></li>
              <li><Link href="/tools/merge-pdf" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Merge PDF</Link></li>
              <li><Link href="/tools/split-pdf" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Split PDF</Link></li>
              <li><Link href="/tools/image-to-pdf" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Image to PDF</Link></li>
            </ul>
          </div>

          {/* Column 2 - Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white mb-3">Privacy & Trust</h4>
            <ul className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li><Link href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Terms of Service</Link></li>
              <li><Link href="/security" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Security Rules</Link></li>
            </ul>
          </div>

          {/* Column 3 - Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white mb-3">Contact</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Questions? Reach out to support@safelyprint.com
            </p>
          </div>

        </div>

        <div className="border-t border-zinc-200/50 dark:border-zinc-800/50 mt-8 pt-6 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            &copy; {new Date().getFullYear()} safelyprint. All rights reserved. Processing is done client-side for maximum safety.
          </p>
        </div>
      </div>
    </footer>
  );
}
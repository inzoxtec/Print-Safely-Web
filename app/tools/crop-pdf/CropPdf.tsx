// app/tools/crop-pdf/CropPdf.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import ToolSeoSection from "@/app/components/ToolSeoSection";
import ToolSeoSchema from "@/app/components/ToolSeoSchema";
import BreadcrumbSchema from "@/app/components/BreadcrumbSchema";
import ToolAdSidebar from "@/app/components/ToolAdSidebar";

export default function CropPdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [cropMarginMm, setCropMarginMm] = useState<number>(15); // mm to trim off each edge
  const [saving, setSaving] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchUserPlan = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const activePlans = ["premium", "starter", "pro", "advanced"];
          if (activePlans.includes(userData.plan)) {
            setIsPremium(true);
          }
        }
      } catch (err) {
        console.warn(err);
      }
    };
    fetchUserPlan();
  }, [user]);

  const loadPdfLib = async () => {
    if ((window as any).PDFLib) return (window as any).PDFLib;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "/vendor/pdf-lib/pdf-lib.min.js";
      script.onload = () => resolve((window as any).PDFLib);
      document.head.appendChild(script);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setFile(e.target.files[0]);
    setOutputUrl(null);
    setOutputBlob(null);
  };

  const handleCrop = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const PDFLibInstance: any = await loadPdfLib();
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFLibInstance.PDFDocument.load(arrayBuffer);
      const pdfPages = pdfDoc.getPages();

      // Convert mm to PDF points (1 mm = 2.83465 pt)
      const trimPts = cropMarginMm * 2.83465;

      pdfPages.forEach((page: any) => {
        const { width, height } = page.getSize();
        const newX = Math.min(trimPts, width / 4);
        const newY = Math.min(trimPts, height / 4);
        const newW = Math.max(width - 2 * trimPts, width / 2);
        const newH = Math.max(height - 2 * trimPts, height / 2);

        page.setCropBox(newX, newY, newW, newH);
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setOutputBlob(blob);
      setOutputUrl(url);
    } catch (err) {
      alert("Failed to crop PDF margins.");
    } finally {
      setSaving(false);
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    
    const name = `${file?.name?.split(".")[0]}_cropped.pdf`;
    const type = "application/pdf";

    const openDb = (): Promise<IDBDatabase> => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("SafelyPrintDB", 1);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("forwarded_files")) {
            db.createObjectStore("forwarded_files");
          }
        };
        request.onsuccess = (e: any) => resolve(e.target.result);
        request.onerror = (e: any) => reject(e.target.error);
      });
    };

    try {
      const dbInstance = await openDb();
      const transaction = dbInstance.transaction("forwarded_files", "readwrite");
      const store = transaction.objectStore("forwarded_files");

      await new Promise<void>((resolve, reject) => {
        const putRequest = store.put({ name, blob: outputBlob, type, timestamp: Date.now() }, "active_forward");
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      });

      if (user) {
        window.location.href = "/upload";
      } else {
        window.location.href = "/login?redirectTo=/upload&reason=forwarded_file";
      }
    } catch (err) {
      console.error(err);
      alert("Failed to queue file database write locally.");
    }
  };

  return (
    <div className={`min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300 ${
      !isPremium ? "pb-16 lg:pb-0" : ""
    }`}>
      <Header />

      <div className="flex-1 flex-col md:flex-row flex w-full max-w-[100vw] justify-center overflow-hidden">
        {/* LEFT AD / RELATED TOOLS COLUMN (Desktop only) */}
        <ToolAdSidebar />

        {/* CENTER MAIN WORKSPACE */}
        <main className="flex-1 max-w-4xl p-6 md:p-8 overflow-auto space-y-8">
          <BreadcrumbSchema
            items={[
              { name: "Home", url: "https://printsafely.app" },
              { name: "Tools", url: "https://printsafely.app#tools-catalog" },
              { name: "Crop PDF", url: "https://printsafely.app/tools/crop-pdf" },
            ]}
          />

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-crop-line text-blue-600 dark:text-blue-500"></i> Crop & Trim PDF Margins
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Trim extra whitespace margins off PDF pages before printing or sharing 100% locally in your browser.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-crop-line"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF file to crop</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-1">Choose a PDF document to trim extra whitespace margins.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
              >
                Choose PDF File
              </button>
            </div>
          )}

          {file && !outputUrl && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl space-y-6 shadow-sm">
              {/* File Info Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800">
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="h-10 w-10 bg-red-100 dark:bg-red-900/10 text-red-650 dark:text-red-400 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    <i className="ri-file-pdf-line"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-500 font-semibold">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • Loaded PDF File
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {/* MARGIN CROP SLIDER */}
              <div className="w-full text-left space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-zinc-600 dark:text-zinc-400">
                  <span className="uppercase tracking-wider">Margin Trim Amount:</span>
                  <span className="text-blue-600 font-bold">{cropMarginMm} mm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  value={cropMarginMm}
                  onChange={(e) => setCropMarginMm(parseInt(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {saving && (
                <div className="py-4 text-center space-y-2">
                  <div className="animate-spin h-6 w-6 text-blue-600 border-3 border-t-transparent rounded-full mx-auto" />
                  <p className="text-xs text-zinc-500 font-mono">Trimming page crop boxes...</p>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={handleCrop}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
                      Trimming Margins...
                    </>
                  ) : (
                    <>
                      <i className="ri-crop-line"></i> Crop Margins & Export PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {outputUrl && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm animate-in fade-in duration-300">
              <div className="flex justify-center text-emerald-500 text-5xl">
                <i className="ri-checkbox-circle-fill"></i>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">PDF Margins Cropped Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Your trimmed PDF is ready. You can secure share or download it.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`${file?.name?.split(".")[0]}_cropped.pdf`}
                  className="w-full sm:w-auto px-5 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold rounded-xl text-xs border border-zinc-300 dark:border-zinc-700 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ri-download-2-line"></i> Download PDF
                </a>
                <button
                  onClick={handleForwardToSecureShare}
                  className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ri-shield-keyhole-line"></i> 🔒 Secure Share & Print
                </button>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setOutputUrl(null);
                  setOutputBlob(null);
                }}
                className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto"
              >
                Crop Another Document
              </button>
            </div>
          )}

        </main>

        {/* RIGHT AD COLUMN (Desktop only) */}
        {!isPremium && (
          <aside className="flex md:hidden lg:flex w-full md:w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
            <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Advertisement</span>
              <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
                <i className="ri-file-zip-line text-blue-500 text-xl"></i>
                <p className="font-bold">Advanced PDF Tools</p>
                <p className="text-[12px] leading-relaxed">Split, watermark, sign, and convert PDF documents in seconds.</p>
                <Link href="/pricing" className="text-[12px] text-blue-500 hover:underline block pt-2 font-bold">
                  Learn More &rarr;
                </Link>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* MOBILE BOTTOM BANNER */}
      {!isPremium && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center z-45 transition-colors shadow-lg">
          <div className="w-full max-w-lg mx-auto flex items-center justify-between px-4 h-full text-xs text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <span className="bg-zinc-100 dark:bg-zinc-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded text-zinc-500">AD</span>
              <p className="font-semibold text-[12px] text-zinc-500 dark:text-zinc-400">Upgrade to remove ads and unlock pro features.</p>
            </div>
            <Link href="/pricing" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[12px] transition whitespace-nowrap shadow">
              Upgrade
            </Link>
          </div>
        </div>
      )}

      <ToolSeoSection
        title="Crop PDF Online Free - Trim PDF Margins"
        subtitle="Remove unnecessary white borders and crop page margins off PDF documents locally in your browser."
        steps={[
          { title: "Select PDF File", desc: "Choose a PDF file to crop whitespace margins." },
          { title: "Set Margin Trim", desc: "Adjust the trim slider to choose how many millimeters to crop." },
          { title: "Download PDF", desc: "Export your cropped PDF file directly to your device." }
        ]}
        features={[
          { icon: "⚡", title: "Instant In-Browser", desc: "Modifies PDF crop box metadata in milliseconds." },
          { icon: "🔒", title: "100% Private", desc: "Your PDF pages are trimmed on your device without server uploads." },
          { icon: "✂️", title: "Clean Margins", desc: "Eliminates empty white space for easier printing and document reading." }
        ]}
        faqs={[
          { question: "Is cropping PDF margins reversible?", answer: "Yes, SafelyPrint updates page crop bounds without deleting original content structure." },
          { question: "Does cropping upload my document to a server?", answer: "No, all cropping takes place 100% in your browser." }
        ]}
      />
      <ToolSeoSchema
        name="Crop PDF Online Free"
        description="Trim extra whitespace margins off PDF pages before printing or sharing 100% locally in your web browser."
        url="https://printsafely.app/tools/crop-pdf"
        steps={[
          "Select a PDF document to crop.",
          "Adjust the margin trim slider.",
          "Click Crop Margins & Export PDF to save your file."
        ]}
        faqs={[
          { question: "Is cropping PDF margins reversible?", answer: "Yes, SafelyPrint updates page crop bounds without deleting original content structure." },
          { question: "Does cropping upload my document to a server?", answer: "No, all cropping takes place 100% in your browser." }
        ]}
      />
      <Footer />
    </div>
  );
}


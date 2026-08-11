// app/tools/reorder/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

interface PageThumbnail {
  index: number;
  dataUrl: string;
}

export default function ReorderPdfPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageThumbnail[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Premium / Ads state
  const [isPremium, setIsPremium] = useState(false);

  // Sync plan status from Firestore
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

  const loadPdfJS = async () => {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        resolve(pdfjs);
      };
      document.head.appendChild(script);
    });
  };

  const loadPdfLib = async () => {
    if ((window as any).PDFLib) return (window as any).PDFLib;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
      script.onload = () => resolve((window as any).PDFLib);
      document.head.appendChild(script);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setLoadingPages(true);
    setPages([]);
    setOutputUrl(null);
    setOutputBlob(null);

    try {
      const pdfjs: any = await loadPdfJS();
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const count = pdf.numPages;

      const thumbs: PageThumbnail[] = [];
      for (let i = 1; i <= count; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 }); // Small thumbnail rendering scale
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        thumbs.push({
          index: i - 1,
          dataUrl: canvas.toDataURL()
        });
      }
      setPages(thumbs);
    } catch (err) {
      alert("Failed to render PDF page previews.");
    } finally {
      setLoadingPages(false);
    }
  };

  const movePage = (index: number, direction: "left" | "right") => {
    const updated = [...pages];
    const target = direction === "left" ? index - 1 : index + 1;
    if (target < 0 || target >= pages.length) return;

    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    setPages(updated);
  };

  const handleSave = async () => {
    if (!file || pages.length === 0) return;
    setSaving(true);

    try {
      const PDFLibInstance: any = await loadPdfLib();
      const arrayBuffer = await file.arrayBuffer();
      const originalPdf = await PDFLibInstance.PDFDocument.load(arrayBuffer);
      const reorderedPdf = await PDFLibInstance.PDFDocument.create();

      const pageIndices = pages.map((p) => p.index);
      const copiedPages = await reorderedPdf.copyPages(originalPdf, pageIndices);
      copiedPages.forEach((page: any) => reorderedPdf.addPage(page));

      const pdfBytes = await reorderedPdf.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setOutputBlob(blob);
      setOutputUrl(url);
    } catch (err) {
      alert("Failed to reorder PDF pages.");
    } finally {
      setSaving(false);
    }
  };

  const handleForwardToSecureShare = () => {
    if (!outputBlob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        sessionStorage.setItem("safelyprint_forward_file_name", `Reordered_${file?.name}`);
        sessionStorage.setItem("safelyprint_forward_file_data", reader.result as string);
        sessionStorage.setItem("safelyprint_forward_file_type", "application/pdf");
        window.location.href = "/upload";
      } catch (err) {
        alert("The PDF is too large to forward automatically.");
      }
    };
    reader.readAsDataURL(outputBlob);
  };

  return (
    <div className={`min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300 ${
      !isPremium ? "pb-16 lg:pb-0" : ""
    }`}>
      <Header />

      <div className="flex-1 flex-col md:flex-row flex w-full max-w-[100vw] justify-center overflow-hidden">
        
        {/* LEFT AD COLUMN */}
        {!isPremium && (
          <aside className="hidden md:flex w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-955/20">
            <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Advertisement</span>
              <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
                <i className="ri-vip-crown-line text-amber-500 text-xl"></i>
                <p className="font-bold">Upgrade to Premium</p>
                <p className="text-[12px] leading-relaxed">Remove ads and upload up to 20 documents simultaneously.</p>
                <Link href="/pricing" className="text-[12px] text-blue-500 hover:underline block pt-2 font-bold">
                  View Plans &rarr;
                </Link>
              </div>
            </div>
          </aside>
        )}

        {/* CENTER MAIN WORKSPACE */}
        <main className="flex-1 max-w-4xl p-6 md:p-8 overflow-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-drag-drop-line text-blue-600 dark:text-blue-500"></i> Organize PDF Pages
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Drag, rearrange, and sort the pages of your PDF file locally. Your file contents never upload to any external servers.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-menu-fold-line"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF to reorder pages</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-550 mt-1">Upload a PDF to render visual page sorting panels.</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
              >
                Choose PDF File
              </button>
            </div>
          )}

          {loadingPages && (
            <div className="text-center py-12 space-y-3">
              <div className="animate-spin h-8 w-8 text-blue-500 border-4 border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-zinc-450">Generating page thumbnails locally...</p>
            </div>
          )}

          {pages.length > 0 && !outputUrl && (
            <div className="space-y-6">
              {/* Pages Grid Layout */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {pages.map((item, index) => (
                  <div key={item.index} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-2xl flex flex-col items-center gap-3 relative shadow-xs">
                    <span className="absolute top-2 left-2 bg-zinc-250 dark:bg-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                      Page {index + 1}
                    </span>
                    <div className="w-full h-32 rounded-lg overflow-hidden border border-zinc-100 dark:border-zinc-800 mt-4 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                      <img src={item.dataUrl} alt={`Page ${index + 1}`} className="max-h-full max-w-full object-contain" />
                    </div>
                    
                    {/* Move controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => movePage(index, "left")}
                        disabled={index === 0}
                        className="p-1 text-zinc-500 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30 cursor-pointer"
                      >
                        <i className="ri-arrow-left-line"></i>
                      </button>
                      <span className="text-[10px] text-zinc-400">Sort</span>
                      <button
                        onClick={() => movePage(index, "right")}
                        disabled={index === pages.length - 1}
                        className="p-1 text-zinc-500 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30 cursor-pointer"
                      >
                        <i className="ri-arrow-right-line"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3.5">
                <button
                  onClick={() => {
                    setFile(null);
                    setPages([]);
                  }}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold rounded-xl text-xs border border-zinc-300 dark:border-zinc-700 transition cursor-pointer"
                >
                  Change File
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? "Processing..." : "Compile & Save Reorder"}
                </button>
              </div>
            </div>
          )}

          {/* Success screen */}
          {outputUrl && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm animate-in fade-in duration-300">
              <div className="flex justify-center text-emerald-500 text-5xl">
                <i className="ri-checkbox-circle-fill"></i>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">PDF Reordered Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Your page layout is updated. Secure share or download below.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`Reordered_${file?.name}`}
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
                  setOutputUrl(null);
                  setOutputBlob(null);
                  setFile(null);
                  setPages([]);
                }}
                className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto"
              >
                Sort Another Document
              </button>
            </div>
          )}
        </main>

        {/* RIGHT AD COLUMN */}
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

      <Footer />
    </div>
  );
}
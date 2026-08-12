// app/tools/split/splitpdf.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

interface PageThumbnail {
  num: number;
  selected: boolean;
  dataUrl: string;
}

export default function SplitPdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [splitMode, setSplitMode] = useState<"custom" | "all">("custom");
  
  // Custom selection states
  const [pages, setPages] = useState<PageThumbnail[]>([]);
  const [rangeInput, setRangeInput] = useState("");
  const [loadingPages, setLoadingPages] = useState(false);
  
  // Action states
  const [splitting, setSplitting] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputType, setOutputType] = useState<"pdf" | "zip">("pdf");
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
        console.warn("Failed to read user plan:", err);
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

  const loadJsZip = async () => {
    if ((window as any).JSZip) return (window as any).JSZip;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = () => resolve((window as any).JSZip);
      document.head.appendChild(script);
    });
  };

  // Handle uploaded file & render thumbnails
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      alert("Only PDF files are supported.");
      return;
    }

    setFile(selectedFile);
    setLoadingPages(true);
    setPages([]);
    setOutputUrl(null);
    setOutputBlob(null);

    try {
      const pdfjs: any = await loadPdfJS();
      const PDFLibInstance: any = await loadPdfLib();
      
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const pagesCount = pdf.numPages;
      setTotalPages(pagesCount);
      
      const thumbs: PageThumbnail[] = [];
      for (let i = 1; i <= pagesCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        thumbs.push({
          num: i,
          selected: true,
          dataUrl: canvas.toDataURL()
        });
      }
      
      setPages(thumbs);
      setRangeInput(`1-${pagesCount}`);
    } catch (err) {
      alert("Failed to load PDF file or generate page previews.");
    } finally {
      setLoadingPages(false);
    }
  };

  // Toggle single page selection in grid
  const togglePageSelect = (num: number) => {
    const updated = pages.map((p) => (p.num === num ? { ...p, selected: !p.selected } : p));
    setPages(updated);
    updateRangeInputFromGrid(updated);
  };

  // Select all or clear selections
  const bulkSelect = (select: boolean) => {
    const updated = pages.map((p) => ({ ...p, selected: select }));
    setPages(updated);
    updateRangeInputFromGrid(updated);
  };

  // Convert visual grid selections into range string (e.g. "1-3, 5")
  const updateRangeInputFromGrid = (grid: PageThumbnail[]) => {
    const selectedNums = grid.filter((p) => p.selected).map((p) => p.num);
    if (selectedNums.length === 0) {
      setRangeInput("");
      return;
    }

    const ranges = [];
    let start = selectedNums[0];
    let end = selectedNums[0];

    for (let i = 1; i < selectedNums.length; i++) {
      if (selectedNums[i] === end + 1) {
        end = selectedNums[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = selectedNums[i];
        end = selectedNums[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    setRangeInput(ranges.join(", "));
  };

  // Parse typed range strings back into page index arrays
  const parseRanges = (input: string, max: number): number[] => {
    const pageIndices: number[] = [];
    const parts = input.split(",");
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes("-")) {
        const [startStr, endStr] = trimmed.split("-");
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        if (!isNaN(start) && !isNaN(end)) {
          const limitStart = Math.max(1, Math.min(start, max));
          const limitEnd = Math.max(1, Math.min(end, max));
          for (let i = Math.min(limitStart, limitEnd); i <= Math.max(limitStart, limitEnd); i++) {
            pageIndices.push(i - 1);
          }
        }
      } else {
        const page = parseInt(trimmed);
        if (!isNaN(page)) {
          pageIndices.push(Math.max(1, Math.min(page, max)) - 1);
        }
      }
    }
    return Array.from(new Set(pageIndices)).sort((a, b) => a - b);
  };

  // Split Trigger
  const handleSplitSubmit = async () => {
    if (!file) return;
    setSplitting(true);
    setOutputUrl(null);
    setOutputBlob(null);

    try {
      const PDFLibInstance: any = await loadPdfLib();
      const arrayBuffer = await file.arrayBuffer();
      const originalPdf = await PDFLibInstance.PDFDocument.load(arrayBuffer);

      if (splitMode === "custom") {
        const pageIndices = parseRanges(rangeInput, totalPages);
        if (pageIndices.length === 0) {
          alert("Please select at least 1 page to extract.");
          setSplitting(false);
          return;
        }

        const splitPdf = await PDFLibInstance.PDFDocument.create();
        const copiedPages = await splitPdf.copyPages(originalPdf, pageIndices);
        copiedPages.forEach((page: any) => splitPdf.addPage(page));

        const pdfBytes = await splitPdf.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        setOutputType("pdf");
        setOutputBlob(blob);
        setOutputUrl(url);
      } else {
        const jszip: any = await loadJsZip();
        const zip = new jszip();

        for (let i = 0; i < totalPages; i++) {
          const singlePdf = await PDFLibInstance.PDFDocument.create();
          const [copiedPage] = await singlePdf.copyPages(originalPdf, [i]);
          singlePdf.addPage(copiedPage);

          const bytes = await singlePdf.save();
          zip.file(`Page_${i + 1}.pdf`, bytes);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);

        setOutputType("zip");
        setOutputBlob(zipBlob);
        setOutputUrl(url);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred during file extraction.");
    } finally {
      setSplitting(false);
    }
  };

  const handleForwardToSecureShare = () => {
    if (!outputBlob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const name = outputType === "pdf" ? `Split_${file?.name}` : `Split_Pages_${file?.name?.replace(".pdf", "")}.zip`;
        const type = outputType === "pdf" ? "application/pdf" : "application/zip";
        
        sessionStorage.setItem("safelyprint_forward_file_name", name);
        sessionStorage.setItem("safelyprint_forward_file_data", reader.result as string);
        sessionStorage.setItem("safelyprint_forward_file_type", type);
        window.location.href = "/upload";
      } catch (err) {
        alert("The output file is too large to forward automatically. Please download it first.");
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
          <aside className="hidden md:flex w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
            <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-550 tracking-wider">Advertisement</span>
              <div className="text-center text-xs text-zinc-555 dark:text-zinc-400 space-y-2">
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
              <i className="ri-scissors-cut-line text-blue-600 dark:text-blue-500"></i> Split PDF Pages
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Split page layouts or extract specific ranges. Done entirely inside browser local memory.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-105 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-scissors-fill"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF file to split</p>
                <p className="text-[14px] text-zinc-450 dark:text-zinc-550 mt-1">Upload a PDF to configure range extracts.</p>
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
              <p className="text-xs text-zinc-500">Generating visual page thumbnails locally...</p>
            </div>
          )}

          {file && !outputUrl && !loadingPages && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl space-y-6 shadow-sm">
              
              {/* File Info */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800">
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="h-10 w-10 bg-red-100 dark:bg-red-900/10 text-red-650 dark:text-red-400 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    <i className="ri-file-pdf-line"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-500 font-semibold">{totalPages} page(s) loaded</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setPages([]);
                  }}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setSplitMode("custom")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    splitMode === "custom"
                      ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-white shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  Custom Range (1 PDF)
                </button>
                <button
                  onClick={() => setSplitMode("all")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    splitMode === "all"
                      ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-white shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  Extract All Pages ({totalPages} PDFs in a ZIP)
                </button>
              </div>

              {/* Custom Selector layout */}
              {splitMode === "custom" ? (
                <div className="space-y-6 text-left animate-in fade-in duration-150">
                  {/* Range Text Input */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Pages Range Formula
                    </label>
                    <input
                      type="text"
                      value={rangeInput}
                      onChange={(e) => setRangeInput(e.target.value)}
                      placeholder="e.g. 1-3, 5"
                      className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold"
                    />
                  </div>

                  {/* Visual Checkbox Grid with Page Thumbnails */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
                      <span>VISUAL INTERACTIVE CHECKLIST</span>
                      <div className="flex gap-3">
                        <button onClick={() => bulkSelect(true)} className="text-blue-500 hover:underline cursor-pointer">Select All</button>
                        <button onClick={() => bulkSelect(false)} className="text-red-500 hover:underline cursor-pointer">Clear</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {pages.map((p) => (
                        <button
                          key={p.num}
                          onClick={() => togglePageSelect(p.num)}
                          className={`relative border rounded-2xl p-2.5 flex flex-col items-center gap-2.5 transition cursor-pointer select-none text-left ${
                            p.selected
                              ? "bg-blue-500/5 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-855 text-zinc-500 dark:text-zinc-400 hover:border-zinc-350 dark:hover:border-zinc-700"
                          }`}
                        >
                          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                            {p.selected ? (
                              <i className="ri-checkbox-circle-fill text-blue-600 dark:text-blue-400 text-sm"></i>
                            ) : (
                              <i className="ri-checkbox-blank-circle-line text-zinc-350 dark:text-zinc-650 text-sm"></i>
                            )}
                            <span className="text-[10px] font-extrabold tracking-wide uppercase">
                              Page {p.num}
                            </span>
                          </div>

                          <div className="w-full h-28 rounded-lg overflow-hidden border border-zinc-100 dark:border-zinc-800 mt-5 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                            <img 
                              src={p.dataUrl} 
                              alt={`Page ${p.num}`} 
                              className={`max-h-full max-w-full object-contain ${!p.selected ? "opacity-40" : ""}`} 
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-450 space-y-2 animate-in fade-in duration-150">
                  <i className="ri-folder-zip-line text-blue-500 text-3xl"></i>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">ZIP File Splitting Queue</p>
                  <p className="max-w-md mx-auto leading-relaxed">
                    This extracts each page of <span className="font-bold text-zinc-800 dark:text-white">{file.name}</span> into its own independent 1-page PDF file, then packs them together inside a single compressed ZIP folder.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={handleSplitSubmit}
                  disabled={splitting || (splitMode === "custom" && !rangeInput)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  {splitting ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
                      Splitting...
                    </>
                  ) : (
                    <>
                      <i className="ri-scissors-cut-line"></i> Split Document
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* Success Screen */}
          {outputUrl && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm animate-in fade-in duration-300">
              <div className="flex justify-center text-emerald-500 text-5xl">
                <i className="ri-checkbox-circle-fill"></i>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">PDF Split Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {outputType === "pdf"
                    ? "Your custom extracted pages are ready in a single PDF."
                    : `Your document was split into ${totalPages} individual PDF files packed inside a ZIP.`}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={outputType === "pdf" ? `Split_${file?.name}` : `Split_Pages_${file?.name?.replace(".pdf", "")}.zip`}
                  className="w-full sm:w-auto px-5 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold rounded-xl text-xs border border-zinc-300 dark:border-zinc-700 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ri-download-2-line"></i> Download {outputType === "pdf" ? "PDF" : "ZIP File"}
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
                Split Another Document
              </button>
            </div>
          )}
        </main>

        {/* RIGHT AD COLUMN */}
        {!isPremium && (
          <aside className="flex md:hidden lg:flex w-full md:w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
            <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-550 tracking-wider">Advertisement</span>
              <div className="text-center text-xs text-zinc-550 dark:text-zinc-400 space-y-2">
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
// app/tools/pdf-to-image/PdfToImageClientPage.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

interface PagePreview {
  num: number;
  selected: boolean;
  dataUrl: string;
}

export default function PdfToImage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  
  // Custom states
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [converting, setConverting] = useState(false);
  
  // Configuration options
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [resolution, setResolution] = useState<"standard" | "high">("standard");

  // Output States
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputType, setOutputType] = useState<"image" | "zip">("image");

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

  const loadJsZip = async () => {
    if ((window as any).JSZip) return (window as any).JSZip;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = () => resolve((window as any).JSZip);
      document.head.appendChild(script);
    });
  };

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
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const count = pdf.numPages;
      setTotalPages(count);

      const thumbs: PagePreview[] = [];
      for (let i = 1; i <= count; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
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
    } catch (err) {
      alert("Failed to render page previews.");
    } finally {
      setLoadingPages(false);
    }
  };

  const togglePageSelect = (num: number) => {
    setPages(prev => prev.map(p => p.num === num ? { ...p, selected: !p.selected } : p));
  };

  const bulkSelect = (select: boolean) => {
    setPages(prev => prev.map(p => ({ ...p, selected: select })));
  };

  const handleConvert = async () => {
    if (!file || pages.length === 0) return;
    
    const selectedPages = pages.filter(p => p.selected);
    if (selectedPages.length === 0) {
      alert("Please select at least 1 page to convert.");
      return;
    }

    setConverting(true);
    setOutputUrl(null);
    setOutputBlob(null);

    try {
      const pdfjs: any = await loadPdfJS();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      
      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const scale = resolution === "high" ? 2.0 : 1.0;

      if (selectedPages.length === 1) {
        // Single page output image
        const targetPageNum = selectedPages[0].num;
        const page = await pdf.getPage(targetPageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");

        await page.render({ canvasContext: context, viewport }).promise;

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setOutputType("image");
            setOutputBlob(blob);
            setOutputUrl(url);
          }
          setConverting(false);
        }, mimeType, 0.85);
      } else {
        // Multiple pages output into a ZIP file
        const jszip: any = await loadJsZip();
        const zip = new jszip();

        for (const item of selectedPages) {
          const page = await pdf.getPage(item.num);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");

          await page.render({ canvasContext: context, viewport }).promise;

          const imageBlob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), mimeType, 0.85);
          });

          if (imageBlob) {
            zip.file(`Page_${item.num}.${format}`, imageBlob);
          }
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);

        setOutputType("zip");
        setOutputBlob(zipBlob);
        setOutputUrl(url);
        setConverting(false);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to convert PDF pages.");
      setConverting(false);
    }
  };

  return (
    <div className={`min-h-screen w-full text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300 ${
      !isPremium ? "pb-16 lg:pb-0" : ""
    }`}>
      <Header />

      <div className="flex-1 flex-col md:flex-row flex w-full max-w-[100vw] justify-center overflow-hidden">
        
        {/* LEFT AD COLUMN */}
        {!isPremium && (
          <aside className="hidden md:flex w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
            <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-555 tracking-wider">Advertisement</span>
              <div className="text-center text-xs text-zinc-550 dark:text-zinc-400 space-y-2">
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
              <i className="ri-file-image-line text-blue-600 dark:text-blue-500"></i> PDF to Image Converter
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Convert document layouts into PNG or JPG image assets. Run entirely inside browser local memory.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-file-image-fill"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF document to convert</p>
                <p className="text-[14px] text-zinc-405 dark:text-zinc-550 mt-1">Upload a PDF to render visual page extraction lists.</p>
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
              <p className="text-xs text-zinc-505">Loading page models...</p>
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
                  className="text-xs font-bold text-red-650 hover:underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {/* Configurations panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-550 mb-1.5">
                    Output Image Format
                  </label>
                  <select
                    value={format}
                    onChange={(e: any) => setFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer font-bold"
                  >
                    <option value="png">PNG (Lossless & High Quality)</option>
                    <option value="jpeg">JPEG (Fast & Small Size)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-550 mb-1.5">
                    Resolution Quality
                  </label>
                  <select
                    value={resolution}
                    onChange={(e: any) => setResolution(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer font-bold"
                  >
                    <option value="standard">Standard Resolution (1x)</option>
                    <option value="high">High Resolution (2x - Crisp Print)</option>
                  </select>
                </div>
              </div>

              {/* Grid Selector */}
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
                          ? "bg-blue-505/10 dark:bg-blue-900/25 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-zinc-350 dark:hover:border-zinc-700"
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

              {/* Convert action trigger */}
              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={handleConvert}
                  disabled={converting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  {converting ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <i className="ri-image-add-line"></i> Convert PDF to Images
                    </>
                  )}
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
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Converted Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {outputType === "image" 
                    ? "Your single page image file is compiled." 
                    : `Your converted images are compiled inside a single ZIP file.`}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={outputType === "image" ? `Page_Converted.${format}` : `Converted_Images.zip`}
                  className="w-full sm:w-auto px-5 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold rounded-xl text-xs border border-zinc-300 dark:border-zinc-700 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ri-download-2-line"></i> Download {outputType === "image" ? "Image" : "ZIP File"}
                </a>
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
                Convert Another PDF
              </button>
            </div>
          )}
        </main>

        {/* RIGHT AD COLUMN */}
        {!isPremium && (
          <aside className="flex md:hidden lg:flex w-full md:w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
            <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-555 tracking-wider">Advertisement</span>
              <div className="text-center text-xs text-zinc-555 dark:text-zinc-400 space-y-2">
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
              <span className="bg-zinc-100 dark:bg-zinc-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded text-zinc-550">AD</span>
              <p className="font-semibold text-[12px] text-zinc-555 dark:text-zinc-400">Upgrade to remove ads and unlock pro features.</p>
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
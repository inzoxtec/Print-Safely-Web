// app/tools/rotate-pdf/RotatePdf.tsx
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

interface PageThumbnail {
  index: number;
  dataUrl: string;
  rotation: number; // 0, 90, 180, 270
}

export default function RotatePdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageThumbnail[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
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
      script.src = "/vendor/pdfjs-3.4.120/pdf.min.js";
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs-3.4.120/pdf.worker.min.js";
        resolve(pdfjs);
      };
      document.head.appendChild(script);
    });
  };

  const loadPdfLib = async () => {
    if ((window as any).PDFLib) return (window as any).PDFLib;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "/vendor/pdf-lib/pdf-lib.min.js";
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
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        thumbs.push({
          index: i - 1,
          dataUrl: canvas.toDataURL(),
          rotation: 0,
        });
      }
      setPages(thumbs);
    } catch (err) {
      alert("Failed to render page previews.");
    } finally {
      setLoadingPages(false);
    }
  };

  const rotateSinglePage = (idx: number, delta: number) => {
    setPages((prev) =>
      prev.map((p, i) => {
        if (i === idx) {
          const newRot = (p.rotation + delta + 360) % 360;
          return { ...p, rotation: newRot };
        }
        return p;
      })
    );
  };

  const rotateAllPages = (delta: number) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + delta + 360) % 360,
      }))
    );
  };

  const handleSave = async () => {
    if (!file || pages.length === 0) return;
    setSaving(true);

    try {
      const PDFLibInstance: any = await loadPdfLib();
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFLibInstance.PDFDocument.load(arrayBuffer);

      const pdfPages = pdfDoc.getPages();
      pages.forEach((p) => {
        if (p.index < pdfPages.length) {
          const page = pdfPages[p.index];
          const currentRotation = page.getRotation().angle || 0;
          page.setRotation(PDFLibInstance.degrees((currentRotation + p.rotation) % 360));
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setOutputBlob(blob);
      setOutputUrl(url);
    } catch (err) {
      alert("Failed to rotate PDF pages.");
    } finally {
      setSaving(false);
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    
    const name = `${file?.name?.split(".")[0]}_rotated.pdf`;
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
      alert("Failed to queue file database write locally. Please download the file instead.");
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
              { name: "Rotate PDF", url: "https://printsafely.app/tools/rotate-pdf" },
            ]}
          />

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-refresh-line text-blue-600 dark:text-blue-500"></i> Rotate PDF Pages
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Rotate sideways or upside-down PDF pages clockwise or counter-clockwise 100% locally in your browser.
            </p>
          </div>

          {/* FILE INPUT BOX */}
          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-refresh-line"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF file to rotate</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-1">Select a PDF file to rotate individual or all pages.</p>
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

          {/* LOADING STATE */}
          {loadingPages && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-sm animate-in fade-in duration-200">
              <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Generating Page Previews...</p>
                <p className="text-xs text-zinc-500 font-mono">Loading PDF pages locally in browser RAM</p>
              </div>
            </div>
          )}

          {/* THUMBNAIL GRID & ROTATION CONTROLS */}
          {file && !loadingPages && pages.length > 0 && !outputUrl && (
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
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {pages.length} page(s)
                    </p>
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

              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Total Pages: {pages.length}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => rotateAllPages(-90)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer border border-zinc-200 dark:border-zinc-700"
                  >
                    ↺ Rotate All Left
                  </button>
                  <button
                    onClick={() => rotateAllPages(90)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer border border-zinc-200 dark:border-zinc-700"
                  >
                    ↻ Rotate All Right
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {pages.map((p, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm"
                  >
                    <div className="w-full h-44 flex items-center justify-center overflow-hidden bg-white dark:bg-zinc-900 rounded-xl">
                      <img
                        src={p.dataUrl}
                        alt={`Page ${idx + 1}`}
                        style={{ transform: `rotate(${p.rotation}deg)` }}
                        className="max-h-full max-w-full object-contain transition-transform duration-300"
                      />
                    </div>
                    <div className="flex items-center justify-between w-full pt-1">
                      <span className="text-xs font-bold text-zinc-500">Page {idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => rotateSinglePage(idx, -90)}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                          title="Rotate Left"
                        >
                          ↺
                        </button>
                        <button
                          onClick={() => rotateSinglePage(idx, 90)}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                          title="Rotate Right"
                        >
                          ↻
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
                      Processing PDF...
                    </>
                  ) : (
                    <>
                      <i className="ri-refresh-line"></i> Apply Rotation & Download
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* OUTPUT DOWNLOAD AREA */}
          {outputUrl && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm animate-in fade-in duration-300">
              <div className="flex justify-center text-emerald-500 text-5xl">
                <i className="ri-checkbox-circle-fill"></i>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">PDF Rotated Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Your rotated PDF is ready. You can secure share or download it.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`${file?.name?.split(".")[0]}_rotated.pdf`}
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
                  setPages([]);
                  setOutputUrl(null);
                  setOutputBlob(null);
                }}
                className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto"
              >
                Start a New Rotation
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

      {/* MOBILE BOTTOM BANNER (Mobile only) */}
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
        title="Rotate PDF Pages Online Free - Lossless PDF Rotation"
        subtitle="Rotate sideways or inverted PDF pages clockwise or counter-clockwise online. Fast, free, and 100% private with no server uploads."
        steps={[
          { title: "Select PDF File", desc: "Choose a PDF document from your device to load its pages." },
          { title: "Rotate Pages", desc: "Use the rotation controls to rotate individual pages or all pages at once." },
          { title: "Download PDF", desc: "Click Apply Rotation to compile your updated document instantly." }
        ]}
        features={[
          { icon: "⚡", title: "Instant & Local", desc: "Rotates page orientation in your browser without uploading files." },
          { icon: "🔒", title: "100% Private", desc: "Your PDF files stay strictly on your local device." },
          { icon: "🔄", title: "Lossless Rotation", desc: "Changes page orientation tags without re-compressing PDF text." }
        ]}
        faqs={[
          { question: "Can I rotate individual pages instead of the whole file?", answer: "Yes! You can rotate single pages or use the Rotate All button." },
          { question: "Does rotating PDF pages degrade quality?", answer: "No, SafelyPrint applies lossless rotation to page properties without altering original text or image quality." }
        ]}
      />
      <ToolSeoSchema
        name="Rotate PDF Pages Online Free"
        description="Rotate sideways or upside-down PDF pages 90, 180, or 270 degrees 100% locally in your web browser."
        url="https://printsafely.app/tools/rotate-pdf"
        steps={[
          "Select a PDF document to view page previews.",
          "Click rotation buttons to orient individual or all pages.",
          "Click Apply Rotation to download your rotated PDF."
        ]}
        faqs={[
          { question: "Can I rotate individual pages instead of the whole file?", answer: "Yes! You can rotate single pages or use the Rotate All button." },
          { question: "Does rotating PDF pages degrade quality?", answer: "No, SafelyPrint applies lossless rotation to page properties without altering original text or image quality." }
        ]}
      />
      <Footer />
    </div>
  );
}

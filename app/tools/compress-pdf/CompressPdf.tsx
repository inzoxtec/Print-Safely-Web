// app/tools/compress-pdf/CompressPdf.tsx
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

export default function CompressPdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<"low" | "medium" | "high">("medium");
  const [converting, setConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setOriginalSize(selectedFile.size);
    setOutputUrl(null);
    setOutputBlob(null);
  };

  const handleCompress = async () => {
    if (!file) return;
    setConverting(true);
    setProgressMsg("Preparing PDF optimizer...");

    try {
      const pdfjs: any = await loadPdfJS();
      const PDFLibInstance: any = await loadPdfLib();

      const renderScale = compressionLevel === "high" ? 1.4 : compressionLevel === "medium" ? 1.75 : 2.2;
      const quality = compressionLevel === "high" ? 0.50 : compressionLevel === "medium" ? 0.68 : 0.82;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      const compressedPdfDoc = await PDFLibInstance.PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        setProgressMsg(`Compressing page ${i} of ${totalPages}...`);
        const page = await pdf.getPage(i);
        const origViewport = page.getViewport({ scale: 1.0 });
        const renderViewport = page.getViewport({ scale: renderScale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;

        await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

        const imgDataUrl = canvas.toDataURL("image/jpeg", quality);
        const imgBytes = await fetch(imgDataUrl).then((res) => res.arrayBuffer());
        const embeddedImg = await compressedPdfDoc.embedJpg(imgBytes);

        const pdfPage = compressedPdfDoc.addPage([origViewport.width, origViewport.height]);
        pdfPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: origViewport.width,
          height: origViewport.height,
        });
      }

      setProgressMsg("Finalising compressed PDF file...");
      const pdfBytes = await compressedPdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      setCompressedSize(pdfBlob.size);
      const url = URL.createObjectURL(pdfBlob);

      setOutputBlob(pdfBlob);
      setOutputUrl(url);

    } catch (err) {
      console.error(err);
      alert("Failed to compress PDF file.");
    } finally {
      setConverting(false);
      setProgressMsg("");
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    
    const name = `${file?.name?.split(".")[0]}_compressed.pdf`;
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
              { name: "Compress PDF", url: "https://printsafely.app/tools/compress-pdf" },
            ]}
          />

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-zip-line text-blue-600 dark:text-blue-500"></i> Compress & Reduce PDF File Size
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Shrink PDF file size for fast email attachment and web uploads 100% locally in your browser.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-file-zip-line"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF file to compress</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-1">Choose a large PDF to reduce its file size.</p>
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
                      Original Size: {(originalSize / 1024 / 1024).toFixed(2)} MB
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

              {/* COMPRESSION LEVEL CHOOSER */}
              <div className="w-full text-left space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Select Compression Level:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["low", "medium", "high"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCompressionLevel(lvl)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold capitalize transition border cursor-pointer ${
                        compressionLevel === lvl
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {lvl === "low" ? "Low (High Quality)" : lvl === "medium" ? "Recommended" : "High (Max Small)"}
                    </button>
                  ))}
                </div>
              </div>

              {converting && (
                <div className="py-4 text-center space-y-2">
                  <div className="animate-spin h-6 w-6 text-blue-600 border-3 border-t-transparent rounded-full mx-auto" />
                  <p className="text-xs text-zinc-500 font-mono">{progressMsg || "Compressing PDF pages..."}</p>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={handleCompress}
                  disabled={converting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {converting ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
                      Compressing...
                    </>
                  ) : (
                    <>
                      <i className="ri-zip-line"></i> Compress PDF File
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
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">PDF Compressed Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Your optimized PDF is ready. You can secure share or download it.</p>
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 max-w-md mx-auto text-xs space-y-1">
                <p className="text-emerald-800 dark:text-emerald-300">
                  <span className="font-bold">Original:</span> {(originalSize / 1024 / 1024).toFixed(2)} MB
                </p>
                <p className="text-emerald-800 dark:text-emerald-300">
                  <span className="font-bold">Compressed:</span> {(compressedSize / 1024 / 1024).toFixed(2)} MB
                </p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 pt-1">
                  {originalSize > compressedSize
                    ? `Saved ${(((originalSize - compressedSize) / originalSize) * 100).toFixed(0)}% space!`
                    : "Document is already highly optimized"}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`${file?.name?.split(".")[0]}_compressed.pdf`}
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
                Compress Another File
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
        title="Compress PDF Online Free - Reduce PDF File Size"
        subtitle="Optimize and shrink large PDF files in your web browser. 100% private in-browser compression with no server uploads."
        steps={[
          { title: "Select PDF Document", desc: "Upload or drag-and-drop a PDF file to compress." },
          { title: "Choose Compression", desc: "Select your desired balance between image resolution and file size reduction." },
          { title: "Download PDF", desc: "Save the compressed PDF file directly to your device." }
        ]}
        features={[
          { icon: "⚡", title: "Instant In-Browser", desc: "Optimizes and compresses PDF document contents locally." },
          { icon: "🔒", title: "100% Secure & Private", desc: "Files remain on your client device and are never sent to external servers." },
          { icon: "📉", title: "Smart Compression", desc: "Reduces file size dramatically while maintaining document readability." }
        ]}
        faqs={[
          { question: "How much can I reduce my PDF file size?", answer: "Compression rates typically range from 30% up to 80% depending on embedded images and formatting." },
          { question: "Are my confidential files uploaded to any server?", answer: "No! All PDF optimization is completed 100% client-side inside your web browser." }
        ]}
      />
      <ToolSeoSchema
        name="Compress PDF Online Free"
        description="Shrink PDF file size for fast email sharing and web uploads 100% locally in your web browser."
        url="https://printsafely.app/tools/compress-pdf"
        steps={[
          "Select a PDF file to compress.",
          "Choose your preferred compression level.",
          "Click Compress PDF File to download your optimized document."
        ]}
        faqs={[
          { question: "How much can I reduce my PDF file size?", answer: "Compression rates typically range from 30% up to 80% depending on embedded images and formatting." },
          { question: "Are my confidential files uploaded to any server?", answer: "No! All PDF optimization is completed 100% client-side inside your web browser." }
        ]}
      />
      <Footer />
    </div>
  );
}


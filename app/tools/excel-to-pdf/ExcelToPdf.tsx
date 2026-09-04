// app/tools/excel-to-pdf/ExcelToPdf.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import BreadcrumbSchema from "@/app/components/BreadcrumbSchema";

export default function ExcelToPdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  
  // Action states
  const [converting, setConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // Configuration options
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  
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

  // Dynamic script loader helper
  const loadScript = (src: string, globalName: string): Promise<any> => {
    if ((window as any)[globalName]) return Promise.resolve((window as any)[globalName]);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve((window as any)[globalName]);
      script.onerror = () => reject(new Error(`Failed to load ${globalName}`));
      document.head.appendChild(script);
    });
  };

  const loadAllEngines = async () => {
    setProgressMsg("Loading Excel extraction libraries...");
    await loadScript("/vendor/excel/xlsx.full.min.js", "XLSX");
    await loadScript("/vendor/docx/html2pdf.bundle.min.js", "html2pdf");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      alert("Only Microsoft Excel files (.xlsx or .xls format) are supported locally.");
      return;
    }

    setFile(selectedFile);
    setOutputUrl(null);
    setOutputBlob(null);
  };

  const handleConvert = async () => {
    if (!file) return;
    setConverting(true);
    setProgressMsg("Preparing rendering targets...");

    // Create a temporary block element in standard page flow
    const hiddenContainer = document.createElement("div");
    hiddenContainer.id = "excel-render-container";
    hiddenContainer.style.width = orientation === "landscape" ? "1060px" : "794px";
    hiddenContainer.style.background = "#FFFFFF";
    hiddenContainer.style.color = "#000000";
    hiddenContainer.style.margin = "0 auto";
    hiddenContainer.style.padding = "20px";
    document.body.appendChild(hiddenContainer);

    // Save native String.fromCodePoint reference
    const originalFromCodePoint = String.fromCodePoint;

    try {
      await loadAllEngines();

      setProgressMsg("Unpacking Excel binary data...");
      const arrayBuffer = await file.arrayBuffer();

      setProgressMsg("Converting spreadsheet grids...");
      const XLSX = (window as any).XLSX;
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      
      // Render all sheets sequentially into HTML
      let combinedHtml = "";
      workbook.SheetNames.forEach((sheetName: string) => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetHtml = XLSX.utils.sheet_to_html(worksheet);
        
        combinedHtml += `
          <div style="page-break-after: always; margin-bottom: 30px;">
            <h2 style="font-family: sans-serif; font-size: 14px; margin-bottom: 10px; color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 4px;">
              ${sheetName}
            </h2>
            <div style="overflow-x: auto;">
              ${sheetHtml}
            </div>
          </div>
        `;
      });

      // Inject HTML content with spreadsheet border styles
      hiddenContainer.innerHTML = `
        <style>
          #excel-render-container table { 
            border-collapse: collapse; 
            width: 100%; 
            font-family: sans-serif; 
            font-size: 9px; 
            margin-bottom: 20px;
          }
          #excel-render-container td, #excel-render-container th { 
            border: 1px solid #e2e8f0; 
            padding: 5px; 
            text-align: left; 
          }
          #excel-render-container tr:nth-child(even) { 
            background-color: #f8fafc; 
          }
          #excel-render-container th { 
            background-color: #f1f5f9; 
            font-weight: bold; 
            color: #334155;
          }
        </style>
        ${combinedHtml}
      `;

      setProgressMsg("Compiling final vector PDF file...");

      // 1. Temporarily override String.fromCodePoint to catch html2canvas crashes on glyph codes
      String.fromCodePoint = function (...codePoints: number[]) {
        try {
          return originalFromCodePoint.apply(this, codePoints);
        } catch (err) {
          return "";
        }
      };

      // 2. Generate PDF via html2pdf using outputPdf("blob")
      const html2pdfEngine = (window as any).html2pdf;
      const pdfOptions = {
        margin: 10,
        filename: `${file.name.split(".")[0]}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: "mm", format: "a4", orientation: orientation }
      };

      const pdfBlobOutput = await html2pdfEngine()
        .from(hiddenContainer)
        .set(pdfOptions)
        .outputPdf("blob");

      const url = URL.createObjectURL(pdfBlobOutput);
      setOutputBlob(pdfBlobOutput);
      setOutputUrl(url);

    } catch (err) {
      console.error("Excel conversion failure:", err);
      alert("Failed to convert Excel document. Verify it is not corrupted or password-encrypted.");
    } finally {
      // Reset loader
      setConverting(false);
      setProgressMsg("");

      // Restore native String.fromCodePoint
      String.fromCodePoint = originalFromCodePoint;

      // Clear rendering node
      if (document.body.contains(hiddenContainer)) {
        document.body.removeChild(hiddenContainer);
      }
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    
    const name = `${file?.name?.split(".")[0]}.pdf`;
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

      window.location.href = "/upload";
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
        
        {/* LEFT AD COLUMN */}
        {!isPremium && (
          <aside className="hidden md:flex w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
            <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-555 tracking-wider">Advertisement</span>
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
          <BreadcrumbSchema
            items={[
              { name: "Home", url: "https://printsafely.app" },
              { name: "Tools", url: "https://printsafely.app#tools-catalog" },
              { name: "Excel to PDF", url: "https://printsafely.app/tools/excel-to-pdf" },
            ]}
          />

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-file-excel-line text-green-600 dark:text-green-500"></i> Excel to PDF Converter
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Convert Excel sheets (.xlsx/.xls) into formatted vector PDFs offline. Your data remains strictly local.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-file-excel-fill"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select Spreadsheet to convert</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-555 mt-1">Upload a XLSX or XLS file to start.</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
              >
                Choose Excel File
              </button>
            </div>
          )}

          {/* LOCAL INLINE LOADER */}
          {converting && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-sm animate-in fade-in duration-200">
              <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Converting Spreadsheet...</p>
                <p className="text-xs text-zinc-505 font-mono">{progressMsg}</p>
              </div>
            </div>
          )}

          {file && !outputUrl && !converting && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl space-y-6 shadow-sm">
              
              {/* File Info */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800">
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="h-10 w-10 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    <i className="ri-file-excel-line"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-555 font-semibold">Loaded Excel File</p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs font-bold text-red-655 hover:underline cursor-pointer font-bold text-red-600"
                >
                  Change File
                </button>
              </div>

              {/* Layout Config */}
              <div className="text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Page Orientation
                </label>
                <select
                  value={orientation}
                  onChange={(e: any) => setOrientation(e.target.value)}
                  className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer font-bold"
                >
                  <option value="landscape">Landscape (Best for Wide Spreadsheets)</option>
                  <option value="portrait">Portrait</option>
                </select>
              </div>

              <div className="py-6 text-center text-xs text-zinc-555 dark:text-zinc-455 space-y-2">
                <i className="ri-shuffle-line text-blue-500 text-3xl"></i>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Spreadsheet Render Pipeline</p>
                <p className="max-w-md mx-auto leading-relaxed">
                  SafelyPrint extracts spreadsheet grids from all active sheet tabs and renders them into standard vector-based PDF format.
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={handleConvert}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <i className="ri-shuffle-line"></i> Convert to PDF
                </button>
              </div>

            </div>
          )}

          {/* Success Screen */}
          {outputUrl && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm animate-in fade-in duration-300">
              <div className="flex justify-center text-emerald-555 text-5xl">
                <i className="ri-checkbox-circle-fill text-emerald-500"></i>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Converted Successfully!</h3>
                <p className="text-xs text-zinc-455 dark:text-zinc-400">Your Excel sheet is converted. Secure share or download below.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`${file?.name?.split(".")[0]}.pdf`}
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
                }}
                className="text-xs font-semibold text-zinc-405 hover:underline cursor-pointer block mx-auto"
              >
                Convert Another Spreadsheet
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
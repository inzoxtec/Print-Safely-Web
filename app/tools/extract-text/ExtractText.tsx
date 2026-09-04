// app/tools/extract-text/ExtractText.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import BreadcrumbSchema from "@/app/components/BreadcrumbSchema";

export default function ExtractText() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  
  // Extraction states
  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [isScanned, setIsScanned] = useState(false);

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

  const loadTesseract = async () => {
    if ((window as any).Tesseract) return (window as any).Tesseract;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "/vendor/tesseract/tesseract.min.js";
      script.onload = () => resolve((window as any).Tesseract);
      document.head.appendChild(script);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    
    // Accept PDFs and standard images
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    
    if (!validTypes.includes(selectedFile.type) && ext !== "pdf") {
      alert("Please upload a valid PDF or image file (PNG, JPG, WebP).");
      return;
    }

    setFile(selectedFile);
    setExtractedText("");
    setIsScanned(false);
    setOcrProgress("");
  };

  // Perform Extract
  const handleExtractText = async () => {
    if (!file) return;
    setExtracting(true);
    setOcrProgress("Initializing engines...");
    setExtractedText("");
    setIsScanned(false);

    try {
      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

      if (isPdf) {
        // PDF flow: Try fast digital text extraction first
        const pdfjs: any = await loadPdfJS();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        
        let parsedText = "";
        for (let i = 1; i <= totalPages; i++) {
          setOcrProgress(`Reading digital text: Page ${i} of ${totalPages}`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          
          if (pageText.trim()) {
            parsedText += `--- Page ${i} ---\n\n${pageText}\n\n`;
          }
        }

        // If digital text extraction is empty, trigger client-side OCR automatically
        if (parsedText.trim().length < 15) {
          setIsScanned(true);
          setOcrProgress("Scanned PDF detected. Preparing local OCR engine...");
          
          const tesseract: any = await loadTesseract();
          const worker = await tesseract.createWorker({
            logger: (m: any) => {
              if (m.status === "recognizing") {
                setOcrProgress(`Scanning pages: ${(m.progress * 100).toFixed(0)}%`);
              }
            }
          });
          await worker.loadLanguage("eng");
          await worker.initialize("eng");

          let ocrCompiledText = "";
          for (let i = 1; i <= totalPages; i++) {
            setOcrProgress(`Running OCR: Page ${i} of ${totalPages}`);
            const page = await pdf.getPage(i);
            
            // Render page onto canvas at 1.5x resolution to make text legible for OCR
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            await page.render({ canvasContext: ctx, viewport }).promise;

            const canvasDataUrl = canvas.toDataURL("image/jpeg", 0.9);
            const { data } = await worker.recognize(canvasDataUrl);
            
            ocrCompiledText += `--- Page ${i} (OCR Parsed) ---\n\n${data.text}\n\n`;
          }

          await worker.terminate();
          setExtractedText(ocrCompiledText);
        } else {
          setExtractedText(parsedText);
        }
      } else {
        // Image flow: Directly run local Tesseract OCR on image file
        setOcrProgress("Loading Tesseract OCR engine...");
        const tesseract: any = await loadTesseract();
        
        const worker = await tesseract.createWorker({
          logger: (m: any) => {
            if (m.status === "recognizing") {
              setOcrProgress(`Scanning image: ${(m.progress * 100).toFixed(0)}%`);
            }
          }
        });
        
        await worker.loadLanguage("eng");
        await worker.initialize("eng");

        // Convert image file to data URL
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (evt) => resolve(evt.target?.result as string);
          reader.readAsDataURL(file);
        });

        const { data } = await worker.recognize(dataUrl);
        await worker.terminate();
        setExtractedText(data.text);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to parse document text. Make sure file is not password locked.");
    } finally {
      setExtracting(false);
      setOcrProgress("");
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(extractedText);
    alert("Text copied to clipboard!");
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([extractedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Extracted_${file?.name?.split(".")[0]}.txt`;
    link.click();
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
          <BreadcrumbSchema
            items={[
              { name: "Home", url: "https://printsafely.app" },
              { name: "Tools", url: "https://printsafely.app#tools-catalog" },
              { name: "Extract Text", url: "https://printsafely.app/tools/extract-text" },
            ]}
          />

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-text-snippet-line text-blue-600 dark:text-blue-500"></i> Local Text Extractor (OCR)
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Extract digital texts from PDFs or images locally. Scanned documents are parsed offline via WebAssembly OCR.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-105 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-file-text-line"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF or Image file</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-550 mt-1">Supports PDF, PNG, JPG, and WebP files up to 25MB.</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
              >
                Choose Document File
              </button>
            </div>
          )}

          {extracting && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-sm">
              <div className="animate-spin h-10 w-10 text-blue-650 border-4 border-t-transparent rounded-full mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold">Processing Document...</p>
                <p className="text-xs text-zinc-500 font-mono">{ocrProgress}</p>
              </div>
            </div>
          )}

          {file && !extractedText && !extracting && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl space-y-6 shadow-sm">
              
              {/* File Info */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800">
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    <i className="ri-file-line"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-500 font-semibold">Ready for extraction</p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs font-bold text-red-650 hover:underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              <div className="py-6 text-center text-xs text-zinc-550 dark:text-zinc-450 space-y-2">
                <i className="ri-text-snippet-line text-blue-500 text-3xl"></i>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Local OCR Verification Mode</p>
                <p className="max-w-md mx-auto leading-relaxed">
                  SafelyPrint runs a local parser to extract plain-text characters. The extraction occurs entirely client-side and keeps your document content private.
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={handleExtractText}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <i className="ri-text-spacing"></i> Begin Extract Text
                </button>
              </div>

            </div>
          )}

          {/* Extracted Text Editor Output Workspace */}
          {extractedText && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl space-y-4 shadow-sm animate-in fade-in duration-300">
              
              {isScanned && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 rounded-xl text-xs text-left font-bold flex items-center gap-1.5">
                  <i className="ri-error-warning-line"></i> Scanned Document Detected: Text extracted using local machine learning OCR.
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Extracted Text Output
                </span>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyToClipboard}
                    className="p-1.5 text-zinc-500 hover:text-blue-500 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold cursor-pointer flex items-center gap-1"
                    title="Copy to Clipboard"
                  >
                    <i className="ri-file-copy-line"></i> Copy
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="p-1.5 text-zinc-500 hover:text-blue-500 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold cursor-pointer flex items-center gap-1"
                    title="Download as .txt"
                  >
                    <i className="ri-download-2-line"></i> Save .txt
                  </button>
                </div>
              </div>

              <textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                className="w-full h-80 px-4 py-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 text-xs rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none resize-y font-mono leading-relaxed"
              />

              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-between items-center gap-4">
                <button
                  onClick={() => {
                    setFile(null);
                    setExtractedText("");
                  }}
                  className="text-xs font-semibold text-zinc-405 hover:underline cursor-pointer"
                >
                  Clear & Start Over
                </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${extractedText}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all"
                  >
                    Share via WhatsApp
                  </a>
              </div>

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
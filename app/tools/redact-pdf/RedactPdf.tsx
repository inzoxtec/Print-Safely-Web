// app/tools/redact-pdf/RedactPdf.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ToolSeoSection from "@/app/components/ToolSeoSection";
import ToolSeoSchema from "@/app/components/ToolSeoSchema";
import ToolLayout from "@/app/components/ToolLayout";

interface RedactBox {
  pageIndex: number;
  xRatio: number; // 0 to 1
  yRatio: number; // 0 to 1
  wRatio: number; // 0 to 1
  hRatio: number; // 0 to 1
}

export default function RedactPdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<{ index: number; dataUrl: string; width: number; height: number }[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  const [redactions, setRedactions] = useState<RedactBox[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setLoadingPages(true);
    setPages([]);
    setRedactions([]);
    setOutputUrl(null);
    setOutputBlob(null);

    try {
      const pdfjs: any = await loadPdfJS();
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const count = pdf.numPages;

      const loadedPages = [];
      for (let i = 1; i <= count; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        loadedPages.push({
          index: i - 1,
          dataUrl: canvas.toDataURL(),
          width: viewport.width,
          height: viewport.height,
        });
      }
      setPages(loadedPages);
      setActivePageIndex(0);
    } catch (err) {
      alert("Failed to render document preview.");
    } finally {
      setLoadingPages(false);
    }
  };

  useEffect(() => {
    if (!pages[activePageIndex] || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const page = pages[activePageIndex];
    canvas.width = page.width;
    canvas.height = page.height;

    const img = new Image();
    img.src = page.dataUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const pageRedactions = redactions.filter((r) => r.pageIndex === activePageIndex);
      pageRedactions.forEach((r) => {
        ctx.fillStyle = "#000000";
        ctx.fillRect(r.xRatio * page.width, r.yRatio * page.height, r.wRatio * page.width, r.hRatio * page.height);
      });

      if (currentBox) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.strokeRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
      }
    };
  }, [activePageIndex, pages, redactions, currentBox]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentBox({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    const x = Math.min(startPos.x, currentX);
    const y = Math.min(startPos.y, currentY);
    const w = Math.abs(currentX - startPos.x);
    const h = Math.abs(currentY - startPos.y);

    setCurrentBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox || !pages[activePageIndex]) return;
    setIsDrawing(false);

    if (currentBox.w > 5 && currentBox.h > 5) {
      const page = pages[activePageIndex];
      const newRedaction: RedactBox = {
        pageIndex: activePageIndex,
        xRatio: currentBox.x / page.width,
        yRatio: currentBox.y / page.height,
        wRatio: currentBox.w / page.width,
        hRatio: currentBox.h / page.height,
      };
      setRedactions((prev) => [...prev, newRedaction]);
    }
    setCurrentBox(null);
    setStartPos(null);
  };

  const clearCurrentPageRedactions = () => {
    setRedactions((prev) => prev.filter((r) => r.pageIndex !== activePageIndex));
  };

  const handleSave = async () => {
    if (!file || redactions.length === 0) {
      alert("Please draw at least one redaction box to blackout.");
      return;
    }
    setSaving(true);

    try {
      const PDFLibInstance: any = await loadPdfLib();
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFLibInstance.PDFDocument.load(arrayBuffer);
      const pdfPages = pdfDoc.getPages();

      redactions.forEach((r) => {
        if (r.pageIndex < pdfPages.length) {
          const page = pdfPages[r.pageIndex];
          const { width, height } = page.getSize();

          const rectX = r.xRatio * width;
          const rectY = height - r.yRatio * height - r.hRatio * height;
          const rectW = r.wRatio * width;
          const rectH = r.hRatio * height;

          page.drawRectangle({
            x: rectX,
            y: rectY,
            width: rectW,
            height: rectH,
            color: PDFLibInstance.rgb(0, 0, 0),
          });
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setOutputBlob(blob);
      setOutputUrl(url);
    } catch (err) {
      alert("Failed to apply redaction boxes to PDF.");
    } finally {
      setSaving(false);
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    
    const name = `${file?.name?.split(".")[0]}_redacted.pdf`;
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
    <ToolLayout
      breadcrumbs={[
              { name: "Home", url: "https://printsafely.app" },
              { name: "Tools", url: "https://printsafely.app#tools-catalog" },
              { name: "Redact PDF", url: "https://printsafely.app/tools/redact-pdf" },
            ]}
    >
<div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-eye-off-line text-blue-600 dark:text-blue-500"></i> Redact & Blackout PDF Text
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Draw black redaction boxes over sensitive personal text or images 100% locally in your browser.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-eye-off-line"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF file to redact</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-1">Choose a PDF to redact confidential details with blackouts.</p>
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

          {loadingPages && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-sm animate-in fade-in duration-200">
              <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Preparing Page Workspace...</p>
                <p className="text-xs text-zinc-500 font-mono">Rendering PDF pages locally in RAM</p>
              </div>
            </div>
          )}

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
                    setRedactions([]);
                  }}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              <div className="flex items-center justify-between w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3 rounded-2xl">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActivePageIndex((prev) => Math.max(0, prev - 1))}
                    disabled={activePageIndex === 0}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold disabled:opacity-40 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                  >
                    &larr; Prev
                  </button>
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                    Page {activePageIndex + 1} of {pages.length}
                  </span>
                  <button
                    onClick={() => setActivePageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
                    disabled={activePageIndex === pages.length - 1}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold disabled:opacity-40 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                  >
                    Next &rarr;
                  </button>
                </div>

                <button
                  onClick={clearCurrentPageRedactions}
                  className="px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition cursor-pointer"
                >
                  Clear Page Blackouts
                </button>
              </div>

              <div className="relative border border-zinc-300 dark:border-zinc-700 rounded-2xl shadow-lg overflow-hidden bg-white cursor-crosshair mx-auto flex justify-center">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="max-w-full h-auto block"
                />
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                Click and drag on the document preview above to draw black redaction boxes over sensitive text.
              </p>

              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving || redactions.length === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
                      Applying Blackouts...
                    </>
                  ) : (
                    <>
                      <i className="ri-eye-off-line"></i> Apply {redactions.length} Blackout(s) & Export
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
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">PDF Redacted Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Your redacted PDF is ready. You can secure share or download it.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`${file?.name?.split(".")[0]}_redacted.pdf`}
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
                  setRedactions([]);
                  setOutputUrl(null);
                  setOutputBlob(null);
                }}
                className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto"
              >
                Redact Another Document
              </button>
            </div>
          )}
      <ToolSeoSection
        title="Redact PDF Online Free - Permanent Confidential Blackouts"
        subtitle="Blackout sensitive personal text, numbers, and graphics in your PDF files with 100% client-side privacy."
        steps={[
          { title: "Select PDF Document", desc: "Choose a PDF file from your computer or mobile device." },
          { title: "Draw Redaction Boxes", desc: "Click and drag over sensitive areas to place black redaction boxes." },
          { title: "Export Redacted PDF", desc: "Click Apply Blackouts to permanently burn solid black boxes into the PDF." }
        ]}
        features={[
          { icon: "🛡️", title: "100% Confidential", desc: "Redaction runs locally inside your browser tab without server uploads." },
          { icon: "✏️", title: "Visual Redaction", desc: "Draw exact rectangle blackout boxes over confidential fields." },
          { icon: "🔒", title: "Permanent Burn", desc: "Overlays permanent black shapes onto PDF page coordinates." }
        ]}
        faqs={[
          { question: "Is the redacted text recoverable after exporting?", answer: "No, SafelyPrint permanently draws solid black vector rectangles onto page coordinates before saving." },
          { question: "Are my documents uploaded to a cloud server?", answer: "Never! All redaction rendering takes place locally on your computer." }
        ]}
      />
      <ToolSeoSchema
        name="Redact PDF Online Free"
        description="Blackout confidential text and sensitive data in your PDF documents. 100% private in-browser redaction tool."
        url="https://printsafely.app/tools/redact-pdf"
        steps={[
          "Select a PDF document to load page previews.",
          "Draw black redaction boxes over sensitive text or graphics.",
          "Click Apply Blackouts to download your redacted PDF."
        ]}
        faqs={[
          { question: "Is the redacted text recoverable after exporting?", answer: "No, SafelyPrint permanently draws solid black vector rectangles onto page coordinates before saving." },
          { question: "Are my documents uploaded to a cloud server?", answer: "Never! All redaction rendering takes place locally on your computer." }
        ]}
      />
    </ToolLayout>
  );
}

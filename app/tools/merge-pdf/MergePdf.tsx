// app/tools/merge/page.tsx
"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import ToolLayout from "@/app/components/ToolLayout";
import ToolSeoSection from "@/app/components/ToolSeoSection";
import ToolSeoSchema from "@/app/components/ToolSeoSchema";

interface FileItem {
  id: string;
  file: File;
  name: string;
  size: string;
  pages: number;
}

export default function MergePdf() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const loadPdfLib = async () => {
    if ((window as any).PDFLib) return (window as any).PDFLib;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/vendor/pdf-lib/pdf-lib.min.js";
      script.onload = () => resolve((window as any).PDFLib);
      script.onerror = () => reject(new Error("Failed to load PDF-Lib"));
      document.head.appendChild(script);
    });
  };

  const getPageCount = async (file: File): Promise<number> => {
    try {
      const PDFLibInstance: any = await loadPdfLib();
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFLibInstance.PDFDocument.load(arrayBuffer, { updateMetadata: false });
      return pdfDoc.getPageCount();
    } catch (err) {
      return 1;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    const pdfFiles = selectedFiles.filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));

    const newItems: FileItem[] = [];
    for (const f of pdfFiles) {
      const pages = await getPageCount(f);
      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        file: f,
        name: f.name,
        size: formatBytes(f.size),
        pages
      });
    }

    setFiles(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const updated = [...files];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= files.length) return;
    
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFiles(updated);
  };

  const removeItem = (id: string) => {
    setFiles(prev => prev.filter(item => item.id !== id));
    setMergedUrl(null);
    setMergedBlob(null);
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setMerging(true);
    setMergedUrl(null);
    setMergedBlob(null);

    try {
      const PDFLibInstance: any = await loadPdfLib();
      const mergedPdf = await PDFLibInstance.PDFDocument.create();

      for (const item of files) {
        const fileBytes = await item.file.arrayBuffer();
        const tempPdf = await PDFLibInstance.PDFDocument.load(fileBytes);
        const copiedPages = await mergedPdf.copyPages(tempPdf, tempPdf.getPageIndices());
        copiedPages.forEach((page: any) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setMergedBlob(blob);
      setMergedUrl(url);
    } catch (err) {
      console.error(err);
      alert("Failed to merge PDF files.");
    } finally {
      setMerging(false);
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!mergedBlob) return;
    
    const name = "Merged_Document.pdf";
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
        const putRequest = store.put({ name, blob: mergedBlob, type, timestamp: Date.now() }, "active_forward");
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
    <ToolLayout
      breadcrumbs={[
        { name: "Home", url: "https://printsafely.app" },
        { name: "Tools", url: "https://printsafely.app#tools-catalog" },
        { name: "Merge PDF", url: "https://printsafely.app/tools/merge-pdf" },
      ]}
    >
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
          <i className="ri-merge-cells-horizontal text-blue-600 dark:text-blue-500"></i> Merge PDF Documents
        </h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-400">
          Combine multiple PDF files into a single document. Files are processed locally inside your web browser and never uploaded to our servers.
        </p>
      </div>

      {!mergedUrl && (
        <div className="bg-white dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
          <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
            <i className="ri-file-add-line"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF files to merge</p>
            <p className="text-[14px] text-zinc-400 dark:text-zinc-550 mt-1">Select 2 or more PDF files. You can arrange their order next.</p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
          >
            Choose PDF Files
          </button>
        </div>
      )}

      {files.length > 0 && !mergedUrl && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Documents Queue ({files.length})
            </span>
            <button onClick={() => setFiles([])} className="text-xs font-semibold text-red-600 hover:underline cursor-pointer">
              Clear All
            </button>
          </div>

          <div className="space-y-3">
            {files.map((item, index) => (
              <div key={item.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="h-10 w-10 bg-red-100 dark:bg-red-900/10 text-red-650 dark:text-red-400 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    <i className="ri-file-pdf-line"></i>
                  </div>
                  <div className="space-y-0.5 overflow-hidden pr-2 text-left">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                      {item.size} • {item.pages} page(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveItem(index, "up")}
                    disabled={index === 0}
                    className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30 cursor-pointer"
                  >
                    <i className="ri-arrow-up-line"></i>
                  </button>
                  <button
                    onClick={() => moveItem(index, "down")}
                    disabled={index === files.length - 1}
                    className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30 cursor-pointer"
                  >
                    <i className="ri-arrow-down-line"></i>
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-950/30 rounded cursor-pointer"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-end gap-3.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white border border-zinc-300 dark:border-zinc-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              + Add More Files
            </button>
            <button
              onClick={handleMerge}
              disabled={files.length < 2 || merging}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5"
            >
              {merging ? (
                <>
                  <div className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
                  Merging...
                </>
              ) : (
                <>
                  <i className="ri-shuffle-line"></i> Merge Documents
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {mergedUrl && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm animate-in fade-in duration-300">
          <div className="flex justify-center text-emerald-500 text-5xl">
            <i className="ri-checkbox-circle-fill"></i>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">PDFs Combined Successfully!</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Your merged PDF is ready. You can secure share or download it.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
            <a
              href={mergedUrl}
              download="Merged_Document.pdf"
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
              setMergedUrl(null);
              setMergedBlob(null);
              setFiles([]);
            }}
            className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto"
          >
            Start a New Merge
          </button>
        </div>
      )}

      <ToolSeoSection
        title="Merge PDF Online Free - Combine PDF Files Privately"
        subtitle="Combine multiple PDF documents into a single organized file online for free. Drag and drop to reorder pages with 100% client-side privacy."
        steps={[
          { title: "Select PDF Files", desc: "Choose two or more PDF files from your computer or mobile device." },
          { title: "Arrange Order", desc: "Drag and drop thumbnails to combine pages in your exact preferred sequence." },
          { title: "Merge & Save", desc: "Click Merge PDF to compile your documents instantly and download the combined PDF." }
        ]}
        features={[
          { icon: "⚡", title: "Instant & Local", desc: "Merging is performed locally in your browser with zero upload delay." },
          { icon: "🔒", title: "100% Confidential", desc: "Your PDF files are never uploaded to any remote server or cloud database." },
          { icon: "📑", title: "Unlimited Pages", desc: "Combine multiple PDF documents together without page count restrictions." }
        ]}
        faqs={[
          { question: "Is it safe to merge PDF files with SafelyPrint?", answer: "Yes! SafelyPrint operates entirely client-side using JavaScript. Your files remain on your computer throughout the merging process." },
          { question: "Can I reorder PDF pages before combining?", answer: "Absolutely. You can drag and drop file cards to rearrange the merging order prior to downloading." },
          { question: "Are there any file size limits for combining PDFs?", answer: "You can combine standard files up to 10MB each on free accounts, or up to 20 files simultaneously." }
        ]}
      />
      <ToolSeoSchema
        name="Merge PDF Online Free"
        description="Combine multiple PDF files into a single document locally in your browser. No server uploads, keeping your documents 100% private."
        url="https://printsafely.app/tools/merge-pdf"
        steps={[
          "Upload two or more PDF documents into the merge tool sandbox.",
          "Drag and drop file cards to set your preferred combining sequence.",
          "Click Merge PDF to compile and download your merged document instantly."
        ]}
        faqs={[
          { question: "Is it safe to merge PDF files with SafelyPrint?", answer: "Yes! SafelyPrint operates entirely client-side using JavaScript. Your files remain on your computer throughout the merging process." },
          { question: "Can I reorder PDF pages before combining?", answer: "Absolutely. You can drag and drop file cards to rearrange the merging order prior to downloading." },
          { question: "Are there any file size limits for combining PDFs?", answer: "You can combine standard files up to 10MB each on free accounts, or up to 20 files simultaneously." }
        ]}
      />
    </ToolLayout>
  );
}
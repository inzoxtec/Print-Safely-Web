// app/tools/image-to-pdf/ImageToPdfClientPage.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

interface ImageItem {
  id: string;
  file: File;
  name: string;
  size: string;
  dataUrl: string;
}

export default function ImageToPdf() {
  const { user } = useAuth();
  const [files, setFiles] = useState<ImageItem[]>([]);
  const [converting, setConverting] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Configuration States
  const [pageSize, setPageSize] = useState<"fit" | "a4_portrait" | "a4_landscape">("fit");
  const [margin, setMargin] = useState<"none" | "small" | "big">("none");

  // Drag and Drop ordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const loadPdfLib = async () => {
    if ((window as any).PDFLib) return (window as any).PDFLib;
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
      script.onload = () => resolve((window as any).PDFLib);
      document.head.appendChild(script);
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Convert File to preview URL & add to queue
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    const imageFiles = selectedFiles.filter(f => f.type.startsWith("image/"));

    const newItems: ImageItem[] = [];
    for (const f of imageFiles) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target?.result as string);
        reader.readAsDataURL(f);
      });

      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        file: f,
        name: f.name,
        size: formatBytes(f.size),
        dataUrl
      });
    }

    setFiles(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drag and Drop page queue ordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...files];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, removed);

    setFiles(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const removeImage = (id: string) => {
    setFiles(prev => prev.filter(item => item.id !== id));
    setOutputUrl(null);
    setOutputBlob(null);
  };

  // Converts any format (WebP, PNG, SVG) into compatible JPEG Bytes using temporary canvas
  const getJpgBytes = async (file: File): Promise<{ bytes: ArrayBuffer; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }
          
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            if (blob) {
              blob.arrayBuffer().then(bytes => {
                resolve({ bytes, width: img.width, height: img.height });
              }).catch(reject);
            } else {
              reject(new Error("Canvas conversion failed"));
            }
          }, "image/jpeg", 0.85);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleConvert = async () => {
    if (files.length === 0) return;
    setConverting(true);
    setOutputUrl(null);
    setOutputBlob(null);

    try {
      const PDFLibInstance: any = await loadPdfLib();
      const pdfDoc = await PDFLibInstance.PDFDocument.create();

      for (const item of files) {
        const { bytes, width: imgWidth, height: imgHeight } = await getJpgBytes(item.file);
        const embeddedImg = await pdfDoc.embedJpg(bytes);

        let pageW = imgWidth;
        let pageH = imgHeight;

        if (pageSize === "a4_portrait") {
          pageW = 595.28;
          pageH = 841.89;
        } else if (pageSize === "a4_landscape") {
          pageW = 841.89;
          pageH = 595.28;
        }

        let marginPoints = 0;
        if (margin === "small") marginPoints = 20;
        else if (margin === "big") marginPoints = 40;

        const contentW = pageW - marginPoints * 2;
        const contentH = pageH - marginPoints * 2;

        const imgRatio = imgWidth / imgHeight;
        const pageRatio = contentW / contentH;
        let drawW = contentW;
        let drawH = contentH;

        if (imgRatio > pageRatio) {
          drawH = contentW / imgRatio;
        } else {
          drawW = contentH * imgRatio;
        }

        const drawX = marginPoints + (contentW - drawW) / 2;
        const drawY = marginPoints + (contentH - drawH) / 2;

        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(embeddedImg, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setOutputBlob(blob);
      setOutputUrl(url);
    } catch (err) {
      console.error(err);
      alert("Failed to convert images to PDF. Make sure files are not corrupted.");
    } finally {
      setConverting(false);
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    
    const name = "Images_Converted.pdf";
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
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-550 tracking-wider">Advertisement</span>
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
              <i className="ri-image-add-line text-blue-600 dark:text-blue-500"></i> Image to PDF Converter
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Convert WebP, PNG, JPG, and SVG images into clean, aligned PDF pages. Organize layout and download locally.
            </p>
          </div>

          {files.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-image-fill"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select images to compile to PDF</p>
                <p className="text-[14px] text-zinc-405 dark:text-zinc-550 mt-1">Upload multiple photos. You can drag and drop to reorder pages.</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
              >
                Choose Image Files
              </button>
            </div>
          )}

          {files.length > 0 && !outputUrl && (
            <div className="space-y-6">
              
              {/* Configuration Panel */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                    Page Orientation
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e: any) => setPageSize(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer font-bold"
                  >
                    <option value="fit">Fit Image Dimensions (Best)</option>
                    <option value="a4_portrait">A4 Portrait</option>
                    <option value="a4_landscape">A4 Landscape</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                    Page Margin Size
                  </label>
                  <select
                    value={margin}
                    onChange={(e: any) => setMargin(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer font-bold"
                  >
                    <option value="none">No Margin (Fit)</option>
                    <option value="small">Small Margin (20px)</option>
                    <option value="big">Big Margin (40px)</option>
                  </select>
                </div>
              </div>

              {/* Uploaded items drag drop queue grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  <span>Selected Photos ({files.length}) - Drag to Sort</span>
                  <button onClick={() => setFiles([])} className="text-red-655 hover:underline cursor-pointer font-bold text-red-600">
                    Wipe Queue
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {files.map((item, index) => {
                    const isDragged = draggedIndex === index;
                    const isDragTarget = dragOverIndex === index;

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`bg-white dark:bg-zinc-900 border rounded-2xl p-2.5 flex flex-col items-center gap-2 relative transition-all duration-150 cursor-grab active:cursor-grabbing group shadow-xs ${
                          isDragged ? "opacity-35 scale-95 border-zinc-300 dark:border-zinc-700" : ""
                        } ${
                          isDragTarget && !isDragged
                            ? "border-dashed border-blue-500 scale-105 bg-blue-500/5"
                            : "border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        <span className="absolute top-2 left-2 bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold px-2 py-0.5 rounded text-zinc-650 dark:text-zinc-400 z-10">
                          {index + 1}
                        </span>

                        <button
                          onClick={() => removeImage(item.id)}
                          className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900/60 text-red-655 dark:text-red-400 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer z-10 text-red-600"
                        >
                          <i className="ri-delete-bin-line text-xs"></i>
                        </button>

                        <div className="w-full h-28 rounded-lg overflow-hidden border border-zinc-100 dark:border-zinc-800 mt-5 flex items-center justify-center bg-zinc-50 dark:bg-zinc-955 pointer-events-none">
                          <img src={item.dataUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                        </div>

                        <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-bold truncate w-full text-center mt-1">
                          {item.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Trigger Buttons */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold rounded-xl text-xs border border-zinc-300 dark:border-zinc-700 transition cursor-pointer"
                >
                  + Add Images
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
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
                      <i className="ri-file-pdf-line"></i> Generate PDF File
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
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Images Compiled Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Your PDF document is ready. Secure share or download below.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download="Images_Converted.pdf"
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
                  setFiles([]);
                }}
                className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto"
              >
                Convert More Images
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
              <span className="bg-zinc-100 dark:bg-zinc-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded text-zinc-555">AD</span>
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
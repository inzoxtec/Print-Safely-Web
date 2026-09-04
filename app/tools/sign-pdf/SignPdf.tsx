// app/tools/sign-pdf/SignPdf.tsx
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

type SignatureMode = "type" | "draw" | "upload";

interface PageImage {
  url: string;
  w: number;
  h: number;
  originalIndex: number;
}

interface SignatureOverlay {
  pageIndex: number;
  x: number; // percentage from left (0 to 100)
  y: number; // percentage from top (0 to 100)
  width: number; // CSS pixels
  height: number; // CSS pixels
}

const SIGN_FONTS = [
  { name: "Caveat", family: "'Caveat', cursive" },
  { name: "Alex Brush", family: "'Alex Brush', cursive" },
  { name: "Great Vibes", family: "'Great Vibes', cursive" },
  { name: "Sacramento", family: "'Sacramento', cursive" },
  { name: "Pacifico", family: "'Pacifico', cursive" },
];

export default function SignPdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  // Modal & Workspace UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoom, setZoom] = useState(85); // Dynamic default zoom
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Signature Creation State
  const [sigMode, setSigMode] = useState<SignatureMode>("type");
  const [typedName, setTypedName] = useState("");
  const [selectedFont, setSelectedFont] = useState(SIGN_FONTS[0]);
  const [drawColor, setDrawColor] = useState("#000000");
  const [brushWidth, setBrushWidth] = useState(3);
  const [uploadedSigUrl, setUploadedSigUrl] = useState<string | null>(null);
  
  // Placed Signature State
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<SignatureOverlay | null>(null);

  // Action states
  const [converting, setConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [pdfPageImages, setPdfPageImages] = useState<PageImage[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadSigInputRef = useRef<HTMLInputElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const isDrawing = useRef(false);

  // Load Google Fonts dynamically
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Alex+Brush&family=Caveat:wght@700&family=Great+Vibes&family=Pacifico&family=Sacramento&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Sync plan status from Firestore
  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setTypedName(userData.name || user.displayName || "");
            const activePlans = ["premium", "starter", "pro", "advanced"];
            if (activePlans.includes(userData.plan)) {
              setIsPremium(true);
            }
          }
        } catch (err) {
          console.warn(err);
        }
      };
      fetchUserData();
    }
  }, [user]);

  // Bind Shortcuts (Esc for Fullscreen exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Loader for PDFJS script
  const loadPdfjs = async () => {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/vendor/pdfjs-3.4.120/pdf.min.js";
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs-3.4.120/pdf.worker.min.js";
        resolve(pdfjs);
      };
      script.onerror = () => reject(new Error("Failed to load PDFJS"));
      document.head.appendChild(script);
    });
  };

  // Handle PDF Pre-rendering
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      alert("Please upload a valid PDF document.");
      return;
    }

    setFile(selectedFile);
    setOutputUrl(null);
    setOutputBlob(null);
    setPdfPageImages([]);
    setOverlay(null);
    setSignatureImage(null);
    setActivePageIndex(0);

    // Set starting zoom dynamically based on screens
    const screenW = window.innerWidth;
    if (screenW < 768) {
      setZoom(50);
    } else if (screenW < 1024) {
      setZoom(70);
    } else {
      setZoom(85);
    }

    setConverting(true);
    setProgressMsg("Loading PDF engine...");
    try {
      const activePdfJs = await loadPdfjs();
      setProgressMsg("Rendering document pages...");
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = activePdfJs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const pagesCount = pdf.numPages;
      const pagesData: PageImage[] = [];

      for (let i = 1; i <= pagesCount; i++) {
        const page = await pdf.getPage(i);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          pagesData.push({
            url: canvas.toDataURL("image/png"),
            w: viewport.width,
            h: viewport.height,
            originalIndex: i - 1
          });
        }
      }
      setPdfPageImages(pagesData);
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Failed to render PDF pages.");
    } finally {
      setConverting(false);
    }
  };

  // Canvas drawing controls
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawing.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ("touches" in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = brushWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ("touches" in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedSigUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const trimCanvas = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas.toDataURL("image/png");

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alphaIndex = (y * width + x) * 4 + 3;
        const alpha = data[alphaIndex];
        if (alpha > 0) {
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) return canvas.toDataURL("image/png");

    const padding = 8;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(width - cropX, maxX - minX + padding * 2);
    const cropH = Math.min(height - cropY, maxY - minY + padding * 2);

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    
    if (cropCtx) {
      cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      return cropCanvas.toDataURL("image/png");
    }

    return canvas.toDataURL("image/png");
  };

  const generateSignatureDataUrl = (): string | null => {
    if (sigMode === "type") {
      if (!typedName.trim()) return null;
      
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.font = `italic 72px ${selectedFont.name}`;
        const metrics = tempCtx.measureText(typedName);
        const textWidth = Math.ceil(metrics.width);
        
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = Math.max(120, textWidth + 30);
        finalCanvas.height = 110;
        
        const ctx = finalCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = drawColor;
          ctx.font = `italic 72px ${selectedFont.name}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(typedName, finalCanvas.width / 2, finalCanvas.height / 2);
          return finalCanvas.toDataURL("image/png");
        }
      }
    } else if (sigMode === "draw") {
      const canvas = drawCanvasRef.current;
      if (canvas) {
        return trimCanvas(canvas);
      }
    } else if (sigMode === "upload") {
      return uploadedSigUrl;
    }
    return null;
  };

  const handleSaveSignature = () => {
    const sigUrl = generateSignatureDataUrl();
    if (!sigUrl) {
      alert("Please design or draw your signature first.");
      return;
    }
    setSignatureImage(sigUrl);
    setIsModalOpen(false);

    setOverlay({
      pageIndex: activePageIndex,
      x: 35,
      y: 40,
      width: 180,
      height: 70
    });
  };

  const handlePageClickPlacement = (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!signatureImage) return;
    const target = e.target as HTMLElement;
    if (target.closest(".signature-draggable-overlay")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = (clickX / rect.width) * 100;
    const percentY = (clickY / rect.height) * 100;

    setOverlay({
      pageIndex,
      x: Math.max(0, Math.min(percentX - 15, 85)),
      y: Math.max(0, Math.min(percentY - 5, 95)),
      width: overlay?.width || 180,
      height: overlay?.height || 70
    });
  };

  const handleDragOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlay) return;
    const container = document.getElementById(`pdf-page-container-${overlay.pageIndex}`);
    if (!container) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = (overlay.x / 100) * container.clientWidth;
    const startTop = (overlay.y / 100) * container.clientHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;

      newLeft = Math.max(0, Math.min(newLeft, container.clientWidth - overlay.width * (zoom / 100)));
      newTop = Math.max(0, Math.min(newTop, container.clientHeight - overlay.height * (zoom / 100)));

      setOverlay(prev => prev ? {
        ...prev,
        x: (newLeft / container.clientWidth) * 100,
        y: (newTop / container.clientHeight) * 100
      } : null);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!overlay) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = overlay.width;
    const startHeight = overlay.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newWidth = Math.max(50, Math.min(400, startWidth + deltaX / (zoom / 100)));
      const newHeight = Math.max(20, Math.min(200, startHeight + deltaY / (zoom / 100)));

      setOverlay(prev => prev ? {
        ...prev,
        width: newWidth,
        height: newHeight
      } : null);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

   const handleApplySignature = async () => {
    if (!file || !signatureImage || !overlay) {
      alert("Missing file, signature, or placement overlay.");
      return;
    }

    // 1. Read container dimensions IMMEDIATELY while the elements are still mounted on screen
    const container = document.getElementById(`pdf-page-container-${overlay.pageIndex}`);
    if (!container) {
      alert(`Workspace layout container for page ${overlay.pageIndex + 1} was not resolved in the DOM.`);
      return;
    }
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // 2. Now safely activate loading overlay (unmounting the workspace layout)
    setConverting(true);
    setProgressMsg("Positioning signature coordinates...");

    try {
      const { PDFDocument } = await import("pdf-lib");
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      
      if (overlay.pageIndex >= pages.length) {
        throw new Error(`Target page index ${overlay.pageIndex} exceeds document bounds.`);
      }
      
      const targetPage = pages[overlay.pageIndex];
      const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();

      const scaleX = pdfWidth / containerWidth;
      const scaleY = pdfHeight / containerHeight;

      const overlayXpx = (overlay.x / 100) * containerWidth;
      const overlayYpx = (overlay.y / 100) * containerHeight;

      // Project translation coordinates (Note PDF y-axis is inverted: starts bottom-left)
      const pdfX = overlayXpx * scaleX;
      const pdfY = (containerHeight - overlayYpx - overlay.height) * scaleY;
      const signatureWidth = overlay.width * scaleX;
      const signatureHeight = overlay.height * scaleY;

      setProgressMsg("Embedding signature transparent layer...");
      const base64Parts = signatureImage.split(",");
      const byteString = atob(base64Parts[1]);
      const pngBytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        pngBytes[i] = byteString.charCodeAt(i);
      }

      const embeddedImage = await pdfDoc.embedPng(pngBytes);

      // Stamp image onto PDF page
      targetPage.drawImage(embeddedImage, {
        x: pdfX,
        y: pdfY,
        width: signatureWidth,
        height: signatureHeight
      });

      setProgressMsg("Saving signed document...");
      const pdfBytesOutput = await pdfDoc.save();

      const pdfBlobOutput = new Blob([pdfBytesOutput] as any, { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlobOutput);

      setOutputBlob(pdfBlobOutput);
      setOutputUrl(url);
    } catch (err: any) {
      console.error(err);
      alert("Failed to apply signature: " + (err.message || err));
    } finally {
      setConverting(false);
      setProgressMsg("");
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    const name = `Signed_${file?.name}`;
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
      alert("Failed to queue file database write locally.");
    }
  };

  return (
    <div className={`min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300 ${
      !isPremium ? "pb-16 lg:pb-0" : ""
    }`}>
      {!isFullscreen && <Header />}

      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[100vw] justify-center overflow-hidden">
        
        {/* LEFT COLUMN: Advertising */}
        {!isPremium && !isFullscreen && (
          <aside className="hidden md:flex w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
            <div className="sticky top-20 w-full h-[550px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between items-center p-4">
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Advertisement</span>
              <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
                <i className="ri-vip-crown-line text-amber-500 text-xl"></i>
                <p className="font-bold">Upgrade to Premium</p>
                <p className="text-[12px] leading-relaxed">Remove ads and unlock pro features.</p>
                <Link href="/pricing" className="text-[12px] text-blue-500 hover:underline block pt-2 font-bold">
                  View Plans &rarr;
                </Link>
              </div>
            </div>
          </aside>
        )}

        {/* CENTER MAIN WORKSPACE */}
        <main className={`flex-1 max-w-4xl p-6 md:p-8 overflow-auto space-y-6 flex flex-col items-center justify-start ${
          isFullscreen 
            ? "fixed inset-0 z-50 bg-zinc-50 dark:bg-zinc-950 h-screen max-w-full" 
            : ""
        }`}>
          {!isFullscreen && (
            <BreadcrumbSchema
              items={[
                { name: "Home", url: "https://printsafely.app" },
                { name: "Tools", url: "https://printsafely.app#tools-catalog" },
                { name: "Sign PDF", url: "https://printsafely.app/tools/sign-pdf" },
              ]}
            />
          )}

          <div className="w-full space-y-2 text-left flex items-start justify-between">
            <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                  <i className="ri-quill-pen-line text-blue-600 dark:text-blue-500"></i> Sign PDF Document
                  
                  {file && (
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="ml-2.5 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-800 rounded-xl text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition shadow-sm text-white"
                      title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Workspace"}
                    >
                      <i className={isFullscreen ? "ri-fullscreen-exit-line" : "ri-fullscreen-line"}></i>
                      {isFullscreen ? "Exit" : "Fullscreen"}
                    </button>
                  )}
                </h1>
                <p className="text-sm text-zinc-700 dark:text-zinc-400">
                  Stamp signatures, initials, or handwriting onto PDF layouts offline in RAM. Keep documents 100% private.
                </p>
              </div>
            </div>
          </div>

          {/* PAGE THUMBNAILS HORIZONTAL SCROLL TIMELINE IN MAIN PANEL */}
          {file && pdfPageImages.length > 0 && !outputUrl && !converting && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Select Page to Sign</span>
                <span className="text-[10px] font-bold text-blue-500 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/35 rounded-full">
                  Total Pages: {pdfPageImages.length}
                </span>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                {pdfPageImages.map((page, idx) => {
                  const isActive = idx === activePageIndex;
                  return (
                    <div
                      key={idx}
                      onClick={() => { setActivePageIndex(idx); }}
                      className={`relative group flex-shrink-0 w-24 h-32 rounded-xl border p-2 cursor-pointer transition flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 ${
                        isActive 
                          ? "border-blue-500 ring-2 ring-blue-500/25 bg-blue-500/[0.02]" 
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-extrabold text-zinc-400 leading-none">
                        <span>PAGE {idx + 1}</span>
                      </div>
                      
                      <div className="flex-1 flex items-center justify-center p-1 overflow-hidden">
                        <img 
                          src={page.url} 
                          alt={`page-${idx}`} 
                          className="max-h-20 object-contain shadow-sm rounded border border-zinc-250/50 dark:border-zinc-800" 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!file && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-655 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-quill-pen-fill"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF document to sign</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-1">Upload a PDF to apply digital cursive signatures.</p>
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

          {converting && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-sm animate-in fade-in duration-200">
              <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Processing Document...</p>
                <p className="text-xs text-zinc-500 font-mono">{progressMsg}</p>
              </div>
            </div>
          )}

          {/* Interactive Annotation Workspace */}
          {file && pdfPageImages.length > 0 && !outputUrl && !converting && (
            <div className="w-full space-y-6 flex flex-col items-center">
              
              {/* Workspace Navigation & Zoom HUD Toolbar */}
              <div className="w-full flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="text-left max-w-xs">
                  <p className="text-xs font-bold truncate text-zinc-900 dark:text-white">{file.name}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{pdfPageImages.length} Pages</p>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoom(z => Math.max(50, z - 10))}
                    className="h-8 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-black cursor-pointer select-none"
                  >
                    A-
                  </button>
                  <span className="text-xs font-extrabold font-mono w-12 text-center select-none text-zinc-600">{zoom}%</span>
                  <button
                    onClick={() => setZoom(z => Math.min(150, z + 10))}
                    className="h-8 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-black cursor-pointer select-none"
                  >
                    A+
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold rounded-xl text-xs border border-zinc-200 dark:border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <i className="ri-edit-line"></i> Design Signature
                  </button>
                  
                  {signatureImage && overlay && (
                    <button
                      onClick={handleApplySignature}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5 animate-pulse"
                    >
                      <i className="ri-checkbox-circle-line"></i> Stamp PDF
                    </button>
                  )}
                </div>
              </div>

              {/* Applied Modifications (Layers) Badge Area */}
              {signatureImage && overlay && (
                <div className="w-full bg-zinc-100/60 dark:bg-zinc-900/40 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 flex flex-wrap items-center gap-2 text-left animate-in fade-in">
                  <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-555 uppercase tracking-wider mr-1 select-none">Applied Layers:</span>
                  
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-sm">
                    <i className="ri-quill-pen-line text-blue-500"></i>
                    <span>Signature Layer</span>
                    <span className="text-[9px] text-zinc-400 font-normal select-none">(Page {overlay.pageIndex + 1})</span>
                    <button
                      onClick={() => { setOverlay(null); setSignatureImage(null); }}
                      className="text-zinc-400 hover:text-red-500 transition cursor-pointer font-bold leading-none text-sm ml-0.5"
                      title="Remove Signature"
                    >
                      &times;
                    </button>
                  </span>
                </div>
              )}

              {/* Active PDF Page Container Area */}
              {(() => {
                const activePage = pdfPageImages[activePageIndex] || pdfPageImages[0];
                if (!activePage) return null;

                return (
                  <div className="w-full bg-zinc-100/50 dark:bg-zinc-950/20 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-auto h-[600px] max-h-[70vh]">
                    <div className="text-center mb-2">
                      <span className="text-[10px] block mb-2 font-bold text-zinc-400 uppercase tracking-wider select-none">
                        PAGE {activePageIndex + 1} OF {pdfPageImages.length}
                      </span>

                      <div
                        id={`pdf-page-container-${activePageIndex}`}
                        onClick={(e) => handlePageClickPlacement(activePageIndex, e)}
                        className="relative mx-auto bg-white border border-zinc-300 shadow-md select-none overflow-hidden cursor-crosshair"
                        style={{ 
                          width: `${560 * (zoom / 100)}px`,
                          height: `${(560 * (activePage.h / activePage.w)) * (zoom / 100)}px`
                        }}
                      >
                        {/* PDF Page image layer */}
                        <img
                          src={activePage.url}
                          alt={`Active Page ${activePageIndex}`}
                          className="absolute inset-0 w-full h-full pointer-events-none block"
                        />

                        {/* Active Signature Placement Overlay */}
                        {overlay && overlay.pageIndex === activePageIndex && signatureImage && (
                          <div
                            onMouseDown={handleDragOverlay}
                            className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 cursor-move flex items-center justify-center group signature-draggable-overlay animate-in zoom-in-95 duration-100 z-30"
                            style={{
                              left: `${overlay.x}%`,
                              top: `${overlay.y}%`,
                              width: `${overlay.width * (zoom / 100)}px`,
                              height: `${overlay.height * (zoom / 100)}px`
                            }}
                          >
                            <img
                              src={signatureImage}
                              alt="placed signature"
                              className="max-h-full max-w-full pointer-events-none object-contain p-1"
                            />

                            {/* Resizable corner handle */}
                            <div
                              onMouseDown={handleResizeOverlay}
                              className="absolute bottom-0 right-0 h-4 w-4 bg-blue-600 border border-white cursor-se-resize rounded-tl-md flex items-center justify-center shadow z-40"
                            >
                              <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 13v6m0 0h-6m6 0L13 13" />
                              </svg>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

          {/* Success Screen */}
          {outputUrl && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm animate-in fade-in duration-300">
              <div className="flex justify-center text-emerald-500 text-5xl">
                <i className="ri-checkbox-circle-fill text-emerald-500"></i>
              </div>
              <div className="space-y-1.5 text-center">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Document Signed Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">The signature has been permanently rendered onto the PDF.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`Signed_${file?.name}`}
                  className="w-full sm:w-auto px-5 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold rounded-xl text-xs border border-zinc-300 dark:border-zinc-700 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ri-download-2-line"></i> Download Signed PDF
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
                  setOverlay(null);
                  setSignatureImage(null);
                  setActivePageIndex(0);
                }}
                className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto font-bold"
              >
                Sign Another PDF
              </button>
            </div>
          )}
        </main>

        {/* RIGHT AD COLUMN (Shown always to preserve spacing layout) */}
        {!isPremium && !isFullscreen && (
          <aside className="flex w-full md:w-44 flex-shrink-0 p-4 dark:border-zinc-800 flex-col items-center justify-start bg-zinc-50/50 dark:bg-zinc-950/20">
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

      {/* ======================================================== */}
      {/* CENTRAL POPUP MODAL: SIGNATURE DESIGNER WORKSPACE PANEL   */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-150 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 w-full max-w-xl p-6 shadow-2xl flex flex-col gap-6 text-left animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-850 pb-3">
              <div className="flex items-center gap-2">
                <i className="ri-quill-pen-line text-blue-500 text-lg"></i>
                <h3 className="font-black text-zinc-900 dark:text-white text-base">Design Your Signature</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-650 dark:text-zinc-500 dark:hover:text-zinc-300 text-lg font-bold leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Mode Select Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl">
              {(["type", "draw", "upload"] as SignatureMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSigMode(mode)}
                  className={`py-2 text-xs font-bold uppercase rounded-lg transition capitalize cursor-pointer ${
                    sigMode === mode
                      ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Type Option */}
            {sigMode === "type" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Signature Name</label>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Enter name..."
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Choose Signature Font Style</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {SIGN_FONTS.map((font) => (
                      <div
                        key={font.name}
                        onClick={() => setSelectedFont(font)}
                        className={`p-3 rounded-xl border cursor-pointer transition text-center flex flex-col justify-center bg-zinc-50 dark:bg-zinc-950 ${
                          selectedFont.name === font.name
                            ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/25"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                        }`}
                      >
                        <span className="text-[10px] text-zinc-400 uppercase font-mono block text-left mb-1">{font.name}</span>
                        <p className="text-xl truncate text-zinc-900 dark:text-white" style={{ fontFamily: font.family }}>
                          {typedName || "Signature"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Draw Option */}
            {sigMode === "draw" && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Draw Signature Ink</label>
                  <button
                    onClick={clearCanvas}
                    className="text-[10px] font-bold text-red-500 hover:underline uppercase tracking-wider cursor-pointer"
                  >
                    Clear Slate
                  </button>
                </div>

                <div className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl h-44 overflow-hidden relative">
                  <canvas
                    ref={drawCanvasRef}
                    width={500}
                    height={176}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full bg-transparent cursor-crosshair block"
                  />
                  <div className="absolute bottom-2.5 left-3 text-[10px] font-bold text-zinc-400 tracking-wide pointer-events-none select-none">
                    Write signature here using mouse/trackpad
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Ink color selection */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ink Color:</span>
                    <div className="flex gap-1.5">
                      {["#000000", "#002fa7", "#a00000"].map((col) => (
                        <button
                          key={col}
                          onClick={() => setDrawColor(col)}
                          className={`h-5.5 w-5.5 rounded-full border border-white dark:border-zinc-900 cursor-pointer transition ${
                            drawColor === col ? "scale-110 ring-2 ring-blue-500/25" : ""
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Brush width Selection */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ink Thickness:</span>
                    <div className="flex gap-1 bg-zinc-150 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      {[2, 3, 4].map((widthVal) => (
                        <button
                          key={widthVal}
                          onClick={() => setBrushWidth(widthVal)}
                          className={`h-6 px-2 text-[10px] font-bold rounded cursor-pointer transition ${
                            brushWidth === widthVal
                              ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm"
                              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                          }`}
                        >
                          {widthVal}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Option */}
            {sigMode === "upload" && (
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Upload Signature Image file</label>
                <div
                  onClick={() => uploadSigInputRef.current?.click()}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
                >
                  <i className="ri-image-add-line text-2xl text-zinc-400"></i>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {uploadedSigUrl ? "Choose another signature image" : "Select PNG / JPEG signature image"}
                  </span>
                  <span className="text-[10px] text-zinc-400">(Transparent background recommended)</span>
                  <input
                    type="file"
                    ref={uploadSigInputRef}
                    accept="image/*"
                    onChange={handleSignatureUpload}
                    className="hidden"
                  />
                </div>

                {uploadedSigUrl && (
                  <div className="p-3 bg-zinc-100/50 dark:bg-zinc-950/20 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex justify-center items-center h-28 max-w-sm mx-auto overflow-hidden animate-in fade-in">
                    <img src={uploadedSigUrl} alt="uploaded signature preview" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 border-t border-zinc-150 dark:border-zinc-850 pt-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4.5 py-2 bg-zinc-100 hover:bg-zinc-250 dark:bg-zinc-800 dark:hover:bg-zinc-755 text-zinc-850 dark:text-zinc-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSignature}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
              >
                Insert Signature
              </button>
            </div>

          </div>
        </div>
      )}

      <ToolSeoSection
        title="Sign PDF Online Free - Fill & Sign PDFs Privately"
        subtitle="Create electronic signatures by drawing, typing cursive signatures, or uploading image signatures. 100% client-side privacy with no cloud uploads."
        steps={[
          { title: "Upload PDF", desc: "Select or drag your PDF file. Files process 100% locally in your browser memory." },
          { title: "Create Signature", desc: "Draw with mouse/touch, type your name in cursive fonts, or upload a signature PNG." },
          { title: "Place & Download", desc: "Position the signature stamp anywhere on your pages and download your signed PDF instantly." }
        ]}
        features={[
          { icon: "🔒", title: "100% Client-Side Privacy", desc: "Your files never leave your computer. Signing is processed completely inside your browser." },
          { icon: "✍️", title: "Multiple Signature Types", desc: "Draw with touch/mouse, type cursive signatures, or upload transparent PNG signature stamps." },
          { icon: "⚡", title: "Instant & Free", desc: "No registration required, no subscription paywalls, and no digital watermarks on your signed files." }
        ]}
        faqs={[
          { question: "Is it free to sign PDFs online with SafelyPrint?", answer: "Yes! SafelyPrint is 100% free with no hidden charges, trial limits, or document quotas." },
          { question: "Are my documents uploaded to a remote server?", answer: "No. Unlike other tools, SafelyPrint processes PDF signing entirely in your browser using local JavaScript. Your sensitive documents are never uploaded to any server." },
          { question: "Is an electronic signature created with SafelyPrint legally valid?", answer: "Yes. Electronic signatures added to PDFs are widely accepted for business agreements, receipts, non-disclosure agreements, and general forms." }
        ]}
      />
      <ToolSeoSchema
        name="Sign PDF Online Free"
        description="Sign PDF documents online entirely in your browser. Add electronic signatures by drawing, typing names with cursive fonts, or uploading images securely."
        url="https://printsafely.app/tools/sign-pdf"
        steps={[
          "Select or drag your PDF file into the secure signature canvas.",
          "Create your custom electronic signature by drawing, typing, or uploading an image.",
          "Position the signature on your PDF pages and download the signed document."
        ]}
        faqs={[
          { question: "Is it free to sign PDFs online with SafelyPrint?", answer: "Yes! SafelyPrint is 100% free with no hidden charges, trial limits, or document quotas." },
          { question: "Are my documents uploaded to a remote server?", answer: "No. Unlike other tools, SafelyPrint processes PDF signing entirely in your browser using local JavaScript. Your sensitive documents are never uploaded to any server." },
          { question: "Is an electronic signature created with SafelyPrint legally valid?", answer: "Yes. Electronic signatures added to PDFs are widely accepted for business agreements, receipts, non-disclosure agreements, and general forms." }
        ]}
      />
      <Footer />
    </div>
  );
}
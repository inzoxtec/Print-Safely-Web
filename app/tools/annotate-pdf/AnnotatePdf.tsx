// app/tools/annotate-pdf/AnnotatePdf.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import BreadcrumbSchema from "@/app/components/BreadcrumbSchema";

type AnnotationTool = "select" | "pen" | "highlight" | "text" | "eraser";

interface PageImage {
  url: string;
  w: number;
  h: number;
  originalIndex: number;
}

interface TextAnnotation {
  id: string;
  pageIndex: number;
  text: string;
  color: string;
  bgColor: string;
  x: number; // percentage from left
  y: number; // percentage from top
}

interface HistoryItem {
  type: "draw" | "text_add" | "text_delete" | "text_drag";
  pageIndex: number;
  canvasState?: string; // canvas DataURL before action
  textAnnotId?: string;
  textAnnot?: TextAnnotation;
  dragBeforeCoords?: { x: number; y: number };
}

export default function AnnotatePdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  // Layout & Workspace States
  const [activeTool, setActiveTool] = useState<AnnotationTool>("select");
  const [strokeColor, setStrokeColor] = useState("#002fa7"); // default royal blue
  const [brushWidth, setBrushWidth] = useState(4);
  const [zoom, setZoom] = useState(85); // Dynamic default zoom
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Text Annotations States
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textVal, setTextVal] = useState("");
  const [textColor, setTextColor] = useState("#000000");
  const [textBgColor, setTextBgColor] = useState("rgba(254, 240, 138, 0.9)"); // Light sticky yellow
  const [pendingTextCoords, setPendingTextCoords] = useState<{ pageIndex: number; x: number; y: number } | null>(null);

  // Drawing states mapped by page index
  const [canvasDrawings, setCanvasDrawings] = useState<{ [pageIndex: number]: string }>({});

  // History & Undo States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const canvasSnapshotBeforeStroke = useRef<string | null>(null);
  const dragSnapshot = useRef<{ x: number; y: number } | null>(null);

  // Action states
  const [converting, setConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [pdfPageImages, setPdfPageImages] = useState<PageImage[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const isDrawing = useRef(false);

  // Sync plan status from Firestore
  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
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
      fetchUserData();
    }
  }, [user]);

  // Bind shortcuts (Ctrl+Z & Escape for Fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [history, textAnnotations]);

  // Restore canvas drawings when active page index changes
  useEffect(() => {
    if (!file || pdfPageImages.length === 0) return;
    const canvas = canvasRefs.current[activePageIndex];
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const savedState = canvasDrawings[activePageIndex];
        if (savedState) {
          const img = new Image();
          img.src = savedState;
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
        }
      }
    }
  }, [activePageIndex, file, pdfPageImages]);

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

  // Pre-render PDF pages
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
    setTextAnnotations([]);
    setHistory([]);
    setCanvasDrawings({});
    setActivePageIndex(0);
    setSelectedElementId(null);
    canvasRefs.current = [];

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
    } catch (err) {
      console.error(err);
      alert("Failed to render PDF pages.");
    } finally {
      setConverting(false);
    }
  };

  // Drawing mouse handlers
  const startDrawing = (pageIndex: number, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRefs.current[pageIndex];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = ("touches" in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const clientY = ("touches" in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    if (activeTool === "text") {
      const pctX = (clientX / rect.width) * 100;
      const pctY = (clientY / rect.height) * 100;
      setPendingTextCoords({ pageIndex, x: pctX, y: pctY });
      setTextVal("");
      setIsTextModalOpen(true);
      return;
    }

    canvasSnapshotBeforeStroke.current = canvas.toDataURL("image/png");

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = clientX * scaleX;
    const canvasY = clientY * scaleY;

    isDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(canvasX, canvasY);

    if (activeTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = brushWidth * 5;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = brushWidth;
      ctx.strokeStyle = strokeColor;
      if (activeTool === "highlight") {
        ctx.lineWidth = brushWidth * 3.5;
        ctx.strokeStyle = strokeColor + "55";
      }
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (pageIndex: number, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || activeTool === "text" || activeTool === "select") return;
    const canvas = canvasRefs.current[pageIndex];
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ("touches" in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.lineTo(x * scaleX, y * scaleY);
    ctx.stroke();
  };

  const stopDrawing = (pageIndex: number) => {
    const canvas = canvasRefs.current[pageIndex];
    if (isDrawing.current && canvas && canvasSnapshotBeforeStroke.current) {
      const dataUrl = canvas.toDataURL("image/png");
      setCanvasDrawings(prev => ({
        ...prev,
        [pageIndex]: dataUrl
      }));

      setHistory(prev => [
        ...prev,
        {
          type: "draw",
          pageIndex,
          canvasState: canvasSnapshotBeforeStroke.current as string
        }
      ]);
    }
    isDrawing.current = false;
    canvasSnapshotBeforeStroke.current = null;
  };

  const clearPageAnnotations = (pageIndex: number) => {
    const canvas = canvasRefs.current[pageIndex];
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      const preClearState = canvas.toDataURL("image/png");
      setHistory(prev => [
        ...prev,
        {
          type: "draw",
          pageIndex,
          canvasState: preClearState
        }
      ]);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      setCanvasDrawings(prev => {
        const copy = { ...prev };
        delete copy[pageIndex];
        return copy;
      });
    }

    const pageTexts = textAnnotations.filter(t => t.pageIndex === pageIndex);
    if (pageTexts.length > 0) {
      pageTexts.forEach(t => {
        setHistory(prev => [
          ...prev,
          {
            type: "text_delete",
            pageIndex,
            textAnnot: t
          }
        ]);
      });
      setTextAnnotations(prev => prev.filter(t => t.pageIndex !== pageIndex));
    }
  };

  // Add Comment from Modal
  const handleSaveTextAnnotation = () => {
    if (!textVal.trim() || !pendingTextCoords) return;

    const newAnnotation: TextAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      pageIndex: pendingTextCoords.pageIndex,
      text: textVal,
      color: textColor,
      bgColor: textBgColor,
      x: pendingTextCoords.x,
      y: pendingTextCoords.y,
    };

    setTextAnnotations(prev => [...prev, newAnnotation]);
    
    setHistory(prev => [
      ...prev,
      {
        type: "text_add",
        pageIndex: pendingTextCoords.pageIndex,
        textAnnotId: newAnnotation.id
      }
    ]);

    setSelectedElementId(newAnnotation.id);
    setActiveTool("select"); // Auto switch to selector mode
    setIsTextModalOpen(false);
    setPendingTextCoords(null);
  };

  // Drag handlers for text annotations
  const handleDragStart = (id: string) => {
    const target = textAnnotations.find(t => t.id === id);
    if (target) {
      dragSnapshot.current = { x: target.x, y: target.y };
    }
  };

  const handleDragText = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    const target = textAnnotations.find(t => t.id === id);
    if (!target) return;
    
    setSelectedElementId(id);
    dragSnapshot.current = { x: target.x, y: target.y };

    const container = document.getElementById(`pdf-page-container-${target.pageIndex}`);
    if (!container) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = (target.x / 100) * container.clientWidth;
    const startTop = (target.y / 100) * container.clientHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;

      newLeft = Math.max(0, Math.min(newLeft, container.clientWidth - 40));
      newTop = Math.max(0, Math.min(newTop, container.clientHeight - 20));

      setTextAnnotations(prev => prev.map(t => t.id === id ? {
        ...t,
        x: (newLeft / container.clientWidth) * 100,
        y: (newTop / container.clientHeight) * 100
      } : t));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const snapshot = dragSnapshot.current;
      if (snapshot) {
        setTextAnnotations(prev => {
          const finalTarget = prev.find(t => t.id === id);
          if (finalTarget && (finalTarget.x !== snapshot.x || finalTarget.y !== snapshot.y)) {
            setHistory(h => [
              ...h,
              {
                type: "text_drag",
                pageIndex: finalTarget.pageIndex,
                textAnnotId: id,
                dragBeforeCoords: snapshot
              }
            ]);
          }
          return prev;
        });
      }
      dragSnapshot.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const removeTextAnnotation = (id: string) => {
    const target = textAnnotations.find(t => t.id === id);
    if (target) {
      setHistory(prev => [
        ...prev,
        {
          type: "text_delete",
          pageIndex: target.pageIndex,
          textAnnot: target
        }
      ]);
      setTextAnnotations(prev => prev.filter(t => t.id !== id));
      setSelectedElementId(null);
    }
  };

  // Undo engine
  const handleUndo = () => {
    if (history.length === 0) return;
    
    const lastAction = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    if (lastAction.type === "draw") {
      const canvas = canvasRefs.current[lastAction.pageIndex];
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx && lastAction.canvasState) {
        const img = new Image();
        img.src = lastAction.canvasState;
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          setCanvasDrawings(prev => ({
            ...prev,
            [lastAction.pageIndex]: canvas.toDataURL("image/png")
          }));
        };
      }
    } else if (lastAction.type === "text_add") {
      setTextAnnotations(prev => prev.filter(t => t.id !== lastAction.textAnnotId));
    } else if (lastAction.type === "text_delete" && lastAction.textAnnot) {
      setTextAnnotations(prev => [...prev, lastAction.textAnnot as TextAnnotation]);
    } else if (lastAction.type === "text_drag" && lastAction.dragBeforeCoords) {
      setTextAnnotations(prev => prev.map(t => t.id === lastAction.textAnnotId ? {
        ...t,
        x: (lastAction.dragBeforeCoords as { x: number; y: number }).x,
        y: (lastAction.dragBeforeCoords as { x: number; y: number }).y
      } : t));
    }
  };

  // Merge Canvases + Draggable Text layers onto original PDF pages
  const handleApplyAnnotations = async () => {
    if (!file || pdfPageImages.length === 0) return;

    // 1. Capture Page Layout Dimensions immediately before starting conversion
    const pageDimensions = pdfPageImages.map((_, idx) => {
      const container = document.getElementById(`pdf-page-container-${idx}`);
      return {
        clientWidth: container?.clientWidth || 560,
        clientHeight: container?.clientHeight || 700,
      };
    });

    setConverting(true);
    setProgressMsg("Merging annotations onto pages...");

    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // A. Merge freehand drawing canvases (Pen & Highlighter)
      for (let i = 0; i < pdfPageImages.length; i++) {
        const savedDrawing = canvasDrawings[i];
        if (savedDrawing && i < pages.length) {
          const targetPage = pages[i];
          const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();

          const base64Parts = savedDrawing.split(",");
          const byteString = atob(base64Parts[1]);
          const pngBytes = new Uint8Array(byteString.length);
          for (let j = 0; j < byteString.length; j++) {
            pngBytes[j] = byteString.charCodeAt(j);
          }

          const embeddedCanvas = await pdfDoc.embedPng(pngBytes);
          targetPage.drawImage(embeddedCanvas, {
            x: 0,
            y: 0,
            width: pdfWidth,
            height: pdfHeight,
          });
        }
      }

      // B. Merge text comments natively using Vector PDF Text parameters
      const parseColor = (colorStr: string) => {
        try {
          if (colorStr.startsWith("#")) {
            const r = parseInt(colorStr.slice(1, 3), 16) / 255;
            const g = parseInt(colorStr.slice(3, 5), 16) / 255;
            const b = parseInt(colorStr.slice(5, 7), 16) / 255;
            return rgb(r, g, b);
          }
          if (colorStr.startsWith("rgba") || colorStr.startsWith("rgb")) {
            const matches = colorStr.match(/\d+/g);
            if (matches && matches.length >= 3) {
              return rgb(
                parseInt(matches[0]) / 255,
                parseInt(matches[1]) / 255,
                parseInt(matches[2]) / 255
              );
            }
          }
        } catch (e) {
          console.warn("Failed to parse color:", colorStr, e);
        }
        return rgb(0, 0, 0);
      };

      for (const annot of textAnnotations) {
        if (annot.pageIndex >= pages.length) continue;
        const targetPage = pages[annot.pageIndex];
        const dims = pageDimensions[annot.pageIndex];
        const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();

        const scaleX = pdfWidth / dims.clientWidth;
        const scaleY = pdfHeight / dims.clientHeight;

        const overlayXpx = (annot.x / 100) * dims.clientWidth;
        const overlayYpx = (annot.y / 100) * dims.clientHeight;

        const pdfX = overlayXpx * scaleX;
        
        // Helvetica standard dimensions metrics
        const textSize = 11; 
        const textWidth = font.widthOfTextAtSize(annot.text, textSize);
        const textHeight = font.heightAtSize(textSize);

        // PDF coordinate systems place origin (0,0) at the bottom-left corner
        const pdfY = (dims.clientHeight - overlayYpx) * scaleY - (textHeight * scaleY);

        // Draw background container badge if color is not transparent
        if (annot.bgColor !== "transparent") {
          const bgRGB = parseColor(annot.bgColor);
          const paddingX = 6;
          const paddingY = 4;
          targetPage.drawRectangle({
            x: pdfX - paddingX * scaleX,
            y: pdfY - paddingY * scaleY,
            width: textWidth + (paddingX * 2) * scaleX,
            height: (textHeight + paddingY * 2) * scaleY,
            color: bgRGB,
          });
        }

        // Draw comment text layer
        const textRGB = parseColor(annot.color);
        targetPage.drawText(annot.text, {
          x: pdfX,
          y: pdfY,
          size: textSize,
          font: font,
          color: textRGB,
        });
      }

      setProgressMsg("Saving annotated PDF...");
      const pdfBytesOutput = await pdfDoc.save();

      const pdfBlobOutput = new Blob([pdfBytesOutput] as any, { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlobOutput);

      setOutputBlob(pdfBlobOutput);
      setOutputUrl(url);
    } catch (err: any) {
      console.error(err);
      alert("Failed to compile annotations: " + (err.message || err));
    } finally {
      setConverting(false);
      setProgressMsg("");
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    const name = `Annotated_${file?.name}`;
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
              <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-555 tracking-wider">Advertisement</span>
              <div className="text-center text-xs text-zinc-555 dark:text-zinc-400 space-y-2">
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
                { name: "Annotate PDF", url: "https://printsafely.app/tools/annotate-pdf" },
              ]}
            />
          )}

          <div className="w-full space-y-2 text-left flex items-start justify-between">
            <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                  <i className="ri-markup-line text-blue-600 dark:text-blue-500"></i> Annotate PDF Document
                  
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
                  Draw shapes, highlight text, and add comments directly onto your PDF layouts offline in RAM.
                </p>
              </div>
            </div>
          </div>

          {/* PAGE THUMBNAILS HORIZONTAL SCROLL TIMELINE IN MAIN PANEL */}
          {file && pdfPageImages.length > 0 && !outputUrl && !converting && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Select Page to Annotate</span>
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
                      onClick={() => { setActivePageIndex(idx); setSelectedElementId(null); }}
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
                <i className="ri-markup-fill"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF document to annotate</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-1">Upload a PDF to draw vectors or insert text notes.</p>
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
              
              {/* Toolbar HUD Control Panel */}
              <div className="w-full flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-in fade-in">
                
                {/* Tool Selection Tabs */}
                <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl">
                  {[
                    { id: "select", icon: "ri-drag-move-2-line", label: "Select & Move" },
                    { id: "pen", icon: "ri-pencil-line", label: "Pen" },
                    { id: "highlight", icon: "ri-mark-pen-line", label: "Highlight" },
                    { id: "text", icon: "ri-text", label: "Add Comment" },
                    { id: "eraser", icon: "ri-eraser-line", label: "Eraser" },
                  ].map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => { setActiveTool(tool.id as AnnotationTool); setSelectedElementId(null); }}
                      title={tool.label}
                      className={`h-8 px-2.5 rounded-lg flex items-center justify-center transition cursor-pointer text-sm font-bold gap-1 ${
                        activeTool === tool.id
                          ? "bg-white dark:bg-zinc-850 text-blue-700 shadow-sm"
                          : "text-zinc-700 hover:text-zinc-850 dark:hover:text-zinc-250 dark:text-zinc-200"
                      }`}
                    >
                      <i className={tool.icon}></i>
                    </button>
                  ))}
                </div>

                {/* Undo Button */}
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  title="Undo Action (Ctrl+Z)"
                  className="h-8 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 text-zinc-500 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition"
                >
                  <i className="ri-arrow-go-back-line"></i>
                  <span className="text-[10px] font-bold">Undo</span>
                </button>

                {/* Stroke Colors Selectors (for Pen/Highlight) */}
                {activeTool !== "eraser" && activeTool !== "text" && activeTool !== "select" && (
                  <div className="flex gap-2 animate-in slide-in-from-left duration-150">
                    {[
                      { val: "#000000", label: "Black" },
                      { val: "#002fa7", label: "Blue" },
                      { val: "#a00000", label: "Red" },
                      { val: "#008000", label: "Green" },
                      { val: "#ffd700", label: "Yellow" },
                    ].map((col) => (
                      <button
                        key={col.val}
                        onClick={() => setStrokeColor(col.val)}
                        title={col.label}
                        className={`h-5 w-5 rounded-full border border-white dark:border-zinc-900 cursor-pointer transition ${
                          strokeColor === col.val ? "scale-125 ring-2 ring-blue-500/30" : ""
                        }`}
                        style={{ backgroundColor: col.val }}
                      />
                    ))}
                  </div>
                )}

                {/* Brush Size Slider */}
                {activeTool !== "text" && activeTool !== "select" && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Size:</span>
                    <input
                      type="range"
                      min="2"
                      max="14"
                      value={brushWidth}
                      onChange={(e) => setBrushWidth(parseInt(e.target.value))}
                      className="w-16 h-1 appearance-none bg-zinc-250 dark:bg-zinc-800 rounded-lg cursor-pointer accent-blue-600"
                    />
                    <span className="text-[10px] font-mono w-5">{brushWidth}px</span>
                  </div>
                )}

                {/* Zoom Control Panel HUD */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoom(z => Math.max(50, z - 10))}
                    className="h-8 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold cursor-pointer select-none"
                  >
                    A-
                  </button>
                  <span className="text-[10px] font-bold text-zinc-400 w-10 text-center select-none font-mono">{zoom}%</span>
                  <button
                    onClick={() => setZoom(z => Math.min(150, z + 10))}
                    className="h-8 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold cursor-pointer select-none"
                  >
                    A+
                  </button>
                </div>

                {/* Stamp Action Trigger */}
                <button
                  onClick={handleApplyAnnotations}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <i className="ri-checkbox-circle-line"></i> Apply Annotations
                </button>

              </div>

              {/* Applied Modifications (Layers) Badge Area */}
              {(textAnnotations.length > 0 || Object.keys(canvasDrawings).length > 0) && (
                <div className="w-full bg-zinc-100/60 dark:bg-zinc-900/40 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 flex flex-wrap items-center gap-2 text-left animate-in fade-in">
                  <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-555 uppercase tracking-wider mr-1 select-none">Applied Layers:</span>
                  
                  {/* Text Comments */}
                  {textAnnotations.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-sm"
                    >
                      <i className="ri-text text-blue-500"></i>
                      <span className="truncate max-w-[120px]">Comment: "{t.text}"</span>
                      <span className="text-[9px] text-zinc-400 font-normal select-none">(Page {t.pageIndex + 1})</span>
                      <button
                        onClick={() => removeTextAnnotation(t.id)}
                        className="text-zinc-400 hover:text-red-500 transition cursor-pointer font-bold leading-none text-sm ml-0.5"
                        title="Remove Comment"
                      >
                        &times;
                      </button>
                    </span>
                  ))}

                  {/* Drawings */}
                  {Object.entries(canvasDrawings).map(([pageIdxStr, dataUrl]) => {
                    if (!dataUrl) return null;
                    const pageIdx = parseInt(pageIdxStr);
                    return (
                      <span
                        key={`drawing-${pageIdx}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-sm"
                      >
                        <i className="ri-pencil-line text-purple-500"></i>
                        <span>Page Drawing</span>
                        <span className="text-[9px] text-zinc-400 font-normal select-none">(Page {pageIdx + 1})</span>
                        <button
                          onClick={() => {
                            setCanvasDrawings(prev => {
                              const copy = { ...prev };
                              delete copy[pageIdx];
                              return copy;
                            });
                            if (pageIdx === activePageIndex) {
                              const canvas = canvasRefs.current[pageIdx];
                              const ctx = canvas?.getContext("2d");
                              if (canvas && ctx) {
                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                              }
                            }
                          }}
                          className="text-zinc-400 hover:text-red-500 transition cursor-pointer font-bold leading-none text-sm ml-0.5"
                          title="Remove Drawing"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Active PDF Page Container Area */}
              {(() => {
                const activePage = pdfPageImages[activePageIndex] || pdfPageImages[0];
                if (!activePage) return null;

                return (
                  <div className="w-full bg-zinc-100/50 dark:bg-zinc-950/20 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-auto h-[600px] max-h-[70vh]">
                    <div className="text-center mb-2">
                      <div className="w-full flex items-center justify-between px-1 gap-8 mb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none">
                          PAGE {activePageIndex + 1} OF {pdfPageImages.length}
                        </span>
                        <button
                          onClick={() => clearPageAnnotations(activePageIndex)}
                          className="text-[9px] text-red-500 hover:underline font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Reset Page
                        </button>
                      </div>

                      <div
                        id={`pdf-page-container-${activePageIndex}`}
                        className="relative mx-auto bg-white border border-zinc-300 shadow-md select-none overflow-hidden"
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

                        {/* Pen / Highlighter Drawing Canvas Layer */}
                        <canvas
                          ref={(el) => { canvasRefs.current[activePageIndex] = el; }}
                          width={activePage.w}
                          height={activePage.h}
                          onMouseDown={(e) => startDrawing(activePageIndex, e)}
                          onMouseMove={(e) => draw(activePageIndex, e)}
                          onMouseUp={() => stopDrawing(activePageIndex)}
                          onMouseLeave={() => stopDrawing(activePageIndex)}
                          onTouchStart={(e) => startDrawing(activePageIndex, e)}
                          onTouchMove={(e) => draw(activePageIndex, e)}
                          onTouchEnd={() => stopDrawing(activePageIndex)}
                          className={`absolute inset-0 w-full h-full bg-transparent ${
                            activeTool === "pen" || activeTool === "highlight" || activeTool === "eraser"
                              ? "z-35 cursor-crosshair pointer-events-auto"
                              : "z-10 pointer-events-none"
                          }`}
                        />

                        {/* Click overlay layer (only active when placing comments/text) */}
                        {activeTool === "text" && (
                          <div
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const clickX = e.clientX - rect.left;
                              const clickY = e.clientY - rect.top;
                              const pctX = (clickX / rect.width) * 100;
                              const pctY = (clickY / rect.height) * 100;
                              setPendingTextCoords({ pageIndex: activePageIndex, x: pctX, y: pctY });
                              setTextVal("");
                              setIsTextModalOpen(true);
                            }}
                            className="absolute inset-0 w-full h-full z-25 cursor-cell bg-black/5"
                          />
                        )}

                        {/* Draggable Comment Elements Layer */}
                        {textAnnotations.filter(t => t.pageIndex === activePageIndex).map((t) => {
                          const isSelected = selectedElementId === t.id;

                          return (
                            <div
                              key={t.id}
                              onClick={(e) => {
                                if (activeTool === "select") {
                                  e.stopPropagation();
                                  setSelectedElementId(t.id);
                                }
                              }}
                              className={`absolute z-30 select-none flex items-center group ${
                                isSelected && activeTool === "select" ? "border-2 border-dashed border-blue-500 bg-blue-500/5 p-0.5 rounded-lg" : ""
                              }`}
                              style={{
                                left: `${t.x}%`,
                                top: `${t.y}%`,
                              }}
                            >
                              {activeTool === "select" && (
                                <div
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(t.id);
                                    handleDragText(t.id, e);
                                  }}
                                  className="absolute inset-0 w-full h-full bg-transparent z-10 cursor-move"
                                />
                              )}

                              <div
                                className="px-2.5 py-1 text-xs font-bold rounded-lg shadow-sm border select-none pointer-events-none"
                                style={{
                                  color: t.color,
                                  backgroundColor: t.bgColor,
                                  borderColor: t.color + "44",
                                  fontSize: `${11 * (zoom / 100)}px`
                                }}
                              >
                                {t.text}
                              </div>
                              
                              {isSelected && activeTool === "select" && (
                                <button
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => { e.stopPropagation(); removeTextAnnotation(t.id); }}
                                  className="h-5 w-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-750 transition shadow ml-1.5 cursor-pointer font-bold select-none leading-none z-20"
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          );
                        })}

                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

          {/* Success Screen */}
          {outputUrl && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm">
              <div className="flex justify-center text-emerald-500 text-5xl">
                <i className="ri-checkbox-circle-fill text-emerald-500"></i>
              </div>
              <div className="space-y-1.5 text-center">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Document Annotated Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">All your vector shapes, highlight lines, and comments have been permanently merged.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`Annotated_${file?.name}`}
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
                  setTextAnnotations([]);
                  setHistory([]);
                  setCanvasDrawings({});
                  setActivePageIndex(0);
                  setSelectedElementId(null);
                }}
                className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto font-bold"
              >
                Annotate Another PDF
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
      {/* POPUP MODAL: ADD COMMENT TEXT ANNOTATION BLOCK            */}
      {/* ======================================================== */}
      {isTextModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-150 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-left animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <i className="ri-chat-new-line text-blue-500"></i>
                <h3 className="font-black text-zinc-900 dark:text-white text-sm">Add Text Comment Badge</h3>
              </div>
              <button onClick={() => { setIsTextModalOpen(false); setPendingTextCoords(null); }} className="text-zinc-405 hover:text-zinc-650 text-lg font-bold leading-none">&times;</button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 block">Comment Message</label>
              <input
                type="text"
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                placeholder="Type your comment..."
                autoFocus
                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-zinc-900 dark:text-white"
              />
            </div>

            {/* Comment Color */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 block">Text Color</label>
              <div className="flex gap-2">
                {[
                  { val: "#000000", label: "Charcoal" },
                  { val: "#002fa7", label: "Blue" },
                  { val: "#a00000", label: "Red" },
                  { val: "#006400", label: "Forest Green" }
                ].map((color) => (
                  <button
                    key={color.val}
                    onClick={() => setTextColor(color.val)}
                    className={`px-3 py-1 bg-zinc-50 hover:bg-zinc-150 dark:bg-zinc-955 dark:hover:bg-zinc-900 border border-zinc-205 dark:border-zinc-800 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      textColor === color.val ? "ring-2 ring-blue-500/30 text-blue-500 border-blue-400" : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.val }} />
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Style */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 block">Badge Color</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { val: "transparent", label: "No Background" },
                  { val: "rgba(254, 240, 138, 0.9)", label: "Sticky Yellow" },
                  { val: "rgba(191, 219, 254, 0.9)", label: "Ocean Blue" },
                  { val: "rgba(187, 247, 208, 0.9)", label: "Mint Green" }
                ].map((color) => (
                  <button
                    key={color.val}
                    onClick={() => setTextBgColor(color.val)}
                    className={`px-3 py-1 bg-zinc-50 hover:bg-zinc-150 dark:bg-zinc-955 dark:hover:bg-zinc-900 border border-zinc-205 dark:border-zinc-800 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      textBgColor === color.val ? "ring-2 ring-blue-500/30 text-blue-500 border-blue-400" : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-850 pt-4 flex justify-end gap-3">
              <button onClick={() => { setIsTextModalOpen(false); setPendingTextCoords(null); }} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-855 dark:hover:bg-zinc-755 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs cursor-pointer">Cancel</button>
              <button onClick={handleSaveTextAnnotation} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer">Add Comment</button>
            </div>

          </div>
        </div>
      )}

      {/* MOBILE BOTTOM BANNER */}
      {!isPremium && !isFullscreen && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center z-45 transition-colors shadow-lg">
          <div className="w-full max-w-lg mx-auto flex items-center justify-between px-4 h-full text-xs text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <span className="bg-zinc-100 dark:bg-zinc-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded text-zinc-500">AD</span>
              <p className="font-semibold text-[12px] text-zinc-500 dark:text-zinc-400">Upgrade to remove ads and unlock pro features.</p>
            </div>
            <Link href="/pricing" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-755 text-white font-bold rounded-xl text-[12px] transition whitespace-nowrap shadow">
              Upgrade
            </Link>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
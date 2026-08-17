// app/tools/edit-pdf/EditPdf.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

type EditTool = "select" | "text" | "image" | "shape" | "draw" | "eraser";
type ShapeType = "rectangle" | "circle";
type FontFamily = "Helvetica" | "Courier" | "TimesRoman";

interface EditElement {
  id: string;
  pageIndex: number;
  type: "text" | "image" | "shape";
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // CSS pixels width
  height: number; // CSS pixels height
  
  // Text element attributes
  text?: string;
  color?: string;
  bgColor?: string;
  fontSize?: number;
  fontFamily?: FontFamily;

  // Image element attributes
  imageUrl?: string; // base64 DataURL

  // Shape element attributes
  shapeType?: ShapeType;
  fillColor?: string;
  borderColor?: string;
}

interface HistoryItem {
  type: "canvas_draw" | "element_add" | "element_delete" | "element_drag" | "element_resize";
  pageIndex: number;
  canvasState?: string; // transparent drawing state before stroke
  elementId?: string;
  element?: EditElement;
  beforeCoords?: { x: number; y: number; w: number; h: number };
}

export default function EditPdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  // Layout & Toolbar States
  const [activeTool, setActiveTool] = useState<EditTool>("select");
  const [strokeColor, setStrokeColor] = useState("#000000"); // black
  const [brushWidth, setBrushWidth] = useState(4);
  const [zoom, setZoom] = useState(100);

  // Drag & Resize Elements States
  const [elements, setElements] = useState<EditElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Modal Configurations (Text / Image / Shape)
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textVal, setTextVal] = useState("");
  const [textColor, setTextColor] = useState("#000000");
  const [textBgColor, setTextBgColor] = useState("transparent");
  const [textFontSize, setTextFontSize] = useState(14);
  const [textFontFamily, setTextFontFamily] = useState<FontFamily>("Helvetica");
  const [pendingCoords, setPendingCoords] = useState<{ pageIndex: number; x: number; y: number } | null>(null);

  const [isShapeModalOpen, setIsShapeModalOpen] = useState(false);
  const [selectedShapeType, setSelectedShapeType] = useState<ShapeType>("rectangle");
  const [shapeFillColor, setShapeFillColor] = useState("rgba(59, 130, 246, 0.4)"); // light transparent blue

  // Action states
  const [converting, setConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [pdfPageImages, setPdfPageImages] = useState<{ url: string; w: number; h: number }[]>([]);

  // Undo & Event states
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const canvasSnapshotBeforeStroke = useRef<string | null>(null);
  const dragSnapshot = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const isDrawing = useRef(false);

  // Sync premium status
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

  // Bind Ctrl+Z Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [history, elements]);

  const loadPdfjs = async () => {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        resolve(pdfjs);
      };
      script.onerror = () => reject(new Error("Failed to load PDFJS"));
      document.head.appendChild(script);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      alert("Please upload a valid PDF.");
      return;
    }

    setFile(selectedFile);
    setOutputUrl(null);
    setOutputBlob(null);
    setPdfPageImages([]);
    setElements([]);
    setHistory([]);
    canvasRefs.current = [];

    setConverting(true);
    setProgressMsg("Loading PDF engine...");
    try {
      const activePdfJs = await loadPdfjs();
      setProgressMsg("Rendering document pages...");
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = activePdfJs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const pagesCount = pdf.numPages;
      const pagesData: { url: string; w: number; h: number }[] = [];

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

  // Drawing & Element placing triggers
  const handlePageMouseDown = (pageIndex: number, e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRefs.current[pageIndex];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const pctX = (clientX / rect.width) * 100;
    const pctY = (clientY / rect.height) * 100;

    if (activeTool === "text") {
      setPendingCoords({ pageIndex, x: pctX, y: pctY });
      setTextVal("");
      setIsTextModalOpen(true);
      return;
    }

    if (activeTool === "shape") {
      setPendingCoords({ pageIndex, x: pctX, y: pctY });
      setIsShapeModalOpen(true);
      return;
    }

    if (activeTool === "image") {
      setPendingCoords({ pageIndex, x: pctX, y: pctY });
      imageUploadRef.current?.click();
      return;
    }

    if (activeTool === "draw" || activeTool === "eraser") {
      canvasSnapshotBeforeStroke.current = canvas.toDataURL("image/png");
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      isDrawing.current = true;
      ctx.beginPath();
      ctx.moveTo(clientX * scaleX, clientY * scaleY);

      if (activeTool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = brushWidth * 5;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = brushWidth;
        ctx.strokeStyle = strokeColor;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  };

  const handlePageMouseMove = (pageIndex: number, e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || activeTool === "text" || activeTool === "image" || activeTool === "shape") return;
    const canvas = canvasRefs.current[pageIndex];
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.lineTo(x * scaleX, y * scaleY);
    ctx.stroke();
  };

  const handlePageMouseUp = (pageIndex: number) => {
    if (isDrawing.current && canvasSnapshotBeforeStroke.current) {
      setHistory(prev => [
        ...prev,
        {
          type: "canvas_draw",
          pageIndex,
          canvasState: canvasSnapshotBeforeStroke.current as string
        }
      ]);
    }
    isDrawing.current = false;
    canvasSnapshotBeforeStroke.current = null;
  };

  // Clear canvas markup + page annotations
  const clearPageElements = (pageIndex: number) => {
    const canvas = canvasRefs.current[pageIndex];
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      setHistory(prev => [
        ...prev,
        {
          type: "canvas_draw",
          pageIndex,
          canvasState: canvas.toDataURL("image/png")
        }
      ]);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    const pageElms = elements.filter(el => el.pageIndex === pageIndex);
    pageElms.forEach(el => {
      setHistory(prev => [
        ...prev,
        {
          type: "element_delete",
          pageIndex,
          element: el
        }
      ]);
    });
    setElements(prev => prev.filter(el => el.pageIndex !== pageIndex));
  };

  // Add Elements
  const handleSaveTextElement = () => {
    if (!textVal.trim() || !pendingCoords) return;
    const newEl: EditElement = {
      id: Math.random().toString(36).substring(2, 9),
      pageIndex: pendingCoords.pageIndex,
      type: "text",
      x: pendingCoords.x,
      y: pendingCoords.y,
      width: 160,
      height: 40,
      text: textVal,
      color: textColor,
      bgColor: textBgColor,
      fontSize: textFontSize,
      fontFamily: textFontFamily
    };
    setElements(prev => [...prev, newEl]);
    setHistory(prev => [...prev, { type: "element_add", pageIndex: pendingCoords.pageIndex, elementId: newEl.id }]);
    setIsTextModalOpen(false);
    setPendingCoords(null);
  };

  const handleSaveShapeElement = () => {
    if (!pendingCoords) return;
    const newEl: EditElement = {
      id: Math.random().toString(36).substring(2, 9),
      pageIndex: pendingCoords.pageIndex,
      type: "shape",
      x: pendingCoords.x,
      y: pendingCoords.y,
      width: 100,
      height: 60,
      shapeType: selectedShapeType,
      fillColor: shapeFillColor,
      borderColor: strokeColor
    };
    setElements(prev => [...prev, newEl]);
    setHistory(prev => [...prev, { type: "element_add", pageIndex: pendingCoords.pageIndex, elementId: newEl.id }]);
    setIsShapeModalOpen(false);
    setPendingCoords(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && pendingCoords) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        const newEl: EditElement = {
          id: Math.random().toString(36).substring(2, 9),
          pageIndex: pendingCoords.pageIndex,
          type: "image",
          x: pendingCoords.x,
          y: pendingCoords.y,
          width: 150,
          height: 100,
          imageUrl: event.target?.result as string
        };
        setElements(prev => [...prev, newEl]);
        setHistory(prev => [...prev, { type: "element_add", pageIndex: pendingCoords.pageIndex, elementId: newEl.id }]);
        setPendingCoords(null);
      };
      fileReader.readAsDataURL(e.target.files[0]);
    }
  };

  // Draggable HUD controls
  const handleDragStart = (id: string) => {
    const target = elements.find(el => el.id === id);
    if (target) {
      dragSnapshot.current = { x: target.x, y: target.y, w: target.width, h: target.height };
    }
    setSelectedElementId(id);
  };

  const handleDragElement = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = elements.find(el => el.id === id);
    if (!target) return;
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

      newLeft = Math.max(0, Math.min(newLeft, container.clientWidth - target.width));
      newTop = Math.max(0, Math.min(newTop, container.clientHeight - target.height));

      setElements(prev => prev.map(el => el.id === id ? {
        ...el,
        x: (newLeft / container.clientWidth) * 100,
        y: (newTop / container.clientHeight) * 100
      } : el));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (dragSnapshot.current) {
        const finalTarget = elements.find(el => el.id === id);
        if (finalTarget && (finalTarget.x !== dragSnapshot.current.x || finalTarget.y !== dragSnapshot.current.y)) {
          setHistory(prev => [
            ...prev,
            {
              type: "element_drag",
              pageIndex: finalTarget.pageIndex,
              elementId: id,
              beforeCoords: dragSnapshot.current as { x: number; y: number; w: number; h: number }
            }
          ]);
        }
      }
      dragSnapshot.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeElement = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = elements.find(el => el.id === id);
    if (!target) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = target.width;
    const startH = target.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newW = Math.max(40, startW + deltaX);
      const newH = Math.max(20, startH + deltaY);

      setElements(prev => prev.map(el => el.id === id ? {
        ...el,
        width: newW,
        height: newH
      } : el));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (dragSnapshot.current) {
        const finalTarget = elements.find(el => el.id === id);
        if (finalTarget && (finalTarget.width !== dragSnapshot.current.w || finalTarget.height !== dragSnapshot.current.h)) {
          setHistory(prev => [
            ...prev,
            {
              type: "element_resize",
              pageIndex: finalTarget.pageIndex,
              elementId: id,
              beforeCoords: dragSnapshot.current as { x: number; y: number; w: number; h: number }
            }
          ]);
        }
      }
      dragSnapshot.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const deleteElement = (id: string) => {
    const target = elements.find(el => el.id === id);
    if (target) {
      setHistory(prev => [...prev, { type: "element_delete", pageIndex: target.pageIndex, element: target }]);
      setElements(prev => prev.filter(el => el.id !== id));
      setSelectedElementId(null);
    }
  };

  // Undo Functionality
  const handleUndo = () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    if (lastAction.type === "canvas_draw") {
      const canvas = canvasRefs.current[lastAction.pageIndex];
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx && lastAction.canvasState) {
        const img = new Image();
        img.src = lastAction.canvasState;
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
      }
    } else if (lastAction.type === "element_add") {
      setElements(prev => prev.filter(el => el.id !== lastAction.elementId));
    } else if (lastAction.type === "element_delete" && lastAction.element) {
      setElements(prev => [...prev, lastAction.element as EditElement]);
    } else if (lastAction.type === "element_drag" && lastAction.beforeCoords) {
      setElements(prev => prev.map(el => el.id === lastAction.elementId ? {
        ...el,
        x: (lastAction.beforeCoords as any).x,
        y: (lastAction.beforeCoords as any).y
      } : el));
    } else if (lastAction.type === "element_resize" && lastAction.beforeCoords) {
      setElements(prev => prev.map(el => el.id === lastAction.elementId ? {
        ...el,
        width: (lastAction.beforeCoords as any).w,
        height: (lastAction.beforeCoords as any).h
      } : el));
    }
  };

  // Save compiled PDF modifications
  const handleSavePdf = async () => {
    if (!file || pdfPageImages.length === 0) return;

    // Capture dimensions before unmounting
    const pageDimensions = pdfPageImages.map((_, idx) => {
      const container = document.getElementById(`pdf-page-container-${idx}`);
      return {
        clientWidth: container?.clientWidth || 560,
        clientHeight: container?.clientHeight || 700
      };
    });

    const annotatedPagesData: { index: number; dataUrl: string }[] = [];
    for (let i = 0; i < pdfPageImages.length; i++) {
      const canvas = canvasRefs.current[i];
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const buffer = new Uint32Array(ctx?.getImageData(0, 0, canvas.width, canvas.height).data.buffer || []);
        if (buffer.some(pixel => pixel !== 0)) {
          annotatedPagesData.push({
            index: i,
            dataUrl: canvas.toDataURL("image/png")
          });
        }
      }
    }

    setConverting(true);
    setProgressMsg("Compiling document layers...");

    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      // Pre-load typography vectors
      const fonts = {
        Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
        Courier: await pdfDoc.embedFont(StandardFonts.Courier),
        TimesRoman: await pdfDoc.embedFont(StandardFonts.TimesRoman)
      };

      // A. Embed Pen drawings
      for (const annot of annotatedPagesData) {
        const page = pages[annot.index];
        const { width: pdfW, height: pdfH } = page.getSize();
        const base64Bytes = annot.dataUrl.split(",")[1];
        const pngBytes = Uint8Array.from(atob(base64Bytes), c => c.charCodeAt(0));
        const embeddedImg = await pdfDoc.embedPng(pngBytes);
        page.drawImage(embeddedImg, { x: 0, y: 0, width: pdfW, height: pdfH });
      }

      const parseColor = (colStr: string) => {
        if (colStr.startsWith("#")) {
          const r = parseInt(colStr.slice(1, 3), 16) / 255;
          const g = parseInt(colStr.slice(3, 5), 16) / 255;
          const b = parseInt(colStr.slice(5, 7), 16) / 255;
          return rgb(r, g, b);
        }
        if (colStr.startsWith("rgba") || colStr.startsWith("rgb")) {
          const matches = colStr.match(/\d+/g);
          if (matches && matches.length >= 3) {
            return rgb(parseInt(matches[0])/255, parseInt(matches[1])/255, parseInt(matches[2])/255);
          }
        }
        return rgb(0, 0, 0);
      };

      // B. Embed elements (Text, Images, Shapes)
      for (const el of elements) {
        if (el.pageIndex >= pages.length) continue;
        const page = pages[el.pageIndex];
        const dims = pageDimensions[el.pageIndex];
        const { width: pdfW, height: pdfH } = page.getSize();

        const scaleX = pdfW / dims.clientWidth;
        const scaleY = pdfH / dims.clientHeight;

        const elX = (el.x / 100) * dims.clientWidth * scaleX;
        const elY = (dims.clientHeight - (el.y / 100) * dims.clientHeight - el.height) * scaleY;
        const elW = el.width * scaleX;
        const elH = el.height * scaleY;

        if (el.type === "text" && el.text) {
          const font = fonts[el.fontFamily || "Helvetica"];
          const fSize = (el.fontSize || 14) * scaleY;
          
          if (el.bgColor && el.bgColor !== "transparent") {
            page.drawRectangle({
              x: elX,
              y: elY,
              width: elW,
              height: elH,
              color: parseColor(el.bgColor)
            });
          }

          page.drawText(el.text, {
            x: elX + 4 * scaleX,
            y: elY + (el.height - 18) * scaleY,
            size: fSize,
            font,
            color: parseColor(el.color || "#000000")
          });
        } 
        
        else if (el.type === "shape") {
          const isCircle = el.shapeType === "circle";
          const fillColorRGB = el.fillColor ? parseColor(el.fillColor) : undefined;
          const borderColorRGB = el.borderColor ? parseColor(el.borderColor) : undefined;

          if (isCircle) {
            page.drawEllipse({
              x: elX + elW / 2,
              y: elY + elH / 2,
              xScale: elW / 2,
              yScale: elH / 2,
              color: fillColorRGB,
              borderColor: borderColorRGB,
              borderWidth: 1.5 * scaleX
            });
          } else {
            page.drawRectangle({
              x: elX,
              y: elY,
              width: elW,
              height: elH,
              color: fillColorRGB,
              borderColor: borderColorRGB,
              borderWidth: 1.5 * scaleX
            });
          }
        } 
        
        else if (el.type === "image" && el.imageUrl) {
          const imageParts = el.imageUrl.split(",");
          const byteString = atob(imageParts[1]);
          const imgBytes = new Uint8Array(byteString.length);
          for (let j = 0; j < byteString.length; j++) {
            imgBytes[j] = byteString.charCodeAt(j);
          }

          const embeddedElImg = el.imageUrl.includes("image/png") 
            ? await pdfDoc.embedPng(imgBytes) 
            : await pdfDoc.embedJpg(imgBytes);

          page.drawImage(embeddedElImg, {
            x: elX,
            y: elY,
            width: elW,
            height: elH
          });
        }
      }

      setProgressMsg("Saving output file...");
      const pdfBytesOutput = await pdfDoc.save();

      const pdfBlobOutput = new Blob([pdfBytesOutput] as any, { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlobOutput);

      setOutputBlob(pdfBlobOutput);
      setOutputUrl(url);
    } catch (err: any) {
      console.error(err);
      alert("Failed to compile layout edits: " + (err.message || err));
    } finally {
      setConverting(false);
      setProgressMsg("");
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    const name = `Edited_${file?.name}`;
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
      alert("Failed to queue file write locally.");
    }
  };

  return (
    <div className={`min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white flex flex-col justify-between transition-colors duration-300 ${
      !isPremium ? "pb-16 lg:pb-0" : ""
    }`}>
      <Header />

      <div className="flex-1 flex-col md:flex-row flex w-full max-w-[100vw] justify-center overflow-hidden">
        
        {/* LEFT COLUMN: Advertising */}
        {!isPremium && (!file || outputUrl) && (
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
        <main className="flex-1 max-w-4xl p-6 md:p-8 overflow-auto space-y-6 flex flex-col items-center justify-between">
          <div className="w-full space-y-2 text-left">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-file-edit-line text-blue-600 dark:text-blue-500"></i> Edit PDF Document
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Add custom texts, drag images, draw layouts, and decorate vectors entirely offline.
            </p>
          </div>

          {!file && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm my-auto">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-650 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-file-edit-fill"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF document to edit</p>
                <p className="text-[14px] text-zinc-405 dark:text-zinc-555 mt-1">Upload a PDF to apply vector modifications.</p>
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
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-sm animate-in fade-in duration-200 my-auto">
              <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Processing Document...</p>
                <p className="text-xs text-zinc-505 font-mono">{progressMsg}</p>
              </div>
            </div>
          )}

          {/* Interactive Annotation Workspace */}
          {file && pdfPageImages.length > 0 && !outputUrl && !converting && (
            <div className="w-full space-y-6 flex flex-col items-center">
              
              {/* Toolbar Control Panel HUD */}
              <div className="w-full flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                
                {/* Tool Selection Tabs */}
                <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl">
                  {[
                    { id: "select", icon: "ri-hand-line", label: "Select & Move" },
                    { id: "text", icon: "ri-text", label: "Add Text" },
                    { id: "image", icon: "ri-image-add-line", label: "Add Image" },
                    { id: "shape", icon: "ri-shapes-line", label: "Add Shape" },
                    { id: "draw", icon: "ri-pencil-line", label: "Freehand Pen" },
                    { id: "eraser", icon: "ri-eraser-line", label: "Eraser" },
                  ].map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => { setActiveTool(tool.id as EditTool); setSelectedElementId(null); }}
                      title={tool.label}
                      className={`h-8 px-2.5 rounded-lg flex items-center justify-center transition cursor-pointer text-xs font-bold gap-1 ${
                        activeTool === tool.id
                          ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      <i className={tool.icon}></i>
                    </button>
                  ))}
                </div>

                {/* Undo Action */}
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  title="Undo Action (Ctrl+Z)"
                  className="h-8 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 text-zinc-650 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition"
                >
                  <i className="ri-arrow-go-back-line"></i>
                  <span className="text-[10px] font-bold">Undo</span>
                </button>

                {/* Color Palette Selectors */}
                {(activeTool === "draw" || activeTool === "shape") && (
                  <div className="flex gap-1.5">
                    {["#000000", "#002fa7", "#a00000", "#008000", "#ffd700"].map((col) => (
                      <button
                        key={col}
                        onClick={() => setStrokeColor(col)}
                        className={`h-5 w-5 rounded-full border border-white dark:border-zinc-900 cursor-pointer transition ${
                          strokeColor === col ? "scale-125 ring-2 ring-blue-500/30" : ""
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                )}

                {/* Brush size slider for drawings */}
                {activeTool === "draw" && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-bold">Size:</span>
                    <input
                      type="range"
                      min="2"
                      max="12"
                      value={brushWidth}
                      onChange={(e) => setBrushWidth(parseInt(e.target.value))}
                      className="w-16 h-1 appearance-none bg-zinc-250 dark:bg-zinc-800 rounded-lg cursor-pointer accent-blue-600"
                    />
                  </div>
                )}

                {/* Zoom hud */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoom(z => Math.max(50, z - 10))}
                    className="h-8 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-755 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    A-
                  </button>
                  <span className="text-[10px] font-bold text-zinc-400 w-10 text-center select-none font-mono">{zoom}%</span>
                  <button
                    onClick={() => setZoom(z => Math.min(150, z + 10))}
                    className="h-8 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-755 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    A+
                  </button>
                </div>

                {/* Export Stamp */}
                <button
                  onClick={handleSavePdf}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5 animate-pulse"
                >
                  <i className="ri-checkbox-circle-line"></i> Save Edits
                </button>

              </div>

              {/* Rendering Pages Stream */}
              <div className="w-full flex flex-col items-center gap-8 max-h-[70vh] overflow-y-auto pr-1 py-2 bg-zinc-100/50 dark:bg-zinc-950/20 p-4 rounded-3xl border border-zinc-200/50 dark:border-zinc-850">
                {pdfPageImages.map((page, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none">Page {idx + 1}</span>
                      <button
                        onClick={() => clearPageElements(idx)}
                        className="text-[9px] text-red-500 hover:underline font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Clear Page
                      </button>
                    </div>

                    <div
                      id={`pdf-page-container-${idx}`}
                      className="relative bg-white border border-zinc-300 shadow-md select-none overflow-hidden"
                      style={{ 
                        width: `${560 * (zoom / 100)}px`,
                        height: `${(560 * (page.h / page.w)) * (zoom / 100)}px`
                      }}
                    >
                      {/* PDF Page image */}
                      <img
                        src={page.url}
                        alt={`Page ${idx}`}
                        className="absolute inset-0 w-full h-full pointer-events-none block"
                      />

                      {/* Pen Drawing Layer */}
                      <canvas
                        ref={(el) => { canvasRefs.current[idx] = el; }}
                        width={page.w}
                        height={page.h}
                        onMouseDown={(e) => handlePageMouseDown(idx, e)}
                        onMouseMove={(e) => handlePageMouseMove(idx, e)}
                        onMouseUp={() => handlePageMouseUp(idx)}
                        onMouseLeave={() => handlePageMouseUp(idx)}
                        className={`absolute inset-0 w-full h-full bg-transparent z-10 ${
                          activeTool === "draw" || activeTool === "eraser" ? "cursor-crosshair" : "pointer-events-none"
                        }`}
                      />

                      {/* Click overlay layer (only active when placing new elements) */}
                      {activeTool !== "select" && activeTool !== "draw" && activeTool !== "eraser" && (
                        <div
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const clickY = e.clientY - rect.top;
                            const pctX = (clickX / rect.width) * 100;
                            const pctY = (clickY / rect.height) * 100;

                            setPendingCoords({ pageIndex: idx, x: pctX, y: pctY });
                            if (activeTool === "text") {
                              setTextVal("");
                              setIsTextModalOpen(true);
                            } else if (activeTool === "shape") {
                              setIsShapeModalOpen(true);
                            } else if (activeTool === "image") {
                              imageUploadRef.current?.click();
                            }
                          }}
                          className="absolute inset-0 w-full h-full z-20 cursor-cell bg-black/5"
                        />
                      )}

                      {/* Interactive Drag & Resize Elements layer */}
                      {elements.filter(el => el.pageIndex === idx).map((el) => {
                        const isSelected = selectedElementId === el.id;

                        return (
                          <div
                            key={el.id}
                            onMouseDown={() => handleDragStart(el.id)}
                            className={`absolute select-none z-30 flex items-center justify-center ${
                              isSelected ? "border-2 border-dashed border-blue-500 shadow-md" : "hover:border hover:border-zinc-400"
                            }`}
                            style={{
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              width: `${el.width * (zoom / 100)}px`,
                              height: `${el.height * (zoom / 100)}px`,
                              cursor: activeTool === "select" ? "move" : "default"
                            }}
                          >
                            
                            {/* Drag handle */}
                            {activeTool === "select" && (
                              <div
                                onMouseDown={(e) => handleDragElement(el.id, e)}
                                className="absolute inset-0 w-full h-full bg-transparent z-10"
                              />
                            )}

                            {/* Render Text element */}
                            {el.type === "text" && (
                              <div
                                className="w-full h-full px-2 py-1 select-none font-bold text-xs truncate break-words"
                                style={{
                                  color: el.color,
                                  backgroundColor: el.bgColor !== "transparent" ? el.bgColor : "transparent",
                                  fontSize: el.fontSize ? `${el.fontSize * (zoom / 100)}px` : "inherit",
                                  fontFamily: el.fontFamily || "inherit"
                                }}
                              >
                                {el.text}
                              </div>
                            )}

                            {/* Render Shape Element */}
                            {el.type === "shape" && (
                              <div
                                className="w-full h-full select-none"
                                style={{
                                  backgroundColor: el.fillColor || "transparent",
                                  border: el.borderColor ? `2px solid ${el.borderColor}` : "none",
                                  borderRadius: el.shapeType === "circle" ? "50%" : "0%"
                                }}
                              />
                            )}

                            {/* Render Image Element */}
                            {el.type === "image" && el.imageUrl && (
                              <img
                                src={el.imageUrl}
                                alt="edit visual layer"
                                className="w-full h-full object-contain pointer-events-none select-none"
                              />
                            )}

                            {/* Resize Corner Handle (Visible only if selected in Move mode) */}
                            {isSelected && activeTool === "select" && (
                              <>
                                {/* Resize trigger */}
                                <div
                                  onMouseDown={(e) => handleResizeElement(el.id, e)}
                                  className="absolute bottom-0 right-0 h-4 w-4 bg-blue-600 border border-white cursor-se-resize rounded-tl-md flex items-center justify-center shadow z-40"
                                >
                                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 13v6m0 0h-6m6 0L13 13" />
                                  </svg>
                                </div>
                                
                                {/* Delete button */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                                  className="absolute -top-3 -right-3 h-6 w-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-700 shadow-md cursor-pointer z-40 font-bold"
                                >
                                  &times;
                                </button>
                              </>
                            )}

                          </div>
                        );
                      })}

                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* Hidden image file upload input */}
          <input
            type="file"
            ref={imageUploadRef}
            accept="image/png,image/jpeg"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Success Screen */}
          {outputUrl && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm animate-in fade-in duration-300 my-auto">
              <div className="flex justify-center text-emerald-555 text-5xl">
                <i className="ri-checkbox-circle-fill text-emerald-500"></i>
              </div>
              <div className="space-y-1.5 text-center">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Document Edited Successfully!</h3>
                <p className="text-xs text-zinc-455 dark:text-zinc-450">All your custom image layers, text boxes, and drawings have been permanently embedded.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`Edited_${file?.name}`}
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
                  setPdfPageImages([]);
                  setElements([]);
                  setHistory([]);
                }}
                className="text-xs font-semibold text-zinc-405 hover:underline cursor-pointer block mx-auto font-bold"
              >
                Edit Another PDF
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

      {/* ======================================================== */}
      {/* POPUP MODAL: ADD CUSTOM TEXT BLOCK                        */}
      {/* ======================================================== */}
      {isTextModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-150 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <i className="ri-text text-blue-500"></i>
                <h3 className="font-black text-zinc-900 dark:text-white text-sm">Insert Text Block</h3>
              </div>
              <button onClick={() => { setIsTextModalOpen(false); setPendingCoords(null); }} className="text-zinc-400 hover:text-zinc-650 text-lg font-bold">&times;</button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Type Text Content</label>
              <input
                type="text"
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                placeholder="Enter text..."
                autoFocus
                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-zinc-900 dark:text-white font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Font Family */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Font Family</label>
                <select
                  value={textFontFamily}
                  onChange={(e) => setTextFontFamily(e.target.value as FontFamily)}
                  className="w-full px-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold text-zinc-800 dark:text-zinc-250 cursor-pointer"
                >
                  <option value="Helvetica">Helvetica (Standard)</option>
                  <option value="Courier">Courier (Monospace)</option>
                  <option value="TimesRoman">Times New Roman</option>
                </select>
              </div>

              {/* Font Size */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Font Size</label>
                <select
                  value={textFontSize}
                  onChange={(e) => setTextFontSize(parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold text-zinc-800 dark:text-zinc-250 cursor-pointer"
                >
                  {[10, 12, 14, 16, 18, 20, 24, 28].map(sz => (
                    <option key={sz} value={sz}>{sz}px</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Text Color */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Text Color</label>
              <div className="flex gap-2">
                {[
                  { val: "#000000", label: "Charcoal" },
                  { val: "#002fa7", label: "Royal Blue" },
                  { val: "#a00000", label: "Crimson" },
                  { val: "#006400", label: "Forest Green" }
                ].map((color) => (
                  <button
                    key={color.val}
                    onClick={() => setTextColor(color.val)}
                    className={`px-3 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      textColor === color.val ? "ring-2 ring-blue-500/30 text-blue-500 border-blue-400" : "text-zinc-650"
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
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Highlight Background</label>
              <div className="flex gap-2">
                {[
                  { val: "transparent", label: "Transparent" },
                  { val: "rgba(254, 240, 138, 0.9)", label: "Yellow highlight" },
                  { val: "#ffffff", label: "Solid White" }
                ].map((color) => (
                  <button
                    key={color.val}
                    onClick={() => setTextBgColor(color.val)}
                    className={`px-3 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      textBgColor === color.val ? "ring-2 ring-blue-500/30 text-blue-500 border-blue-400" : "text-zinc-650"
                    }`}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-150 dark:border-zinc-800 pt-4 flex justify-end gap-3">
              <button onClick={() => { setIsTextModalOpen(false); setPendingCoords(null); }} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs cursor-pointer">Cancel</button>
              <button onClick={handleSaveTextElement} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer">Insert</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* POPUP MODAL: ADD CUSTOM SHAPE BLOCK                       */}
      {/* ======================================================== */}
      {isShapeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-150 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <i className="ri-shapes-line text-blue-500"></i>
                <h3 className="font-black text-zinc-900 dark:text-white text-sm">Add Shape Layer</h3>
              </div>
              <button onClick={() => { setIsShapeModalOpen(false); setPendingCoords(null); }} className="text-zinc-400 hover:text-zinc-650 text-lg font-bold">&times;</button>
            </div>

            {/* Shape Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Shape Type</label>
              <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl">
                {[
                  { id: "rectangle", label: "Rectangle / Box" },
                  { id: "circle", label: "Circle / Ellipse" }
                ].map(sh => (
                  <button
                    key={sh.id}
                    onClick={() => setSelectedShapeType(sh.id as ShapeType)}
                    className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                      selectedShapeType === sh.id
                        ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {sh.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fill styles */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Fill Style</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: "transparent", label: "Outline Only" },
                  { val: "rgba(59, 130, 246, 0.4)", label: "Trans Blue Highlight" },
                  { val: "rgba(234, 179, 8, 0.4)", label: "Trans Yellow Highlight" },
                  { val: "rgba(0, 0, 0, 0.1)", label: "Trans Gray Shade" }
                ].map(col => (
                  <button
                    key={col.val}
                    onClick={() => setShapeFillColor(col.val)}
                    className={`px-3 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      shapeFillColor === col.val ? "ring-2 ring-blue-500/30 text-blue-500 border-blue-400" : "text-zinc-650"
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-150 dark:border-zinc-800 pt-4 flex justify-end gap-3">
              <button onClick={() => { setIsShapeModalOpen(false); setPendingCoords(null); }} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs cursor-pointer">Cancel</button>
              <button onClick={handleSaveShapeElement} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer">Insert Shape</button>
            </div>
          </div>
        </div>
      )}

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
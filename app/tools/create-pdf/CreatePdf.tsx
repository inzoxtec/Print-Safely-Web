// app/tools/create-pdf/CreatePdf.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

type CreateTool = "select" | "text" | "image" | "shape" | "draw" | "eraser";
type ShapeType = "rectangle" | "circle";
type FontFamily = "Helvetica" | "Courier" | "TimesRoman";
type FontStyle = "normal" | "bold" | "italic" | "boldItalic";
type TextAlignment = "left" | "center" | "right";

interface CustomPage {
  id: string;
  w: number; // A4 standard width reference (595 px)
  h: number; // A4 standard height reference (842 px)
}

interface CreateElement {
  id: string;
  pageId: string;
  type: "text" | "image" | "shape";
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // CSS pixels width
  height: number; // CSS pixels height
  
  // Text attributes
  text?: string;
  color?: string;
  bgColor?: string;
  fontSize?: number;
  fontFamily?: FontFamily;
  fontStyle?: FontStyle;
  alignment?: TextAlignment;

  // Image attributes
  imageUrl?: string; // base64 DataURL

  // Shape attributes
  shapeType?: ShapeType;
  fillColor?: string;
  borderColor?: string;
}

interface HistoryItem {
  type: "canvas_draw" | "element_add" | "element_delete" | "element_drag" | "element_resize";
  pageId: string;
  canvasState?: string; // drawing state before stroke
  elementId?: string;
  element?: CreateElement;
  beforeCoords?: { x: number; y: number; w: number; h: number };
}

interface TextSegment {
  text: string;
  isBold: boolean;
}

export default function CreatePdf() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);

  // Layout & Slides States (Starts with one blank page)
  const [pages, setPages] = useState<CustomPage[]>([
    { id: Math.random().toString(36).substring(2, 9), w: 595, h: 842 }
  ]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [activeTool, setActiveTool] = useState<CreateTool>("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [brushWidth, setBrushWidth] = useState(4);
  const [zoom, setZoom] = useState(85);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drag & Selection States
  const [elements, setElements] = useState<CreateElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Modal Configurations
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textVal, setTextVal] = useState("");
  const [textColor, setTextColor] = useState("#000000");
  const [textBgColor, setTextBgColor] = useState("transparent");
  const [textFontSize, setTextFontSize] = useState(14);
  const [textFontFamily, setTextFontFamily] = useState<FontFamily>("Helvetica");
  const [textFontStyle, setTextFontStyle] = useState<FontStyle>("normal");
  const [textAlignment, setTextAlignment] = useState<TextAlignment>("left");
  const [pendingCoords, setPendingCoords] = useState<{ pageId: string; x: number; y: number } | null>(null);

  const [isShapeModalOpen, setIsShapeModalOpen] = useState(false);
  const [selectedShapeType, setSelectedShapeType] = useState<ShapeType>("rectangle");
  const [shapeFillColor, setShapeFillColor] = useState("rgba(59, 130, 246, 0.4)");

  // Freehand Drawings Cache by Page ID
  const [canvasDrawings, setCanvasDrawings] = useState<{ [pageId: string]: string }>({});

  // Compile States
  const [converting, setConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // Undo States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const canvasSnapshotBeforeStroke = useRef<string | null>(null);
  const dragSnapshot = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const canvasRefs = useRef<{ [pageId: string]: HTMLCanvasElement | null }>({});
  const isDrawing = useRef(false);

  // Input Field References for bolding selections
  const modalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorInputRef = useRef<HTMLInputElement | null>(null);

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

  // Dynamic zoom on screen sizes
  useEffect(() => {
    const screenW = window.innerWidth;
    if (screenW < 768) {
      setZoom(50);
    } else if (screenW < 1024) {
      setZoom(70);
    } else {
      setZoom(85);
    }
  }, []);

  // Keyboard events
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
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, elements]);

  // Restore Drawings when Page index changes
  useEffect(() => {
    const activePage = pages[activePageIndex];
    if (!activePage) return;
    const canvas = canvasRefs.current[activePage.id];
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const savedState = canvasDrawings[activePage.id];
        if (savedState) {
          const img = new Image();
          img.src = savedState;
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
        }
      }
    }
  }, [activePageIndex, pages]);

  // Markdown Parser to isolate Bold parts (**text**)
  const parseRichText = (str: string): TextSegment[] => {
    const segments: TextSegment[] = [];
    const regex = /(\*\*.*?\*\*)/g;
    const parts = str.split(regex);
    for (const part of parts) {
      if (part.startsWith("**") && part.endsWith("**")) {
        segments.push({
          text: part.slice(2, -2),
          isBold: true
        });
      } else if (part) {
        segments.push({
          text: part,
          isBold: false
        });
      }
    }
    return segments;
  };

  const renderFormattedText = (rawText: string) => {
    const segments = parseRichText(rawText);
    return segments.map((seg, idx) => (
      <span key={idx} style={{ fontWeight: seg.isBold ? "bold" : "normal" }}>
        {seg.text}
      </span>
    ));
  };

  // Bold Selection helper
  const handleMakeBoldSelection = (inputRef: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (!inputRef) return;
    const start = inputRef.selectionStart;
    const end = inputRef.selectionEnd;
    if (start === null || end === null || start === end) return;

    const val = inputRef.value;
    const selectedText = val.substring(start, end);
    
    let newVal;
    if (selectedText.startsWith("**") && selectedText.endsWith("**")) {
      newVal = val.substring(0, start) + selectedText.slice(2, -2) + val.substring(end);
    } else {
      newVal = val.substring(0, start) + `**${selectedText}**` + val.substring(end);
    }
    
    if (isTextModalOpen) {
      setTextVal(newVal);
    } else {
      setElements(prev => prev.map(item => item.id === selectedElementId ? { ...item, text: newVal } : item));
    }

    // Restore focus and selection
    setTimeout(() => {
      inputRef.focus();
      inputRef.setSelectionRange(start, start + selectedText.length + (selectedText.startsWith("**") ? -4 : 4));
    }, 50);
  };

  // Add Page Slide
  const handleAddPage = () => {
    const newPage: CustomPage = {
      id: Math.random().toString(36).substring(2, 9),
      w: 595,
      h: 842
    };
    setPages(prev => [...prev, newPage]);
    setActivePageIndex(pages.length);
    setSelectedElementId(null);
  };

  // Delete Page Slide
  const handleDeletePage = (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pages.length <= 1) {
      alert("Your document must contain at least one page.");
      return;
    }
    
    // Clean up elements and drawing cache
    setElements(prev => prev.filter(el => el.pageId !== pageId));
    setCanvasDrawings(prev => {
      const copy = { ...prev };
      delete copy[pageId];
      return copy;
    });

    const targetIdx = pages.findIndex(p => p.id === pageId);
    setPages(prev => prev.filter(p => p.id !== pageId));
    setActivePageIndex(prev => Math.max(0, Math.min(prev, pages.length - 2)));
    setSelectedElementId(null);
  };

  // Drawing mouse handlers
  const handlePageMouseDown = (pageId: string, e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRefs.current[pageId];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const pctX = (clientX / rect.width) * 100;
    const pctY = (clientY / rect.height) * 100;

    if (activeTool === "text") {
      setPendingCoords({ pageId, x: pctX, y: pctY });
      setTextVal("");
      setTextFontSize(14);
      setTextAlignment("left");
      setTextFontStyle("normal");
      setIsTextModalOpen(true);
      return;
    }

    if (activeTool === "shape") {
      setPendingCoords({ pageId, x: pctX, y: pctY });
      setIsShapeModalOpen(true);
      return;
    }

    if (activeTool === "image") {
      setPendingCoords({ pageId, x: pctX, y: pctY });
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

  const handlePageMouseMove = (pageId: string, e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || activeTool === "text" || activeTool === "image" || activeTool === "shape" || activeTool === "select") return;
    const canvas = canvasRefs.current[pageId];
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

  const handlePageMouseUp = (pageId: string) => {
    const canvas = canvasRefs.current[pageId];
    if (isDrawing.current && canvas && canvasSnapshotBeforeStroke.current) {
      const dataUrl = canvas.toDataURL("image/png");
      setCanvasDrawings(prev => ({ ...prev, [pageId]: dataUrl }));

      setHistory(prev => [
        ...prev,
        {
          type: "canvas_draw",
          pageId,
          canvasState: canvasSnapshotBeforeStroke.current as string
        }
      ]);
    }
    isDrawing.current = false;
    canvasSnapshotBeforeStroke.current = null;
  };

  // Add Elements
  const handleSaveTextElement = () => {
    if (!textVal.trim() || !pendingCoords) return;
    const newEl: CreateElement = {
      id: Math.random().toString(36).substring(2, 9),
      pageId: pendingCoords.pageId,
      type: "text",
      x: pendingCoords.x,
      y: pendingCoords.y,
      width: textFontSize > 20 ? 240 : 160,
      height: textFontSize > 20 ? 60 : 40,
      text: textVal,
      color: textColor,
      bgColor: textBgColor,
      fontSize: textFontSize,
      fontFamily: textFontFamily,
      fontStyle: textFontStyle,
      alignment: textAlignment
    };
    setElements(prev => [...prev, newEl]);
    setHistory(prev => [...prev, { type: "element_add", pageId: pendingCoords.pageId, elementId: newEl.id }]);
    setSelectedElementId(newEl.id);
    setActiveTool("select");
    setIsTextModalOpen(false);
    setPendingCoords(null);
  };

  const handleSaveShapeElement = () => {
    if (!pendingCoords) return;
    const newEl: CreateElement = {
      id: Math.random().toString(36).substring(2, 9),
      pageId: pendingCoords.pageId,
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
    setHistory(prev => [...prev, { type: "element_add", pageId: pendingCoords.pageId, elementId: newEl.id }]);
    setSelectedElementId(newEl.id);
    setActiveTool("select");
    setIsShapeModalOpen(false);
    setPendingCoords(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && pendingCoords) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        const newEl: CreateElement = {
          id: Math.random().toString(36).substring(2, 9),
          pageId: pendingCoords.pageId,
          type: "image",
          x: pendingCoords.x,
          y: pendingCoords.y,
          width: 150,
          height: 100,
          imageUrl: event.target?.result as string
        };
        setElements(prev => [...prev, newEl]);
        setHistory(prev => [...prev, { type: "element_add", pageId: pendingCoords.pageId, elementId: newEl.id }]);
        setSelectedElementId(newEl.id);
        setActiveTool("select");
        setPendingCoords(null);
      };
      fileReader.readAsDataURL(e.target.files[0]);
    }
  };

  // Drag and resizing
  const handleDragElement = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();

    const target = elements.find(el => el.id === id);
    if (!target) return;

    setSelectedElementId(id);
    dragSnapshot.current = { x: target.x, y: target.y, w: target.width, h: target.height };

    const container = document.getElementById(`pdf-page-container-${target.pageId}`);
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

      const boundaryWidth = target.width * (zoom / 100);
      const boundaryHeight = target.height * (zoom / 100);

      newLeft = Math.max(0, Math.min(newLeft, container.clientWidth - boundaryWidth));
      newTop = Math.max(0, Math.min(newTop, container.clientHeight - boundaryHeight));

      setElements(prev => prev.map(el => el.id === id ? {
        ...el,
        x: (newLeft / container.clientWidth) * 100,
        y: (newTop / container.clientHeight) * 100
      } : el));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const snapshot = dragSnapshot.current;
      if (snapshot) {
        setElements(prev => {
          const finalTarget = prev.find(el => el.id === id);
          if (finalTarget && (finalTarget.x !== snapshot.x || finalTarget.y !== snapshot.y)) {
            setHistory(h => [
              ...h,
              {
                type: "element_drag",
                pageId: finalTarget.pageId,
                elementId: id,
                beforeCoords: snapshot
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

  const handleResizeElement = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();

    const target = elements.find(el => el.id === id);
    if (!target) return;

    dragSnapshot.current = { x: target.x, y: target.y, w: target.width, h: target.height };

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = target.width;
    const startH = target.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newW = Math.max(40, startW + deltaX / (zoom / 100));
      const newH = Math.max(20, startH + deltaY / (zoom / 100));

      setElements(prev => prev.map(el => el.id === id ? {
        ...el,
        width: newW,
        height: newH
      } : el));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const snapshot = dragSnapshot.current;
      if (snapshot) {
        setElements(prev => {
          const finalTarget = prev.find(el => el.id === id);
          if (finalTarget && (finalTarget.width !== snapshot.w || finalTarget.height !== snapshot.h)) {
            setHistory(h => [
              ...h,
              {
                type: "element_resize",
                pageId: finalTarget.pageId,
                elementId: id,
                beforeCoords: snapshot
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

  const deleteElement = (id: string) => {
    const target = elements.find(el => el.id === id);
    if (target) {
      setHistory(prev => [...prev, { type: "element_delete", pageId: target.pageId, element: target }]);
      setElements(prev => prev.filter(el => el.id !== id));
      setSelectedElementId(null);
    }
  };

  // Undo System
  const handleUndo = () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    if (lastAction.type === "canvas_draw") {
      const canvas = canvasRefs.current[lastAction.pageId];
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx && lastAction.canvasState) {
        const img = new Image();
        img.src = lastAction.canvasState;
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          const dataUrl = canvas.toDataURL("image/png");
          setCanvasDrawings(prev => ({ ...prev, [lastAction.pageId]: dataUrl }));
        };
      }
    } else if (lastAction.type === "element_add") {
      setElements(prev => prev.filter(el => el.id !== lastAction.elementId));
    } else if (lastAction.type === "element_delete" && lastAction.element) {
      setElements(prev => [...prev, lastAction.element as CreateElement]);
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

  // Compile PDF from scratch
  const handleSavePdf = async () => {
    if (pages.length === 0) return;

    const pageDimensions = pages.map((p) => {
      const container = document.getElementById(`pdf-page-container-${p.id}`);
      return {
        clientWidth: container?.clientWidth || 560,
        clientHeight: container?.clientHeight || 792
      };
    });

    setConverting(true);
    setProgressMsg("Compiling document layers...");

    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();

      // Embed Fonts & variants (Bold / Italic)
      const fonts = {
        Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
        HelveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        HelveticaOblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
        HelveticaBoldOblique: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
        Courier: await pdfDoc.embedFont(StandardFonts.Courier),
        CourierBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
        CourierOblique: await pdfDoc.embedFont(StandardFonts.CourierOblique),
        CourierBoldOblique: await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
        TimesRoman: await pdfDoc.embedFont(StandardFonts.TimesRoman),
        TimesRomanBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
        TimesRomanItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
        TimesRomanBoldItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic)
      };

      const getFontRef = (family: FontFamily, style?: FontStyle) => {
        if (family === "Courier") {
          if (style === "bold") return fonts.CourierBold;
          if (style === "italic") return fonts.CourierOblique;
          if (style === "boldItalic") return fonts.CourierBoldOblique;
          return fonts.Courier;
        }
        if (family === "TimesRoman") {
          if (style === "bold") return fonts.TimesRomanBold;
          if (style === "italic") return fonts.TimesRomanItalic;
          if (style === "boldItalic") return fonts.TimesRomanBoldItalic;
          return fonts.TimesRoman;
        }
        // Default Helvetica
        if (style === "bold") return fonts.HelveticaBold;
        if (style === "italic") return fonts.HelveticaOblique;
        if (style === "boldItalic") return fonts.HelveticaBoldOblique;
        return fonts.Helvetica;
      };

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

      for (let i = 0; i < pages.length; i++) {
        const pageMeta = pages[i];
        const pageDims = pageDimensions[i];
        
        // Add A4 blank page (595.28 width, 841.89 height)
        const pdfPage = pdfDoc.addPage([595.28, 841.89]);
        const { width: pdfW, height: pdfH } = pdfPage.getSize();

        const scaleX = pdfW / pageDims.clientWidth;
        const scaleY = pdfH / pageDims.clientHeight;

        // 1. Draw pen canvas strokes
        const savedDrawing = canvasDrawings[pageMeta.id];
        if (savedDrawing) {
          const base64Bytes = savedDrawing.split(",")[1];
          const pngBytes = Uint8Array.from(atob(base64Bytes), c => c.charCodeAt(0));
          const embeddedImg = await pdfDoc.embedPng(pngBytes);
          pdfPage.drawImage(embeddedImg, { x: 0, y: 0, width: pdfW, height: pdfH });
        }

        // 2. Draw text, image, and shape elements
        const pageElements = elements.filter(el => el.pageId === pageMeta.id);
        for (const el of pageElements) {
          const elX = (el.x / 100) * pageDims.clientWidth * scaleX;
          const elY = (pageDims.clientHeight - (el.y / 100) * pageDims.clientHeight - el.height) * scaleY;
          const elW = el.width * scaleX;
          const elH = el.height * scaleY;

          if (el.type === "text" && el.text) {
            const regularFont = getFontRef(el.fontFamily || "Helvetica", el.fontStyle?.includes("italic") ? "italic" : "normal");
            const boldFont = getFontRef(el.fontFamily || "Helvetica", el.fontStyle?.includes("italic") ? "boldItalic" : "bold");
            const fSize = (el.fontSize || 14) * scaleY;

            const segments = parseRichText(el.text);

            // Compute total measured text width for alignment offsets
            let totalWidth = 0;
            for (const seg of segments) {
              const currentFont = seg.isBold ? boldFont : regularFont;
              totalWidth += currentFont.widthOfTextAtSize(seg.text, fSize);
            }

            let alignOffsetX = 4 * scaleX;
            if (el.alignment === "center") {
              alignOffsetX = (elW - totalWidth) / 2;
            } else if (el.alignment === "right") {
              alignOffsetX = elW - totalWidth - 4 * scaleX;
            }
            
            if (el.bgColor && el.bgColor !== "transparent") {
              pdfPage.drawRectangle({
                x: elX,
                y: elY,
                width: elW,
                height: elH,
                color: parseColor(el.bgColor)
              });
            }

            // Draw segments sequentially
            let currentX = elX + alignOffsetX;
            for (const seg of segments) {
              const currentFont = seg.isBold ? boldFont : regularFont;
              pdfPage.drawText(seg.text, {
                x: currentX,
                y: elY + (el.height - 18) * scaleY,
                size: fSize,
                font: currentFont,
                color: parseColor(el.color || "#000000")
              });
              currentX += currentFont.widthOfTextAtSize(seg.text, fSize);
            }
          } 
          
          else if (el.type === "shape") {
            const isCircle = el.shapeType === "circle";
            const fillColorRGB = el.fillColor ? parseColor(el.fillColor) : undefined;
            const borderColorRGB = el.borderColor ? parseColor(el.borderColor) : undefined;

            if (isCircle) {
              pdfPage.drawEllipse({
                x: elX + elW / 2,
                y: elY + elH / 2,
                xScale: elW / 2,
                yScale: elH / 2,
                color: fillColorRGB,
                borderColor: borderColorRGB,
                borderWidth: 1.5 * scaleX
              });
            } else {
              pdfPage.drawRectangle({
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

            pdfPage.drawImage(embeddedElImg, {
              x: elX,
              y: elY,
              width: elW,
              height: elH
            });
          }
        }
      }

      setProgressMsg("Saving PDF output...");
      const pdfBytesOutput = await pdfDoc.save();
      const pdfBlobOutput = new Blob([pdfBytesOutput] as any, { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlobOutput);

      setOutputBlob(pdfBlobOutput);
      setOutputUrl(url);
    } catch (err: any) {
      console.error(err);
      alert("Failed to build PDF: " + (err.message || err));
    } finally {
      setConverting(false);
      setProgressMsg("");
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    const name = `Created_Document.pdf`;
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
          <div className="w-full space-y-2 text-left flex items-start justify-between">
            <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                  <i className="ri-file-add-line text-blue-600 dark:text-blue-500"></i> Create PDF Document
                  
                  {!outputUrl && (
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="ml-2.5 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-850 rounded-xl text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition shadow-sm text-white"
                      title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Workspace"}
                    >
                      <i className={isFullscreen ? "ri-fullscreen-exit-line" : "ri-fullscreen-line"}></i>
                      {isFullscreen ? "Exit" : "Fullscreen"}
                    </button>
                  )}
                </h1>
                <p className="text-sm text-zinc-700 dark:text-zinc-400">
                  Build custom layout slides, place typography, draw vectors, and compile documents offline.
                </p>
              </div>
            </div>
          </div>

          {/* PAGE THUMBNAILS HORIZONTAL SCROLL TIMELINE */}
          {pages.length > 0 && !outputUrl && !converting && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Document Slides timeline</span>
                <button
                  onClick={handleAddPage}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <i className="ri-add-line"></i> Add Slide Page
                </button>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                {pages.map((page, idx) => {
                  const isActive = idx === activePageIndex;
                  return (
                    <div
                      key={page.id}
                      onClick={() => { setActivePageIndex(idx); setSelectedElementId(null); }}
                      className={`relative group flex-shrink-0 w-24 h-32 rounded-xl border p-2 cursor-pointer transition flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 ${
                        isActive 
                          ? "border-blue-500 ring-2 ring-blue-500/25 bg-blue-500/[0.02]" 
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-extrabold text-zinc-400 leading-none">
                        <span>PAGE {idx + 1}</span>
                        <button
                          onClick={(e) => handleDeletePage(page.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition cursor-pointer text-xs"
                          title="Delete Page"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                      
                      <div className="flex-1 flex items-center justify-center p-1 overflow-hidden">
                        <div className="h-16 w-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded shadow-sm flex flex-col items-center justify-center gap-1 text-[8px] text-zinc-400">
                          {canvasDrawings[page.id] ? (
                            <i className="ri-pencil-line text-purple-500"></i>
                          ) : (
                            <i className="ri-file-line"></i>
                          )}
                          <span>Blank</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {converting && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-sm animate-in fade-in duration-200">
              <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Compiling Document...</p>
                <p className="text-xs text-zinc-505 font-mono">{progressMsg}</p>
              </div>
            </div>
          )}

          {/* Interactive Annotation Workspace */}
          {pages.length > 0 && !outputUrl && !converting && (
            <div className="w-full space-y-6 flex flex-col items-center">
              
              {/* Toolbar Control Panel HUD */}
              <div className="w-full flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-in fade-in">
                
                {/* Tool Selection Tabs */}
                <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl">
                  {[
                    { id: "select", icon: "ri-drag-move-2-line", label: "Select & Move" },
                    { id: "text", icon: "ri-text", label: "Add Text" },
                    { id: "image", icon: "ri-image-add-line", label: "Add Image" },
                    { id: "shape", icon: "ri-shapes-line", label: "Add Shape" },
                    { id: "draw", icon: "ri-pencil-line", label: "Freehand Pen" },
                    { id: "eraser", icon: "ri-eraser-line", label: "Eraser" },
                  ].map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => { setActiveTool(tool.id as CreateTool); setSelectedElementId(null); }}
                      title={tool.label}
                      className={`h-8 px-2.5 rounded-lg flex items-center justify-center transition cursor-pointer text-sm font-bold gap-1 ${
                        activeTool === tool.id
                          ? "bg-white dark:bg-zinc-800 text-blue-700 shadow-sm"
                          : "text-zinc-700 hover:text-zinc-850 dark:hover:text-zinc-250 dark:text-zinc-200"
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
                  className="h-8 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 text-zinc-500 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition"
                >
                  <i className="ri-arrow-go-back-line"></i>
                  <span className="text-[10px] font-bold">Undo</span>
                </button>

                {/* Color Palette Selectors */}
                {(activeTool === "draw" || activeTool === "shape") && (
                  <div className="flex gap-1.5 animate-in slide-in-from-left duration-150">
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
                      className="w-16 h-1 appearance-none bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer accent-blue-600"
                    />
                  </div>
                )}

                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoom(z => Math.max(50, z - 10))}
                    className="h-8 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    A-
                  </button>
                  <span className="text-[10px] font-bold text-zinc-400 w-10 text-center select-none font-mono">{zoom}%</span>
                  <button
                    onClick={() => setZoom(z => Math.min(150, z + 10))}
                    className="h-8 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    A+
                  </button>
                </div>

                {/* Save PDF Stamp */}
                <button
                  onClick={handleSavePdf}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <i className="ri-checkbox-circle-line"></i> Compile PDF
                </button>

              </div>

              {/* Selected Element Editor Panel */}
              {(() => {
                if (!selectedElementId) return null;
                const el = elements.find(item => item.id === selectedElementId);
                if (!el) return null;

                return (
                  <div className="w-full bg-blue-50/50 dark:bg-blue-950/10 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900/40 flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top duration-150 text-left">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
                      <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Editing Selected {el.type}
                      </span>
                    </div>

                    {el.type === "text" && (
                      <div className="flex-1 flex flex-wrap items-center gap-4">
                        {/* Text Value */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Text:</span>
                          <input
                            ref={editorInputRef}
                            type="text"
                            value={el.text || ""}
                            onChange={(e) => {
                              setElements(prev => prev.map(item => item.id === el.id ? { ...item, text: e.target.value } : item));
                            }}
                            className="px-2 py-1 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none font-bold text-zinc-900 dark:text-white"
                          />
                          <button
                            onClick={() => handleMakeBoldSelection(editorInputRef.current)}
                            className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-305 rounded text-[10px] font-black border border-zinc-300 dark:border-zinc-700 transition cursor-pointer"
                            title="Format selection to bold"
                          >
                            <i className="ri-bold"></i> selection
                          </button>
                        </div>

                        {/* Font Family */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Font:</span>
                          <select
                            value={el.fontFamily || "Helvetica"}
                            onChange={(e) => {
                              setElements(prev => prev.map(item => item.id === el.id ? { ...item, fontFamily: e.target.value as FontFamily } : item));
                            }}
                            className="px-2 py-1 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none font-bold text-zinc-800 dark:text-zinc-300 cursor-pointer"
                          >
                            <option value="Helvetica">Helvetica</option>
                            <option value="Courier">Courier</option>
                            <option value="TimesRoman">Times Roman</option>
                          </select>
                        </div>

                        {/* Font Size */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Size:</span>
                          <select
                            value={el.fontSize || 14}
                            onChange={(e) => {
                              setElements(prev => prev.map(item => item.id === el.id ? { ...item, fontSize: parseInt(e.target.value) } : item));
                            }}
                            className="px-2 py-1 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none font-bold text-zinc-800 dark:text-zinc-300 cursor-pointer"
                          >
                            {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36].map(sz => (
                              <option key={sz} value={sz}>{sz}px</option>
                            ))}
                          </select>
                        </div>

                        {/* Styles & Alignment toggles */}
                        <div className="flex items-center gap-1.5">
                          {/* Italics toggle */}
                          <button
                            onClick={() => {
                              const newStyle: FontStyle = el.fontStyle === "italic" ? "normal" : el.fontStyle === "boldItalic" ? "bold" : el.fontStyle === "bold" ? "boldItalic" : "italic";
                              setElements(prev => prev.map(item => item.id === el.id ? { ...item, fontStyle: newStyle } : item));
                            }}
                            className={`h-7 w-7 rounded-lg flex items-center justify-center transition cursor-pointer text-xs font-bold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 ${
                              el.fontStyle?.includes("italic") ? "text-blue-600 border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "text-zinc-500"
                            }`}
                            title="Italics Toggle"
                          >
                            <i className="ri-italic"></i>
                          </button>
                        </div>

                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                          {/* Left Align */}
                          <button
                            onClick={() => {
                              setElements(prev => prev.map(item => item.id === el.id ? { ...item, alignment: "left" } : item));
                            }}
                            className={`h-6 w-6 rounded-lg flex items-center justify-center transition cursor-pointer text-xs ${
                              el.alignment === "left" || !el.alignment ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm font-bold" : "text-zinc-500"
                            }`}
                          >
                            <i className="ri-align-left"></i>
                          </button>
                          {/* Center Align */}
                          <button
                            onClick={() => {
                              setElements(prev => prev.map(item => item.id === el.id ? { ...item, alignment: "center" } : item));
                            }}
                            className={`h-6 w-6 rounded-lg flex items-center justify-center transition cursor-pointer text-xs ${
                              el.alignment === "center" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm font-bold" : "text-zinc-500"
                            }`}
                          >
                            <i className="ri-align-center"></i>
                          </button>
                          {/* Right Align */}
                          <button
                            onClick={() => {
                              setElements(prev => prev.map(item => item.id === el.id ? { ...item, alignment: "right" } : item));
                            }}
                            className={`h-6 w-6 rounded-lg flex items-center justify-center transition cursor-pointer text-xs ${
                              el.alignment === "right" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm font-bold" : "text-zinc-500"
                            }`}
                          >
                            <i className="ri-align-right"></i>
                          </button>
                        </div>

                        {/* Colors */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Color:</span>
                          <div className="flex gap-1">
                            {[
                              { val: "#000000", label: "Charcoal" },
                              { val: "#002fa7", label: "Royal Blue" },
                              { val: "#a00000", label: "Crimson" },
                              { val: "#006400", label: "Forest" }
                            ].map((color) => (
                              <button
                                key={color.val}
                                onClick={() => {
                                  setElements(prev => prev.map(item => item.id === el.id ? { ...item, color: color.val } : item));
                                }}
                                className={`h-5.5 w-5.5 rounded-full border border-white dark:border-zinc-900 cursor-pointer transition ${
                                  el.color === color.val ? "scale-110 ring-2 ring-blue-500/25" : ""
                                }`}
                                style={{ backgroundColor: color.val }}
                                title={color.label}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {el.type === "shape" && (
                      <div className="flex-1 flex flex-wrap items-center gap-4">
                        {/* Shape Type */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Type:</span>
                          <select
                            value={el.shapeType || "rectangle"}
                            onChange={(e) => {
                              setElements(prev => prev.map(item => item.id === el.id ? { ...item, shapeType: e.target.value as ShapeType } : item));
                            }}
                            className="px-2 py-1 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none font-bold text-zinc-800 dark:text-zinc-300 cursor-pointer"
                          >
                            <option value="rectangle">Rectangle</option>
                            <option value="circle">Circle</option>
                          </select>
                        </div>

                        {/* Fill Styles */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Fill:</span>
                          <div className="flex gap-1.5">
                            {[
                              { val: "transparent", label: "Outline" },
                              { val: "rgba(59, 130, 246, 0.4)", label: "Blue" },
                              { val: "rgba(234, 179, 8, 0.4)", label: "Yellow" },
                              { val: "rgba(0, 0, 0, 0.1)", label: "Gray" }
                            ].map(col => (
                              <button
                                key={col.val}
                                onClick={() => {
                                  setElements(prev => prev.map(item => item.id === el.id ? { ...item, fillColor: col.val } : item));
                                }}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer ${
                                  el.fillColor === col.val ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-extrabold" : "bg-white dark:bg-zinc-950 text-zinc-500"
                                }`}
                              >
                                {col.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setSelectedElementId(null)}
                      className="px-2.5 py-1 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-[10px] font-bold text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>
                );
              })()}

              {/* Applied Modifications Badge Area */}
              {(elements.length > 0 || Object.keys(canvasDrawings).length > 0) && (
                <div className="w-full bg-zinc-100/60 dark:bg-zinc-900/40 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 flex flex-wrap items-center gap-2 text-left animate-in fade-in">
                  <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mr-1 select-none">Applied Layers:</span>
                  
                  {/* Vector Elements */}
                  {elements.map((el) => {
                    const pageIndexNum = pages.findIndex(p => p.id === el.pageId) + 1;
                    return (
                      <span
                        key={el.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-sm font-semibold"
                      >
                        <i className={
                          el.type === "text" ? "ri-text text-blue-500" :
                          el.type === "shape" ? "ri-shapes-line text-amber-500" :
                          "ri-image-line text-emerald-500"
                        }></i>
                        <span className="truncate max-w-[120px]">
                          {el.type === "text" ? `Text: "${el.text}"` : el.type === "shape" ? `Shape: ${el.shapeType}` : "Image Layer"}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-normal select-none">(Page {pageIndexNum})</span>
                        <button
                          onClick={() => deleteElement(el.id)}
                          className="text-zinc-400 hover:text-red-505 transition cursor-pointer font-bold leading-none text-sm ml-0.5"
                          title="Remove Layer"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}

                  {/* Pen Drawings */}
                  {Object.entries(canvasDrawings).map(([pId, dataUrl]) => {
                    if (!dataUrl) return null;
                    const pageIdx = pages.findIndex(p => p.id === pId);
                    if (pageIdx === -1) return null;
                    return (
                      <span
                        key={`drawing-${pId}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-sm"
                      >
                        <i className="ri-pencil-line text-purple-500"></i>
                        <span>Pen Drawing</span>
                        <span className="text-[9px] text-zinc-400 font-normal select-none">(Page {pageIdx + 1})</span>
                        <button
                          onClick={() => {
                            setCanvasDrawings(prev => {
                              const copy = { ...prev };
                              delete copy[pId];
                              return copy;
                            });
                            if (pId === pages[activePageIndex]?.id) {
                              const canvas = canvasRefs.current[pId];
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
                const activePage = pages[activePageIndex];
                if (!activePage) return null;

                return (
                  <div className="w-full flex flex-col items-center justify-center bg-zinc-100/50 dark:bg-zinc-950/20 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-auto h-[600px] max-h-[70vh]">
                    <div className="text-center mb-2">
                      <span className="text-[10px] block mb-2 font-bold text-zinc-400 uppercase tracking-wider select-none">
                        PAGE {activePageIndex + 1} OF {pages.length}
                      </span>

                      <div
                        id={`pdf-page-container-${activePage.id}`}
                        className="relative mx-auto bg-white border border-zinc-300 shadow-md select-none overflow-hidden"
                        style={{ 
                          width: `${560 * (zoom / 100)}px`,
                          height: `${(560 * (activePage.h / activePage.w)) * (zoom / 100)}px`
                        }}
                      >
                        {/* Blank Canvas Drawing Layer */}
                        <canvas
                          ref={(el) => { canvasRefs.current[activePage.id] = el; }}
                          width={activePage.w}
                          height={activePage.h}
                          onMouseDown={(e) => handlePageMouseDown(activePage.id, e)}
                          onMouseMove={(e) => handlePageMouseMove(activePage.id, e)}
                          onMouseUp={() => handlePageMouseUp(activePage.id)}
                          onMouseLeave={() => handlePageMouseUp(activePage.id)}
                          className={`absolute inset-0 w-full h-full bg-white ${
                            activeTool === "draw" || activeTool === "eraser" 
                              ? "z-35 cursor-crosshair pointer-events-auto" 
                              : "z-10 pointer-events-none"
                          }`}
                        />

                        {/* Click overlay layer */}
                        {activeTool !== "select" && activeTool !== "draw" && activeTool !== "eraser" && (
                          <div
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const clickX = e.clientX - rect.left;
                              const clickY = e.clientY - rect.top;
                              const pctX = (clickX / rect.width) * 100;
                              const pctY = (clickY / rect.height) * 100;

                              setPendingCoords({ pageId: activePage.id, x: pctX, y: pctY });
                              if (activeTool === "text") {
                                setTextVal("");
                                setIsTextModalOpen(true);
                              } else if (activeTool === "shape") {
                                setIsShapeModalOpen(true);
                              } else if (activeTool === "image") {
                                imageUploadRef.current?.click();
                              }
                            }}
                            className="absolute inset-0 w-full h-full z-25 cursor-cell bg-black/5"
                          />
                        )}

                        {/* Interactive Drag & Resize Elements layer */}
                        {elements.filter(el => el.pageId === activePage.id).map((el) => {
                          const isSelected = selectedElementId === el.id;

                          return (
                            <div
                              key={el.id}
                              className={`absolute select-none z-30 flex items-center justify-center ${
                                isSelected ? "border-2 border-dashed border-blue-500 shadow-md bg-blue-500/5" : "hover:border hover:border-zinc-400"
                              }`}
                              style={{
                                left: `${el.x}%`,
                                top: `${el.y}%`,
                                width: `${el.width * (zoom / 100)}px`,
                                height: `${el.height * (zoom / 100)}px`,
                              }}
                            >
                              
                              {/* Unified Drag handle */}
                              {activeTool === "select" && (
                                <div
                                  onMouseDown={(e) => handleDragElement(el.id, e)}
                                  className="absolute inset-0 w-full h-full bg-transparent z-10 cursor-move"
                                />
                              )}

                              {/* Render Text element */}
                              {el.type === "text" && (
                                <div
                                  className="w-full h-full px-2 py-1 select-none break-words pointer-events-none"
                                  style={{
                                    color: el.color,
                                    backgroundColor: el.bgColor !== "transparent" ? el.bgColor : "transparent",
                                    fontSize: el.fontSize ? `${el.fontSize * (zoom / 100)}px` : "inherit",
                                    fontFamily: el.fontFamily || "inherit",
                                    fontStyle: el.fontStyle?.includes("italic") ? "italic" : "normal",
                                    textAlign: el.alignment || "left"
                                  }}
                                >
                                   {renderFormattedText(el.text || "")}
                                </div>
                              )}

                              {/* Render Shape Element */}
                              {el.type === "shape" && (
                                <div
                                  className="w-full h-full select-none pointer-events-none"
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
                                  alt="visual node"
                                  className="w-full h-full object-contain pointer-events-none select-none animate-in fade-in"
                                />
                              )}

                              {/* Resize Corner Handle */}
                              {isSelected && activeTool === "select" && (
                                <>
                                  <div
                                    onMouseDown={(e) => handleResizeElement(el.id, e)}
                                    className="absolute bottom-0 right-0 h-4 w-4 bg-blue-600 border border-white cursor-se-resize rounded-tl-md flex items-center justify-center shadow z-40"
                                  >
                                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 13v6m0 0h-6m6 0L13 13" />
                                    </svg>
                                  </div>
                                  
                                  <button
                                    onMouseDown={(e) => e.stopPropagation()}
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
                  </div>
                );
              })()}

            </div>
          )}

          {/* Image file upload */}
          <input
            type="file"
            ref={imageUploadRef}
            accept="image/png,image/jpeg"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Success Screen */}
          {outputUrl && (
            <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-6 shadow-sm">
              <div className="flex justify-center text-emerald-500 text-5xl">
                <i className="ri-checkbox-circle-fill text-emerald-500"></i>
              </div>
              <div className="space-y-1.5 text-center">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">PDF Compiled Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">Your custom document slides have been compiled offline in RAM.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download="Created_Document.pdf"
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
                  setPages([{ id: Math.random().toString(36).substring(2, 9), w: 595, h: 842 }]);
                  setElements([]);
                  setHistory([]);
                  setCanvasDrawings({});
                  setActivePageIndex(0);
                }}
                className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto font-bold"
              >
                Create Another PDF
              </button>
            </div>
          )}
        </main>

        {/* RIGHT AD COLUMN */}
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

      {/* POPUP MODAL: ADD CUSTOM TEXT BLOCK */}
      {isTextModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-150 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <i className="ri-text text-blue-500"></i>
                <h3 className="font-black text-zinc-900 dark:text-white text-sm">Insert Text Block</h3>
              </div>
              <button onClick={() => { setIsTextModalOpen(false); setPendingCoords(null); }} className="text-zinc-400 hover:text-zinc-600 text-lg font-bold leading-none">&times;</button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Format Presets</label>
              <div className="flex gap-2">
                {[
                  { label: "Title", size: 28, style: "normal" as FontStyle },
                  { label: "Heading", size: 18, style: "normal" as FontStyle },
                  { label: "Subtitle", size: 14, style: "italic" as FontStyle },
                  { label: "Body Text", size: 12, style: "normal" as FontStyle }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setTextFontSize(preset.size);
                      setTextFontStyle(preset.style);
                    }}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-[10px] font-bold transition text-zinc-700 dark:text-zinc-300 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Type Text Content</label>
                <button
                  onClick={() => handleMakeBoldSelection(modalTextareaRef.current)}
                  className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded text-[9px] font-bold text-zinc-650 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                  title="Make selected text bold (**text**)"
                >
                  <i className="ri-bold"></i> Format Selection
                </button>
              </div>
              <textarea
                ref={modalTextareaRef}
                rows={3}
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                placeholder="Enter text here... select a word and click Format Selection to make only that portion bold!"
                autoFocus
                className="w-full px-3 py-2 text-sm bg-zinc-55 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-zinc-900 dark:text-white font-bold resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Font Family</label>
                <select
                  value={textFontFamily}
                  onChange={(e) => setTextFontFamily(e.target.value as FontFamily)}
                  className="w-full px-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold text-zinc-800 dark:text-zinc-300 cursor-pointer"
                >
                  <option value="Helvetica">Helvetica (Standard)</option>
                  <option value="Courier">Courier (Monospace)</option>
                  <option value="TimesRoman">Times New Roman</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Font Size</label>
                <select
                  value={textFontSize}
                  onChange={(e) => setTextFontSize(parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold text-zinc-800 dark:text-zinc-300 cursor-pointer"
                >
                  {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36].map(sz => (
                    <option key={sz} value={sz}>{sz}px</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Font Style Weights & Text Alignment */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Font Style Toggle */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Font Style</label>
                <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  {[
                    { id: "normal", label: "Normal", icon: "ri-font-size" },
                    { id: "italic", label: "Italic", icon: "ri-italic" }
                  ].map((styleItem) => (
                    <button
                      key={styleItem.id}
                      onClick={() => setTextFontStyle(styleItem.id as FontStyle)}
                      title={styleItem.label}
                      className={`h-7 flex-1 rounded-lg flex items-center justify-center transition cursor-pointer text-xs font-bold ${
                        textFontStyle === styleItem.id
                          ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      <i className={styleItem.icon}></i>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Alignment */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Alignment</label>
                <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  {[
                    { id: "left", icon: "ri-align-left" },
                    { id: "center", icon: "ri-align-center" },
                    { id: "right", icon: "ri-align-right" }
                  ].map((alignItem) => (
                    <button
                      key={alignItem.id}
                      onClick={() => setTextAlignment(alignItem.id as TextAlignment)}
                      className={`h-7 flex-1 rounded-lg flex items-center justify-center transition cursor-pointer text-xs font-bold ${
                        textAlignment === alignItem.id
                          ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      <i className={alignItem.icon}></i>
                    </button>
                  ))}
                </div>
              </div>
            </div>

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
                    className={`px-3 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      textColor === color.val ? "ring-2 ring-blue-500/30 text-blue-500 border-blue-400" : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.val }} />
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

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
                    className={`px-3 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      textBgColor === color.val ? "ring-2 ring-blue-500/30 text-blue-500 border-blue-400" : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex justify-end gap-3">
              <button onClick={() => { setIsTextModalOpen(false); setPendingCoords(null); }} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs cursor-pointer">Cancel</button>
              <button onClick={handleSaveTextElement} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer">Insert</button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: ADD CUSTOM SHAPE BLOCK */}
      {isShapeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-150 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <i className="ri-shapes-line text-blue-500"></i>
                <h3 className="font-black text-zinc-900 dark:text-white text-sm">Add Shape Layer</h3>
              </div>
              <button onClick={() => { setIsShapeModalOpen(false); setPendingCoords(null); }} className="text-zinc-400 hover:text-zinc-600 text-lg font-bold leading-none">&times;</button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 block">Shape Type</label>
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

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 block">Fill Style</label>
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
                    className={`px-3 py-1 bg-zinc-55 hover:bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      shapeFillColor === col.val ? "ring-2 ring-blue-500/30 text-blue-500 border-blue-400" : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex justify-end gap-3">
              <button onClick={() => { setIsShapeModalOpen(false); setPendingCoords(null); }} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs cursor-pointer">Cancel</button>
              <button onClick={handleSaveShapeElement} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer">Insert Shape</button>
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
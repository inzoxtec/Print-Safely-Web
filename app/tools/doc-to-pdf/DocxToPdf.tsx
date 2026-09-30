// app/tools/doc-to-pdf/DocxPdf.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ToolLayout from "@/app/components/ToolLayout";

export default function DocxPdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);

  // Action states
  const [converting, setConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

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
    setProgressMsg("Loading extraction libraries...");
    await loadScript("/vendor/docx/jszip.min.js", "JSZip");
    await loadScript("/vendor/docx/docx-preview.min.js", "docx");
    await loadScript("/vendor/docx/html2pdf.bundle.min.js", "html2pdf");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext === "doc") {
      alert("Legacy binary .doc files are not supported directly. Please open your document in Microsoft Word or Google Docs and save/export as a modern .docx file before converting.");
      return;
    }
    if (ext !== "docx") {
      alert("Only Microsoft Word document files (.docx format) are supported.");
      return;
    }

    setFile(selectedFile);
    setOutputUrl(null);
    setOutputBlob(null);
  };

  // Resolve a blob: URL into a base64 data: URL so it survives being
  // screenshotted by html2canvas (blob URLs can be revoked/unavailable by
  // the time the canvas walk happens).
  const blobToDataUrl = (blobUrl: string): Promise<string> =>
    fetch(blobUrl)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      );

  // Helper to poll until docx-preview async image load callbacks finish setting src attributes
  const waitForAllImagesToLoad = async (container: HTMLElement, timeoutMs = 8000): Promise<void> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const imgElements = Array.from(container.querySelectorAll("img"));
      const svgImageElements = Array.from(container.querySelectorAll("svg image")) as unknown as SVGImageElement[];
      
      const pendingImgs = imgElements.filter(
        (img) => !img.src || img.src === "" || img.src === window.location.href
      );
      const pendingSvgImgs = svgImageElements.filter(
        (svgImg) => !svgImg.getAttribute("href") && !svgImg.getAttribute("xlink:href")
      );

      if (pendingImgs.length === 0 && pendingSvgImgs.length === 0) {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  // Helper to convert inline <svg> shape/chart elements into high-resolution <img> tags for html2canvas rendering
  const convertSvgNodesToImages = async (container: HTMLElement): Promise<void> => {
    const svgElements = Array.from(container.querySelectorAll("svg"));

    for (const svg of svgElements) {
      try {
        // 1. Resolve all <image> href/xlink:href blob: URLs INSIDE the SVG to base64 Data URLs FIRST!
        const svgImages = Array.from(svg.querySelectorAll("image"));
        for (const svgImg of svgImages) {
          const href = svgImg.getAttribute("href") || svgImg.getAttribute("xlink:href");
          if (href && href.startsWith("blob:")) {
            try {
              const base64 = await blobToDataUrl(href);
              svgImg.setAttribute("href", base64);
              svgImg.setAttributeNS("http://www.w3.org/1999/xlink", "href", base64);
            } catch (e) {
              console.warn("Failed to convert inner SVG blob image:", e);
            }
          }
          svgImg.style.visibility = "visible";
          svgImg.style.opacity = "1";
        }

        // 2. Measure dimensions accurately
        let rect = svg.getBoundingClientRect();
        let width = Math.ceil(rect.width) || parseInt(svg.getAttribute("width") || "0") || 400;
        let height = Math.ceil(rect.height) || parseInt(svg.getAttribute("height") || "0") || 300;

        if (width <= 0 || height <= 0) {
          try {
            const bbox = (svg as any).getBBox?.();
            if (bbox && bbox.width > 0 && bbox.height > 0) {
              width = Math.ceil(bbox.x + bbox.width);
              height = Math.ceil(bbox.y + bbox.height);
            }
          } catch (e) {}
        }

        if (width <= 0) width = 450;
        if (height <= 0) height = 300;

        svg.setAttribute("width", `${width}`);
        svg.setAttribute("height", `${height}`);
        if (!svg.getAttribute("viewBox")) {
          svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        }

        // Check if SVG is purely a wrapper for a single standalone picture image (no vector chart elements)
        const hasVectorNodes = svg.querySelectorAll("path, rect, circle, line, polygon, polyline, text, g").length > 2;

        if (!hasVectorNodes && svgImages.length === 1 && width > 0 && height > 0) {
          const singleImg = svgImages[0];
          const href = singleImg.getAttribute("href") || singleImg.getAttribute("xlink:href");
          if (href && href.startsWith("data:image/")) {
            const img = document.createElement("img");
            img.src = href;
            img.style.width = `${width}px`;
            img.style.height = `${height}px`;
            img.style.maxWidth = "100%";
            img.style.display = svg.style.display || "inline-block";
            img.style.verticalAlign = "middle";
            img.style.visibility = "visible";
            img.style.opacity = "1";
            svg.parentNode?.replaceChild(img, svg);
            continue;
          }
        }

        // 3. Render vector SVG (charts, diagrams, shape drawings) onto a high-res 2x canvas via Blob URL
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svg);
        if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
          svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);

        const canvas = document.createElement("canvas");
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.scale(2, 2);
          const tempImg = new Image();
          tempImg.crossOrigin = "anonymous";

          await new Promise<void>((resolve) => {
            tempImg.onload = () => {
              try {
                ctx.drawImage(tempImg, 0, 0, width, height);
              } catch (e) {}
              URL.revokeObjectURL(svgUrl);
              resolve();
            };
            tempImg.onerror = () => {
              URL.revokeObjectURL(svgUrl);
              resolve();
            };
            tempImg.src = svgUrl;
          });

          const pngDataUrl = canvas.toDataURL("image/png");

          // Only replace with image if canvas successfully drew content (not transparent blank)
          if (pngDataUrl && pngDataUrl.length > 500) {
            const img = document.createElement("img");
            img.src = pngDataUrl;
            img.style.width = `${width}px`;
            img.style.height = `${height}px`;
            img.style.maxWidth = "100%";
            img.style.display = svg.style.display || "inline-block";
            img.style.verticalAlign = "middle";
            img.style.visibility = "visible";
            img.style.opacity = "1";

            svg.parentNode?.replaceChild(img, svg);
          }
        }
      } catch (err) {
        console.warn("SVG shape conversion notice:", err);
      }
    }
  };

  // Helper to extract shapes, drawings, textboxes, and embedded media graphics directly from OpenXML zip package
  const fixEmptyShapeContainers = async (container: HTMLElement, arrayBuffer: ArrayBuffer): Promise<void> => {
    try {
      const JSZip = (window as any).JSZip;
      if (!JSZip) return;

      const zip = await JSZip.loadAsync(arrayBuffer);
      const docXmlFile = zip.file("word/document.xml");
      if (!docXmlFile) return;

      const docXmlText = await docXmlFile.async("string");
      const xmlDoc = new DOMParser().parseFromString(docXmlText, "text/xml");

      // Build relationship ID to file target map
      const relsFile = zip.file("word/_rels/document.xml.rels");
      const relsMap: Record<string, string> = {};
      if (relsFile) {
        const relsText = await relsFile.async("string");
        const relsDoc = new DOMParser().parseFromString(relsText, "text/xml");
        const relElements = Array.from(relsDoc.querySelectorAll("Relationship"));
        relElements.forEach((rel) => {
          const id = rel.getAttribute("Id");
          const target = rel.getAttribute("Target");
          if (id && target) relsMap[id] = target.replace(/^word\//, "");
        });
      }

      // Find top-level shape/drawing XML elements in exact document order
      const shapeXmlNodes = Array.from(
        xmlDoc.querySelectorAll("drawing, pict, shape, wsp, txbxContent")
      ).filter((node) => {
        let parent = node.parentNode;
        while (parent) {
          const tag = parent.nodeName.toLowerCase();
          if (tag === "drawing" || tag === "pict" || tag === "shape" || tag === "wsp" || tag === "txbxcontent") {
            return false;
          }
          parent = parent.parentNode;
        }
        return true;
      });

      const shapeInfos: Array<{ text: string; bg: string; border: string; imgDataUrl?: string }> = [];

      for (const node of shapeXmlNodes) {
        const textNodes = Array.from(node.querySelectorAll("t"));
        const text = textNodes.map((n) => n.textContent).filter(Boolean).join(" ");

        let bg = "";
        let border = "";
        let imgDataUrl: string | undefined = undefined;

        // Check for solid fill
        const solidFill = node.querySelector("solidFill srgbClr");
        if (solidFill) {
          const val = solidFill.getAttribute("val");
          if (val) bg = `#${val}`;
        }

        const fillcolor = node.getAttribute("fillcolor");
        if (fillcolor) {
          bg = fillcolor.startsWith("#") ? fillcolor : `#${fillcolor}`;
        }

        // Check for border / line stroke
        const lnClr = node.querySelector("ln solidFill srgbClr");
        if (lnClr) {
          const val = lnClr.getAttribute("val");
          if (val) border = `1px solid #${val}`;
        }

        // Check for relationship image ID (blip, imagedata, fill)
        const blip = node.querySelector("blip, imagedata, fill");
        const embedId =
          blip?.getAttribute("r:embed") ||
          blip?.getAttribute("r:id") ||
          blip?.getAttribute("id") ||
          blip?.getAttribute("r:href");

        if (embedId && relsMap[embedId]) {
          const relTarget = relsMap[embedId];
          const mediaPath = relTarget.startsWith("media/")
            ? `word/${relTarget}`
            : `word/${relTarget.replace(/^\//, "")}`;
          const mediaFile = zip.file(mediaPath) || zip.file(relTarget);
          if (mediaFile) {
            const base64 = await mediaFile.async("base64");
            const ext = mediaPath.split(".").pop()?.toLowerCase() || "png";
            const mime =
              ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : ext === "svg"
                ? "image/svg+xml"
                : "image/png";
            imgDataUrl = `data:${mime};base64,${base64}`;
          }
        }

        shapeInfos.push({ text, bg, border, imgDataUrl });
      }

      // Find top-level drawing/shape DOM elements rendered by docx-preview
      const allDrawingEls = Array.from(
        container.querySelectorAll<HTMLElement>(".docx-drawing, .docx-shape, .docx-pict, div, span, article")
      ).filter((el) => {
        const style = el.style;
        const width = parseInt(style.width) || el.offsetWidth;
        const height = parseInt(style.height) || el.offsetHeight;
        if (width <= 15 || height <= 15) return false;

        const isClassMatch =
          el.classList.contains("docx-drawing") ||
          el.classList.contains("docx-shape") ||
          el.classList.contains("docx-pict");
        const isInlineShape = style.width !== "" && style.height !== "";

        if (!isClassMatch && !isInlineShape) return false;

        // Must be top-level (not nested inside another drawing element)
        let parent = el.parentElement;
        while (parent && parent !== container) {
          if (
            parent.classList.contains("docx-drawing") ||
            parent.classList.contains("docx-shape") ||
            parent.classList.contains("docx-pict")
          ) {
            return false;
          }
          parent = parent.parentElement;
        }

        return true;
      });

      // Populate empty shape divs strictly when 1-to-1 matched index exists and container is currently blank
      allDrawingEls.forEach((domEl, idx) => {
        const info = shapeInfos[idx];
        if (!info) return; // NO BLIND FALLBACK TO shapeInfos[0]!

        // Only skip if domEl contains REAL rendered media (an img with valid src, an svg with vector nodes, or a canvas)
        const validImgs = Array.from(domEl.querySelectorAll("img")).filter((i) => i.src && i.src.length > 50);
        const validSvgs = Array.from(domEl.querySelectorAll("svg")).filter((s) => s.querySelectorAll("path, rect, circle, line, polygon, polyline, text, image").length > 0);
        const validCanvases = Array.from(domEl.querySelectorAll("canvas"));

        const hasRenderedContent = validImgs.length > 0 || validSvgs.length > 0 || validCanvases.length > 0;
        if (hasRenderedContent) return;

        // If an empty SVG placeholder exists inside domEl, clean it out before populating
        const emptySvgs = Array.from(domEl.querySelectorAll("svg")).filter((s) => s.querySelectorAll("path, rect, circle, line, polygon, polyline, text, image").length === 0);
        emptySvgs.forEach((s) => s.remove());

        // Otherwise, docx-preview left this shape container blank. Render the shape!
        if (info.imgDataUrl) {
          const img = document.createElement("img");
          img.src = info.imgDataUrl;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "contain";
          img.style.display = "block";
          domEl.appendChild(img);
        } else {
          if (info.bg) domEl.style.background = info.bg;
          if (info.border) domEl.style.border = info.border;
          domEl.style.borderRadius = "4px";
          domEl.style.padding = "6px";
          domEl.style.boxSizing = "border-box";
          domEl.style.display = "inline-flex";
          domEl.style.alignItems = "center";
          domEl.style.justifyContent = "center";
          domEl.style.color = "#000000";
          domEl.style.fontSize = "12px";

          if (info.text && !domEl.textContent?.trim()) {
            domEl.textContent = info.text;
          }
        }
      });

    } catch (err) {
      console.warn("Shape XML extraction notice:", err);
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    setConverting(true);
    setProgressMsg("Checking conversion options...");

    // 1. Attempt High-Fidelity Server API Conversion
    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgressMsg("Processing document via High-Fidelity Vector Engine...");
      const apiResponse = await fetch("/api/convert-doc", {
        method: "POST",
        body: formData,
      });

      const contentType = apiResponse.headers.get("content-type");
      if (apiResponse.ok && contentType && contentType.includes("application/pdf")) {
        const pdfBlob = await apiResponse.blob();
        const url = URL.createObjectURL(pdfBlob);
        setOutputBlob(pdfBlob);
        setOutputUrl(url);
        setConverting(false);
        setProgressMsg("");
        return;
      }
    } catch (apiErr) {
      console.warn("Server API conversion route notice:", apiErr);
    }

    // 2. High-Precision Client-Side Fallback Engine
    setProgressMsg("Preparing local client rendering targets...");

    // Hidden off-screen render target. NOTE: no forced width here — the page
    // is sized naturally from the document's own page dimensions below, so
    // Letter-sized docs aren't squeezed into an assumed A4 frame.
    const hiddenContainer = document.createElement("div");
    hiddenContainer.id = "docx-render-container";
    hiddenContainer.style.position = "fixed";
    hiddenContainer.style.left = "0px";
    hiddenContainer.style.top = "0px";
    hiddenContainer.style.zIndex = "-9999";
    hiddenContainer.style.pointerEvents = "none";
    hiddenContainer.style.background = "#FFFFFF";
    hiddenContainer.style.color = "#000000";
    hiddenContainer.style.margin = "0";
    hiddenContainer.style.padding = "0";
    hiddenContainer.style.boxSizing = "border-box";
    document.body.appendChild(hiddenContainer);

    const originalFromCodePoint = String.fromCodePoint;

    try {
      await loadAllEngines();

      setProgressMsg("Unpacking Word document XML...");
      const arrayBuffer = await file.arrayBuffer();

      setProgressMsg("Rendering Word elements locally...");
      const docxEngine = (window as any).docx;
      await docxEngine.renderAsync(arrayBuffer, hiddenContainer, null, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
        experimental: true,
        useBase64URL: true
      });

      setProgressMsg("Loading document image assets...");
      await waitForAllImagesToLoad(hiddenContainer);

      setProgressMsg("Converting vector shapes & chart elements...");
      await convertSvgNodesToImages(hiddenContainer);

      setProgressMsg("Extracting shape graphics & text boxes...");
      await fixEmptyShapeContainers(hiddenContainer, arrayBuffer);

      // Let layout/fonts settle before we measure or screenshot anything.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Read the ACTUAL page size docx-preview computed from the document's
      // own <w:pgSz> (Letter, A4, Legal, custom...) instead of assuming A4.
      // Forcing everything into 210mm was distorting/reflowing text for any
      // doc that wasn't authored as A4 (e.g. the very common US Letter).
      const firstPage = hiddenContainer.querySelector("section.docx") as HTMLElement | null;
      const pageRectPx = firstPage
        ? firstPage.getBoundingClientRect()
        : ({ width: 794, height: 1123 } as DOMRect); // fallback: A4 @ 96dpi
      const PX_TO_MM = 25.4 / 96;
      const pageWidthMm = pageRectPx.width * PX_TO_MM;
      const pageHeightMm = pageRectPx.height * PX_TO_MM;

      // Lock container & wrapper width to exact page width to eliminate extra screen margins
      const measuredWidthPx = Math.ceil(pageRectPx.width);
      hiddenContainer.style.width = `${measuredWidthPx}px`;
      const wrapperEl = hiddenContainer.querySelector(".docx-wrapper") as HTMLElement | null;
      if (wrapperEl) {
        wrapperEl.style.width = `${measuredWidthPx}px`;
        wrapperEl.style.margin = "0";
        wrapperEl.style.padding = "0";
      }

      // Convert any rendered <canvas> elements (VML drawings/shapes) into visible <img> tags
      const canvases = Array.from(hiddenContainer.querySelectorAll("canvas"));
      canvases.forEach((canvas) => {
        try {
          const dataUrl = canvas.toDataURL("image/png");
          const img = document.createElement("img");
          img.src = dataUrl;
          if (canvas.style.width) img.style.width = canvas.style.width;
          if (canvas.style.height) img.style.height = canvas.style.height;
          img.style.display = canvas.style.display || "inline-block";
          canvas.parentNode?.replaceChild(img, canvas);
        } catch (e) {
          console.warn("Canvas conversion notice:", e);
        }
      });

      // Break the PDF exactly at each rendered docx page
      const pages = Array.from(hiddenContainer.querySelectorAll("section.docx")) as HTMLElement[];
      pages.forEach((page, idx) => {
        (page.style as any).breakBefore = idx === 0 ? "avoid" : "page";
        (page.style as any).breakInside = "avoid";
        page.style.margin = "0";
        page.style.boxShadow = "none";
      });

      const styleElement = document.createElement("style");
      styleElement.innerHTML = `
        #docx-render-container {
          font-family: inherit;
          color: #000000 !important;
          background: #ffffff !important;
          text-align: left !important;
        }
        #docx-render-container .docx-wrapper {
          background: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
          text-align: left !important;
        }
        #docx-render-container section.docx {
          box-sizing: border-box !important;
          box-shadow: none !important;
          background: #ffffff !important;
          color: #000000 !important;
          margin: 0 !important;
        }
        #docx-render-container img,
        #docx-render-container svg image {
          max-width: 100% !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        #docx-render-container table {
          border-collapse: collapse !important;
        }
        #docx-render-container p {
          word-break: break-word;
        }
      `;
      hiddenContainer.appendChild(styleElement);

      // --- Resolve every image reference to an inline data: URL and wait
      // for it to fully decode before screenshotting. This now covers BOTH
      // normal <img> tags AND <image> elements inside inline <svg> nodes.
      // docx-preview renders shapes/textboxes/certain pictures as SVG
      // <image href="blob:..."> when `experimental: true` is set — the
      // previous code only ever looked at <img>, which is exactly why some
      // pictures were silently missing from the final PDF.
      const imgElements = Array.from(hiddenContainer.querySelectorAll("img"));
      const svgImageElements = Array.from(
        hiddenContainer.querySelectorAll("svg image")
      ) as unknown as SVGImageElement[];

      await Promise.all([
        ...imgElements.map(async (img) => {
          try {
            img.style.visibility = "visible";
            img.style.opacity = "1";

            if (img.src && img.src.startsWith("blob:")) {
              img.src = await blobToDataUrl(img.src);
            }

            if ((img as any).decode) {
              await (img as any).decode().catch(() => {});
            } else if (!img.complete) {
              await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 3000);
              });
            }
          } catch (e) {
            console.warn("Image processing notice:", e);
          }
        }),
        ...svgImageElements.map(async (svgImg) => {
          try {
            const href = svgImg.getAttribute("href") || svgImg.getAttribute("xlink:href");
            if (href && href.startsWith("blob:")) {
              const dataUrl = await blobToDataUrl(href);
              svgImg.setAttribute("href", dataUrl);
              svgImg.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
            }
            await new Promise((resolve) => {
              svgImg.addEventListener("load", resolve, { once: true });
              setTimeout(resolve, 3000);
            });
          } catch (e) {
            console.warn("SVG image processing notice:", e);
          }
        }),
      ]);

      setProgressMsg("Compiling final vector PDF file...");

      // 1. Temporarily override String.fromCodePoint & console.error to catch and bypass HTML2Canvas non-fatal warnings
      String.fromCodePoint = function (...codePoints: number[]) {
        try {
          return originalFromCodePoint.apply(this, codePoints);
        } catch (err) {
          return "";
        }
      };

      const originalConsoleError = console.error;
      console.error = function (...args: any[]) {
        if (args.length > 0 && typeof args[0] === "string" && args[0].includes("Error loading image")) {
          return;
        }
        originalConsoleError.apply(console, args);
      };

      try {
        // 2. Generate PDF via html2pdf using outputPdf("blob") and margin: 0
        const html2pdfEngine = (window as any).html2pdf;
        const pdfOptions = {
          margin: 0,
          filename: `${file.name.replace(/\.(docx|doc)$/i, "")}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            logging: false,
            imageTimeout: 15000,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
            width: measuredWidthPx,
            windowWidth: measuredWidthPx,
          },
          // Page size now matches the DOCUMENT's own dimensions (Letter, A4,
          // etc.) rather than being hardcoded to A4 — this was the main
          // source of the "text alignment" complaint for non-A4 docs.
          jsPDF: {
            unit: "mm",
            format: [pageWidthMm, pageHeightMm],
            orientation: pageWidthMm > pageHeightMm ? "landscape" : "portrait",
          },
          // Break pages at the CSS break-before rules we set on each
          // section.docx element above, instead of arbitrary pixel slicing.
          pagebreak: { mode: ["css"] },
        };

        const elementToRender = hiddenContainer.querySelector(".docx-wrapper") || hiddenContainer;
        const pdfBlobOutput = await html2pdfEngine()
          .from(elementToRender)
          .set(pdfOptions)
          .outputPdf("blob");

        const url = URL.createObjectURL(pdfBlobOutput);
        setOutputBlob(pdfBlobOutput);
        setOutputUrl(url);

      } finally {
        console.error = originalConsoleError;
      }

    } catch (err) {
      console.error("PDF local compilation failure:", err);
      alert("Failed to convert Word document. Verify it is not corrupted or password-protected.");
    } finally {
      // Dismiss the loading status
      setConverting(false);
      setProgressMsg("");

      // Restore the native String.fromCodePoint function reference
      String.fromCodePoint = originalFromCodePoint;

      // Clear render target container
      if (document.body.contains(hiddenContainer)) {
        document.body.removeChild(hiddenContainer);
      }
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;

    const name = `${file?.name?.replace(".docx", "")}.pdf`;
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
      alert("Failed to queue file database write locally. Please download the file instead.");
    }
  };

  return (
    <ToolLayout
      breadcrumbs={[
              { name: "Home", url: "https://printsafely.app" },
              { name: "Tools", url: "https://printsafely.app#tools-catalog" },
              { name: "DOCX to PDF", url: "https://printsafely.app/tools/doc-to-pdf" },
            ]}
    >
<div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-file-word-line text-blue-600 dark:text-blue-500"></i> Word to PDF Converter
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Convert DOCX Word documents into aligned vector PDFs locally. Zero uploads, maximum document security.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-105 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-file-word-fill"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select Word Document to convert</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-555 mt-1">Upload a DOCX file. The tool parses layouts in real-time.</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".docx,.doc"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
              >
                Choose DOCX File
              </button>
            </div>
          )}

          {/* LOCAL INLINE CONTAINER LOADER */}
          {converting && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-sm animate-in fade-in duration-200">
              <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Converting Word document...</p>
                <p className="text-xs text-zinc-505 font-mono">{progressMsg}</p>
              </div>
            </div>
          )}

          {file && !outputUrl && !converting && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl space-y-6 shadow-sm">

              {/* File Info */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800">
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    <i className="ri-file-line"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-555 font-semibold">Loaded Word Document</p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs font-bold text-red-655 hover:underline cursor-pointer font-bold text-red-600"
                >
                  Change File
                </button>
              </div>

              <div className="py-6 text-center text-xs text-zinc-555 dark:text-zinc-455 space-y-2">
                <i className="ri-file-text-line text-blue-500 text-3xl"></i>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Vector Formatting Pipeline</p>
                <p className="max-w-md mx-auto leading-relaxed">
                  SafelyPrint renders document layers dynamically and converts them into standard vector-based PDF format.
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
                <p className="text-xs text-zinc-455 dark:text-zinc-400">Your Word document is converted. Secure share or download below.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`${file?.name?.replace(".docx", "")}.pdf`}
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
                Convert Another DOCX
              </button>
            </div>
          )}
    </ToolLayout>
  );
}
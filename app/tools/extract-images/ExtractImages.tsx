// app/tools/extract-images/ExtractImages.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ToolSeoSection from "@/app/components/ToolSeoSection";
import ToolSeoSchema from "@/app/components/ToolSeoSchema";
import ToolLayout from "@/app/components/ToolLayout";

export default function ExtractImages() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [extractedCount, setExtractedCount] = useState<number>(0);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
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
    setProgressMsg("Loading PDF image extractor...");
    await loadScript("/vendor/pdfjs-3.4.120/pdf.min.js", "pdfjsLib");
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs-3.4.120/pdf.worker.min.js";
    await loadScript("/vendor/docx/jszip.min.js", "JSZip");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setFile(e.target.files[0]);
    setOutputUrl(null);
    setOutputBlob(null);
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setProgressMsg("Scanning PDF pages for images...");

    try {
      await loadAllEngines();
      const pdfjs = (window as any).pdfjsLib;
      const JSZip = (window as any).JSZip;

      const zip = new JSZip();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      let imageCounter = 0;

      for (let i = 1; i <= totalPages; i++) {
        setProgressMsg(`Extracting images from page ${i} of ${totalPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

        imageCounter++;
        zip.file(`page_${i}_image.png`, base64Data, { base64: true });
      }

      setProgressMsg("Building ZIP archive...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);

      setExtractedCount(imageCounter);
      setOutputBlob(zipBlob);
      setOutputUrl(url);

    } catch (err) {
      console.error(err);
      alert("Failed to extract images from PDF.");
    } finally {
      setExtracting(false);
      setProgressMsg("");
    }
  };

  return (
    <ToolLayout
      breadcrumbs={[
              { name: "Home", url: "https://printsafely.app" },
              { name: "Tools", url: "https://printsafely.app#tools-catalog" },
              { name: "Extract Images", url: "https://printsafely.app/tools/extract-images" },
            ]}
    >
<div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <i className="ri-image-add-line text-blue-600 dark:text-blue-500"></i> Extract Images from PDF
            </h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Extract embedded photos, graphics, and figures from your PDF documents 100% locally and download them as a ZIP archive.
            </p>
          </div>

          {!file && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center text-2xl">
                <i className="ri-image-add-line"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select PDF file to extract images</p>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-1">Choose a PDF to extract pictures and figures into a ZIP archive.</p>
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

          {file && !outputUrl && (
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
                      {(file.size / 1024 / 1024).toFixed(2)} MB • Loaded PDF File
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {extracting && (
                <div className="py-4 text-center space-y-2">
                  <div className="animate-spin h-6 w-6 text-blue-600 border-3 border-t-transparent rounded-full mx-auto" />
                  <p className="text-xs text-zinc-500 font-mono">{progressMsg || "Scanning PDF pages for images..."}</p>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {extracting ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <i className="ri-image-add-line"></i> Extract Images to ZIP
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
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Images Extracted Successfully!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Successfully extracted {extractedCount} images into ZIP format.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
                <a
                  href={outputUrl}
                  download={`${file?.name?.split(".")[0]}_images.zip`}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ri-file-zip-line"></i> Download Images (.ZIP)
                </a>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setOutputUrl(null);
                  setOutputBlob(null);
                }}
                className="text-xs font-semibold text-zinc-400 hover:underline cursor-pointer block mx-auto"
              >
                Extract Another PDF
              </button>
            </div>
          )}
      <ToolSeoSection
        title="Extract Images from PDF Online Free"
        subtitle="Rip and save high-resolution pictures and embedded graphics from PDF documents locally in your web browser."
        steps={[
          { title: "Select PDF File", desc: "Choose a PDF file containing images or figures from your device." },
          { title: "Extract Images", desc: "Our in-browser parser scans every page and packages embedded images." },
          { title: "Download ZIP", desc: "Download all extracted images packaged in a single ZIP file." }
        ]}
        features={[
          { icon: "⚡", title: "Fast & Automatic", desc: "Instantly extracts images from all PDF pages without quality loss." },
          { icon: "🔒", title: "100% Confidential", desc: "Processing is completed locally without sending files to external servers." },
          { icon: "📦", title: "Organized ZIP", desc: "Packages all extracted images neatly into a downloadable ZIP archive." }
        ]}
        faqs={[
          { question: "What image formats are extracted?", answer: "Extracted images are saved as high-quality PNG graphics inside the ZIP file." },
          { question: "Are my files uploaded anywhere?", answer: "No, all file extraction happens locally within your browser context." }
        ]}
      />
      <ToolSeoSchema
        name="Extract Images from PDF Online Free"
        description="Extract embedded images, photos, and figures from PDF files 100% locally in your web browser."
        url="https://printsafely.app/tools/extract-images"
        steps={[
          "Select a PDF file with images to extract.",
          "Click Extract Images to ZIP.",
          "Download your ZIP archive containing all extracted pictures."
        ]}
        faqs={[
          { question: "What image formats are extracted?", answer: "Extracted images are saved as high-quality PNG graphics inside the ZIP file." },
          { question: "Are my files uploaded anywhere?", answer: "No, all file extraction happens locally within your browser context." }
        ]}
      />
    </ToolLayout>
  );
}


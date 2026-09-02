// app/p/[id]/page.tsx
"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { decryptFile } from "@/lib/crypto";
import Link from "next/link";

interface FileItem {
  name: string;
  type: string;
  keyString: string;
  ivString: string;
  totalChunks: number;
  decryptedUrl?: string;
}

function SecurePrintPageContent() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [error, setError] = useState("");
  const [docData, setDocData] = useState<any>(null);
  
  // Security PIN states
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  
  // Render / Display states
  const [authorized, setAuthorized] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [windowActive, setWindowActive] = useState(true);
  const [decryptedFiles, setDecryptedFiles] = useState<FileItem[]>([]);
  
  // Dynamic page counts for PDF files
  const [pdfPageCounts, setPdfPageCounts] = useState<Record<number, number>>({});
  
  // Printing Single File State
  const [activePrintIndex, setActivePrintIndex] = useState<number | null>(null);

  // Status Banner Messages
  const [printStatusMessage, setPrintStatusMessage] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  

  // Load PDF.js Script dynamically on mount
  useEffect(() => {
    const loadPdfJS = () => {
      if ((window as any).pdfjsLib) return;

      const script = document.createElement("script");
      script.src = "/vendor/pdfjs-3.11.174/pdf.min.js";
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
          "/vendor/pdfjs-3.11.174/pdf.worker.min.js";
      };
      document.body.appendChild(script);
    };
    loadPdfJS();
  }, []);

  // Shared Document Deletion Helper (Clears Firestore space instantly)
  const destroyDocumentData = async (targetDocData = docData) => {
    // Safety check: If targetDocData is a React click event, default to docData
    const finalData = (targetDocData && typeof targetDocData === "object" && "files" in targetDocData) 
      ? targetDocData 
      : docData;

    if (!finalData) return;
    
    setLoading(true);
    setLoadingProgress("Securely erasing document content from database...");
    
    const docRef = doc(db, "documents", docId);
    
    // 1. Delete all chunk documents defensively
    try {
      const deletePromises: Promise<any>[] = [];
      finalData.files.forEach((file: any, fileIndex: number) => {
        for (let chunkIndex = 0; chunkIndex < file.totalChunks; chunkIndex++) {
          const chunkRef = doc(db, "documents", docId, "chunks", `${fileIndex}_${chunkIndex}`);
          deletePromises.push(
            deleteDoc(chunkRef).catch((err) => console.warn(`Failed to delete chunk ${fileIndex}_${chunkIndex}:`, err))
          );
        }
      });
      await Promise.all(deletePromises);
    } catch (err) {
      console.warn("Error during chunk deletion loop:", err);
    }

    // 2. Delete the main document defensively (purges the entire print job)
    try {
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("Failed to delete main document in Firestore:", err);
    }

    // 3. WIPE local files and LOCK UI
    setDecryptedFiles([]);
    setDocData(null);
    setError("This secure print link has been printed and deleted.");
    setLoading(false);
  };

  // 1. Fetch Document Metadata & Perform Active Purges
  useEffect(() => {
    if (!docId) return;

    const fetchMetadata = async () => {
      try {
        const docRef = doc(db, "documents", docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError("Document link not found or has been deleted.");
          setLoading(false);
          return;
        }

        const data = docSnap.data();

        // 1. Check expiration & PURGE if expired
        const now = new Date();
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        if (now > expiresAt) {
          setError("This secure print link has expired.");
          await destroyDocumentData(data);
          return;
        }

        // 2. Check print limits & PURGE if exceeded
        if (data.printCount >= data.printLimit || data.status === "printed") {
          setError("This document package has reached its maximum print attempts.");
          await destroyDocumentData(data);
          return;
        }

        setDocData(data);

        // Check PIN requirement
        if (data.pinCode) {
          setPinRequired(true);
        } else {
          setPinRequired(false);
        }
      } catch (err: any) {
        console.error(err);
        setError("An error occurred while loading this page.");
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [docId]);

  // 2. Validate PIN Code & Start Print Session
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (pinInput === docData.pinCode) {
      await startPrintSession();
    } else {
      setPinError("Incorrect PIN. Please ask the document owner.");
    }
  };

  // 3. Start Print Session (Increments attempt count once on session start)
  const startPrintSession = async () => {
    try {
      const nextPrintCount = docData.printCount + 1;
      const docRef = doc(db, "documents", docId);

      await updateDoc(docRef, {
        printCount: nextPrintCount,
        status: nextPrintCount >= docData.printLimit ? "printed" : "active"
      });

      setDocData((prev: any) => ({
        ...prev,
        printCount: nextPrintCount
      }));

      setPrintStatusMessage(
        `Print session started. Attempt ${nextPrintCount} of ${docData.printLimit} consumed.`
      );

      setAuthorized(true);
      setPinRequired(false);
        // NEW: Only open the modal if they haven't accepted it in this browser tab session
      const hasAccepted = sessionStorage.getItem(`safelyprint_terms_${docId}`);
      if (hasAccepted !== "true") {
        setShowTermsModal(true);
      }
    } catch (err) {
      console.error("Failed to start print session: ", err);
      setPinError("Failed to initiate secure connection. Please try again.");
    }
  };

  // Trigger print session automatically if no PIN is required
  useEffect(() => {
    if (docData && !docData.pinCode && !authorized && !loading) {
      startPrintSession();
    }
  }, [docData, authorized, loading]);

  // 4. Fetch, Reassemble, and Decrypt Chunks
  useEffect(() => {
    if (!authorized || !docData) return;

    const fetchAndDecryptAll = async () => {
      setLoading(true);
      setError("");
      const filesList: FileItem[] = docData.files || [];
      const decryptedResults: FileItem[] = [];

      try {
        for (let fileIndex = 0; fileIndex < filesList.length; fileIndex++) {
          const file = filesList[fileIndex];
          setLoadingProgress(`Loading file ${fileIndex + 1} of ${filesList.length}...`);
          
          const chunkStrings: string[] = [];

          // Download chunks
          for (let chunkIndex = 0; chunkIndex < file.totalChunks; chunkIndex++) {
            const chunkRef = doc(db, "documents", docId, "chunks", `${fileIndex}_${chunkIndex}`);
            const chunkSnap = await getDoc(chunkRef);
            
            if (!chunkSnap.exists()) {
              throw new Error(`Missing document segment ${chunkIndex} for ${file.name}`);
            }
            
            chunkStrings.push(chunkSnap.data().data);
          }

          const fullEncryptedData = chunkStrings.join("");

          // Decrypt in memory (Web Crypto AES-256)
          const decryptedUrl = await decryptFile(
            fullEncryptedData,
            file.keyString,
            file.ivString,
            file.type
          );

          decryptedResults.push({
            ...file,
            decryptedUrl: decryptedUrl
          });
        }

        setDecryptedFiles(decryptedResults);
      } catch (err: any) {
        console.error("Reassembly Error: ", err);
        setError("Security check failed: Document segments are corrupted or missing.");
      } finally {
        setLoading(false);
      }
    };

    fetchAndDecryptAll();
  }, [authorized, docData, docId]);

  // 5. Render Decrypted Files to Canvases
  useEffect(() => {
    if (decryptedFiles.length === 0) return;

    const renderAllDocuments = async () => {
      let lastEnteredPassword = "";

      for (let index = 0; index < decryptedFiles.length; index++) {
        const file = decryptedFiles[index];
        if (!file.decryptedUrl) continue;

        // --- CASE A: PDF FILE RENDERING ---
        if (file.type === "application/pdf") {
          try {
            const pdfjsLib = (window as any).pdfjsLib;
            if (!pdfjsLib) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            const activePdfJs = (window as any).pdfjsLib || pdfjsLib;

            const loadingTask = activePdfJs.getDocument({
              url: file.decryptedUrl,
              password: lastEnteredPassword || undefined
            });
            loadingTask.onPassword = (updatePassword: any, reason: number) => {
              const enteredPassword = prompt(
                reason === 1
                  ? `"${file.name}" is password-protected. Please enter the password to view:`
                  : `Incorrect password for "${file.name}". Please enter the correct password:`
              );
              if (enteredPassword !== null) {
                lastEnteredPassword = enteredPassword;
                updatePassword(enteredPassword);
              } else {
                updatePassword("");
              }
            };
            const pdf = await loadingTask.promise;

            setPdfPageCounts((prev) => ({ ...prev, [index]: pdf.numPages }));

            // 1. Render Secure Page 1 Thumbnail Canvas
            const page1 = await pdf.getPage(1);
            const thumbCanvas = document.getElementById(`thumb-canvas-${index}`) as HTMLCanvasElement;
            if (thumbCanvas) {
              const thumbCtx = thumbCanvas.getContext("2d");
              if (thumbCtx) {
                const scale = 120 / page1.getViewport({ scale: 1 }).width;
                const viewport = page1.getViewport({ scale: scale });
                thumbCanvas.width = viewport.width;
                thumbCanvas.height = viewport.height;
                await page1.render({ canvasContext: thumbCtx, viewport: viewport }).promise;
              }
            }

            // 2. Render each print page canvas
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const canvasId = `canvas-${index}-${pageNum - 1}`;
              
              let canvas = document.getElementById(canvasId) as HTMLCanvasElement;
              while (!canvas) {
                await new Promise((resolve) => setTimeout(resolve, 50));
                canvas = document.getElementById(canvasId) as HTMLCanvasElement;
              }

              const ctx = canvas.getContext("2d");
              if (!ctx) continue;

              const viewport = page.getViewport({ scale: 1.8 });
              canvas.width = viewport.width;
              canvas.height = viewport.height;

              await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            }
          } catch (pdfErr) {
            console.error("PDF rendering failed: ", pdfErr);
          }
        } 
        // --- CASE B: IMAGE FILE RENDERING ---
        else if (file.type.startsWith("image/")) {
          const canvas = document.getElementById(`canvas-${index}-0`) as HTMLCanvasElement;
          const thumbCanvas = document.getElementById(`thumb-canvas-${index}`) as HTMLCanvasElement;

          const img = new Image();
          img.src = file.decryptedUrl;
          await new Promise<void>((resolve) => {
            img.onload = () => {
              if (canvas) {
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext("2d")?.drawImage(img, 0, 0);
              }
              if (thumbCanvas) {
                const thumbCtx = thumbCanvas.getContext("2d");
                if (thumbCtx) {
                  const scale = 120 / img.width;
                  thumbCanvas.width = 120;
                  thumbCanvas.height = img.height * scale;
                  thumbCtx.drawImage(img, 0, 0, 120, img.height * scale);
                }
              }
              resolve();
            };
          });
        }
      }
    };

    renderAllDocuments();
  }, [decryptedFiles]);

  // 6. Window Blur Protection (Tab focus shield)
  useEffect(() => {
    if (!authorized) return;

    const handleBlur = () => {
      setWindowActive(false);
    };

    const handleFocus = () => {
      setWindowActive(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") e.preventDefault();
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "I")) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.key === "c") e.preventDefault();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleBlur);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleBlur);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [authorized]);

  // 7. Print Trigger Action: Print Entire Package
  const handlePrint = async () => {
    setPrinting(true);

    const afterPrint = async () => {
      window.removeEventListener("afterprint", afterPrint);
      setPrinting(false);
      setPrintStatusMessage("Entire package sent to printer queue successfully.");

      // Wipe documents immediately if print attempt limit is exhausted
      if (docData.printCount >= docData.printLimit) {
        await destroyDocumentData();
      }
    };

    window.addEventListener("afterprint", afterPrint);
    window.print();
  };

  // 8. Print Trigger Action: Print Single Document
  const handlePrintSingle = async (index: number) => {
    setActivePrintIndex(index);
    setPrinting(true);

    const afterPrintSingle = async () => {
      window.removeEventListener("afterprint", afterPrintSingle);
      setActivePrintIndex(null);
      setPrinting(false);
      setPrintStatusMessage(`File "${decryptedFiles[index].name}" printed successfully.`);

      // Wipe documents immediately if print attempt limit is exhausted
      if (docData.printCount >= docData.printLimit) {
        await destroyDocumentData();
      }
    };

    window.addEventListener("afterprint", afterPrintSingle);
    
    setTimeout(() => {
      window.print();
    }, 80);
  };
  const handleTermsAccept = () => {
    sessionStorage.setItem(`safelyprint_terms_${docId}`, "true");
    setShowTermsModal(false);
  };
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold text-zinc-400">
            {loadingProgress || "Authorizing access..."}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
          <div className="text-red-500 flex justify-center">
            <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192-3 1.732-3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Document Locked</h2>
          <p className="text-sm text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (pinRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-sm w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center text-blue-500">
              <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Enter Document PIN</h2>
            <p className="text-xs text-zinc-400 font-medium">Ask the sender for the security PIN to access the files.</p>
          </div>

          {pinError && (
            <div className="p-3 text-xs bg-red-955/20 border border-red-800 text-red-400 rounded-lg text-center">
              {pinError}
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••••"
              className="w-full text-center text-xl tracking-widest py-3 border border-zinc-800 bg-zinc-950 text-white rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Access Documents
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full flex flex-col bg-zinc-950 transition-colors duration-300 print:bg-white text-white ${
      activePrintIndex !== null ? "print-single-active" : ""
    }`}>
        {/* NEW: Security & Terms Compliance Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4 print:hidden">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-center text-amber-500">
              <svg className="h-14 w-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192-3 1.732-3z" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">Security & Compliance Agreement</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This document package is protected by <span className="text-blue-500 font-bold">SafelyPrint</span>. 
                Downloading, screenshotting, or saving these files locally is strictly prohibited and monitored.
              </p>
            </div>
            <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/60 text-left space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                />
                <span className="text-xs text-zinc-300 font-medium leading-relaxed">
                  I agree to print these documents directly to a physical paper printer and will not save them to this computer.
                </span>
              </label>
            </div>
            <button
              onClick={handleTermsAccept}
              disabled={!termsAccepted}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-bold rounded-xl transition shadow-lg shadow-blue-500/10 cursor-pointer disabled:cursor-not-allowed"
            >
              Proceed to Print
            </button>
          </div>
        </div>
      )}
      {/* Control Header */}
      <header className="w-full border-b border-zinc-800 bg-zinc-900/85 backdrop-blur-md px-6 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center">
            <img
                src="/logo-dark.svg"
                alt="SafelyPrint Logo"
                className="h-7 w-auto block dark:hidden"
            />
            <img
                src="/logo-light.svg" 
                alt="SafelyPrint Logo"
                className="h-7 w-auto hidden dark:block"
            />
        </Link>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-750 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            Print Entire Package
          </button>

          <button
            onClick={() => destroyDocumentData()}
            className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-550/25 px-4 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all cursor-pointer"
          >
            🔒 Finish & Lock Link
          </button>
        </div>
      </header>

      {/* Main Body Container */}
      <div className="flex-1 flex w-full max-w-[100vw] justify-center overflow-hidden print:p-0">
        
        <main className="flex-1 p-6 print:p-0 overflow-auto bg-zinc-950 flex flex-col items-center gap-5 justify-start">
          
          {/* SCREEN GRID/LIST VIEW (Hidden during print) */}
          <div className="max-w-4xl w-full space-y-4 print:hidden">
            
            {/* Permanent Print Attempt Tracker Card */}
            {docData && (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between text-xs shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase font-extrabold text-amber-500 tracking-wider block">
                    Secure Attempt Tracker
                  </span>
                  <p className="text-zinc-300 font-medium">
                    Currently using attempt <span className="text-white font-bold">{docData.printCount}</span> of <span className="text-white font-bold">{docData.printLimit}</span>.
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    You can print individual files freely while this tab is open.
                  </p>
                </div>
                <div className="text-right bg-zinc-950/50 px-3.5 py-2 rounded-xl border border-zinc-800/40">
                  <span className="text-zinc-500 font-bold block text-[9px] uppercase tracking-wider">
                    Remaining
                  </span>
                  <span className="text-xl font-black text-amber-500">
                    {docData.printLimit - docData.printCount}
                  </span>
                </div>
              </div>
            )}

            {/* Inline Print Notification Banner */}
            {printStatusMessage && (
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-3.5 rounded-2xl text-xs flex justify-between items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <span>{printStatusMessage}</span>
                <button 
                  onClick={() => setPrintStatusMessage(null)}
                  className="text-zinc-500 hover:text-white font-bold text-xs"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Document listings grid (2 files per row on desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {decryptedFiles.map((file, index) => {
                const isPdf = file.type === "application/pdf";
                const totalPages = pdfPageCounts[index] || 1;
                const shouldBlur = docData.blurEnabled && !windowActive;

                return (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-white"
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      
                      {/* SECURE THUMBNAIL CANVASES */}
                      <div className={`relative w-14 h-14 rounded-xl border border-zinc-800 bg-zinc-950 flex-shrink-0 overflow-hidden ${
                        shouldBlur ? "screen-blur" : ""
                      }`}>
                        <canvas
                          id={`thumb-canvas-${index}`}
                          className="w-full h-full object-cover"
                        />
                        {isPdf && (
                          <span className="absolute bottom-1 right-1 bg-red-600 text-white font-black text-[7px] px-1 rounded uppercase tracking-wider select-none">
                            PDF
                          </span>
                        )}
                      </div>
                      
                      {/* File Info */}
                      <div className="space-y-0.5 overflow-hidden">
                        <p className="text-sm font-bold text-white truncate pr-1 max-w-[200px]">{file.name}</p>
                        <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                          {file.type.split("/")[1]} • {isPdf ? `${totalPages} pages` : "1 page"}
                        </p>
                      </div>
                    </div>

                    {/* Print Individual Document Button */}
                    <button
                      onClick={() => handlePrintSingle(index)}
                      disabled={printing}
                      className="bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white px-3.5 py-2 rounded-sm text-xs font-bold transition cursor-pointer pointer-events-auto border border-zinc-700"
                    >
                      Print File
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HIDDEN PRINT-ONLY CONTAINER (Invisible on screen, renders full-size canvases on print) */}
          <div className="print-only-container">
            {decryptedFiles.map((file, index) => {
              const isPdf = file.type === "application/pdf";
              const totalPages = pdfPageCounts[index] || 1;

              return (
                <div 
                  key={index} 
                  className={`print-page-wrapper doc-card-wrapper ${
                    activePrintIndex === index ? "doc-card-wrapper-active" : ""
                  }`}
                >
                  {isPdf ? (
                    Array.from({ length: totalPages }).map((_, pageIdx) => (
                      <canvas 
                        key={pageIdx}
                        id={`canvas-${index}-${pageIdx}`} 
                        className="print-canvas"
                      />
                    ))
                  ) : (
                    <canvas 
                      id={`canvas-${index}-0`} 
                      className="print-canvas"
                    />
                  )}
                </div>
              );
            })}
          </div>

        </main>

      </div>

      {/* Global CSS Stylesheet */}
      <style jsx global>{`
        /* Screen Blur Styles for thumbnails when tab is out of focus */
        .screen-blur canvas {
          filter: blur(8px) !important;
          pointer-events: none !important;
          user-select: none !important;
        }
        
        /* Hide full-scale print canvases on screen view */
        .print-only-container {
          display: none !important;
        }

        @media print {
          /* Remove Web UI headers, sidebars, buttons, and screen wrappers */
          header, aside, button, .print-hidden {
            display: none !important;
          }
          
          /* Single Document Printing Mode Override (CSS-only filtering, keeps canvases mounted) */
          .print-single-active .doc-card-wrapper {
            display: none !important;
          }
          .print-single-active .doc-card-wrapper-active {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }
          
          /* Clean print layout container sizes */
          body, html, main {
            background: white !important;
            color: black !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Reveal target print content area and remove monitor shield constraints */
          .print-only-container, 
          .print-only-container * , 
          .print-page-wrapper, 
          .print-page-wrapper * {
            display: block !important;
            visibility: visible !important;
          }
          
          .print-only-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          
          .print-page-wrapper {
            background: white !important;
            page-break-after: always;
          }
          
          /* High-res Canvas Print scaling (prevents cutting and matches paper width) */
          canvas.print-canvas {
            width: 100vw !important;
            height: auto !important;
            max-height: none !important;
            display: block !important;
            margin: 0 auto !important;
            page-break-inside: avoid;
            page-break-after: always;
          }
          
          @page {
            size: auto;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
}

export default function SecurePrintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    }>
      <SecurePrintPageContent />
    </Suspense>
  );
}
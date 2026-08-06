// app/p/[id]/page.tsx
"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { decryptFile } from "@/lib/crypto";

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
  
  // Render / Decrypted states
  const [authorized, setAuthorized] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [decryptedFiles, setDecryptedFiles] = useState<FileItem[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch Document Metadata
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

        // Check expiration
        const now = new Date();
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        if (now > expiresAt) {
          setError("This secure print link has expired.");
          setLoading(false);
          return;
        }

        // Check print limits
        if (data.printCount >= data.printLimit) {
          setError("This document package has reached its maximum print attempts.");
          setLoading(false);
          return;
        }

        setDocData(data);

        // Check PIN requirement
        if (data.pinCode) {
          setPinRequired(true);
        } else {
          setAuthorized(true);
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

  // 2. Validate PIN Code
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (pinInput === docData.pinCode) {
      setAuthorized(true);
      setPinRequired(false);
    } else {
      setPinError("Incorrect PIN. Please ask the document owner.");
    }
  };

  // 3. Fetch, Reassemble, and Decrypt Chunks
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
          setLoadingProgress(`Downloading & Decrypting file ${fileIndex + 1} of ${filesList.length}...`);
          
          const chunkStrings: string[] = [];

          // Download all chunks in sequence
          for (let chunkIndex = 0; chunkIndex < file.totalChunks; chunkIndex++) {
            const chunkRef = doc(db, "documents", docId, "chunks", `${fileIndex}_${chunkIndex}`);
            const chunkSnap = await getDoc(chunkRef);
            
            if (!chunkSnap.exists()) {
              throw new Error(`Missing document segment ${chunkIndex} for ${file.name}`);
            }
            
            chunkStrings.push(chunkSnap.data().data);
          }

          // Combine chunks back to full base64 encrypted data string
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
        console.error("Reassembly/Decryption Error: ", err);
        setError("Security check failed: Document segments are corrupted or missing.");
      } finally {
        setLoading(false);
      }
    };

    fetchAndDecryptAll();
  }, [authorized, docData, docId]);

  // 4. Draw Decrypted Files to Canvases
  useEffect(() => {
    if (decryptedFiles.length === 0) return;

    decryptedFiles.forEach((file, index) => {
      if (!file.decryptedUrl || !file.type.startsWith("image/")) return;

      const canvas = document.getElementById(`canvas-${index}`) as HTMLCanvasElement;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.src = file.decryptedUrl;
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Stamp Security Watermarks
        ctx.font = `${Math.round(canvas.width / 20)}px sans-serif`;
        ctx.fillStyle = "rgba(100, 116, 139, 0.12)";
        ctx.textAlign = "center";

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 6); // -30deg rotation
        ctx.fillText("FOR PHYSICAL PRINT ONLY - SAFELYPRINT", 0, -40);
        ctx.fillText("DO NOT SAVE OR SCREENSHOT", 0, 40);
        ctx.restore();
      };
    });
  }, [decryptedFiles]);

  // 5. Context Menu & Keyboard Shielding
  useEffect(() => {
    if (!authorized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") e.preventDefault();
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "I")) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.key === "c") e.preventDefault();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [authorized]);

  // 6. Print Trigger Action
  // 6. Print Trigger Action
  const handlePrint = async () => {
    setPrinting(true);

    const afterPrint = async () => {
      window.removeEventListener("afterprint", afterPrint);
      try {
        const nextPrintCount = docData.printCount + 1;
        const isExhausted = nextPrintCount >= docData.printLimit;

        // 1. Update the print count and status in Firestore
        const docRef = doc(db, "documents", docId);
        await updateDoc(docRef, {
          printCount: nextPrintCount,
          status: isExhausted ? "printed" : "active"
        });
        
        // 2. Redirect to Completed page ONLY if all print attempts are used
        if (isExhausted) {
          router.push("/p/completed");
        } else {
          // 3. Otherwise, update local state so they can print the remaining attempts
          setDocData((prev: any) => ({
            ...prev,
            printCount: nextPrintCount
          }));
          alert(`Print successful! Attempt ${nextPrintCount} of ${docData.printLimit} completed.`);
        }
      } catch (err) {
        console.error("Failed to update print status: ", err);
      }
    };

    window.addEventListener("afterprint", afterPrint);
    window.print();
    setPrinting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {loadingProgress || "Authorizing access..."}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl">
          <div className="text-red-500 flex justify-center">
            <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-950 dark:text-white">Document Locked</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (pinRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="max-w-sm w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center text-blue-600">
              <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Enter Document PIN</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Ask the sender for the security PIN to access the files.</p>
          </div>

          {pinError && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-center">
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
              className="w-full text-center text-xl tracking-widest py-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition-all"
            >
              Access Documents
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-zinc-100 dark:bg-zinc-950 transition-colors duration-300 print:bg-white">
      {/* Print Control Header */}
      <header className="w-full border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md px-6 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold tracking-wider uppercase text-zinc-700 dark:text-zinc-300">
            SafelyPrint Encrypted View ({decryptedFiles.length} files)
          </span>
        </div>
        
        <button
          onClick={handlePrint}
          disabled={printing}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md active:scale-[0.98] transition-all cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Entire Package
        </button>
      </header>

      {/* Main Files Display Area */}
      <main ref={containerRef} className="flex-1 flex flex-col items-center gap-8 p-6 print:p-0 overflow-auto">
        {decryptedFiles.map((file, index) => {
          const isImg = file.type.startsWith("image/");

          return (
            <div 
              key={index}
              className="relative shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl overflow-hidden bg-white select-none pointer-events-none print:shadow-none print:border-none print:rounded-none max-w-full print:break-after-page"
            >
              {/* File Title Header */}
              <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 px-4 py-2 text-[10px] font-bold text-zinc-500 print:hidden flex justify-between">
                <span>FILE {index + 1}: {file.name}</span>
                <span className="uppercase">{file.type.split("/")[1]}</span>
              </div>

              {/* Renders Canvases for Images, or falls back to iframe for direct PDF views if needed */}
              {isImg ? (
                <canvas 
                  id={`canvas-${index}`} 
                  className="block max-w-full max-h-[80vh] print:max-h-none print:w-full"
                />
              ) : (
                /* PDF/Docx direct embedded secure preview fallback */
                <iframe
                  src={file.decryptedUrl}
                  className="w-[80vw] h-[80vh] block print:w-full print:h-screen border-none"
                  title={file.name}
                />
              )}

              {/* Tap Blocker Overlay */}
              <div className="absolute inset-0 z-10 bg-transparent print:hidden" />
            </div>
          );
        })}
      </main>

      {/* Print Overrides stylesheet */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          /* Target canvas and iframe views to show when print dialog triggers */
          main, main * {
            visibility: visible;
          }
          main {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          canvas, iframe {
            width: 100vw !important;
            height: auto !important;
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
        <div className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    }>
      <SecurePrintPageContent />
    </Suspense>
  );
}
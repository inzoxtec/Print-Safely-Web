// app/upload/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { compressImage, encryptFile, chunkString } from "@/lib/crypto";
import Link from "next/link";

interface UploadedFileMetadata {
  name: string;
  type: string;
  keyString: string;
  ivString: string;
  totalChunks: number;
}

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Premium Testing Flag (Toggle to true to test premium accounts)
  const [isPremium, setIsPremium] = useState(false);
  const maxFiles = isPremium ? 20 : 5;

  // File lists state
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Configuration States
  const [expirationHours, setExpirationHours] = useState("24");
  const [printLimit, setPrintLimit] = useState(1);
  const [usePin, setUsePin] = useState(false);
  const [pinCode, setPinCode] = useState("");

  // Upload/Status States
  const [uploading, setUploading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Drag & Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files) {
      addFilesToList(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFilesToList(Array.from(e.target.files));
    }
  };

  const addFilesToList = (incomingFiles: File[]) => {
    setError("");
    setShowUpgradePrompt(false);

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    const validFiles: File[] = [];

    for (const f of incomingFiles) {
      if (!allowedTypes.includes(f.type)) {
        setError("Invalid format. Only PDF, images (JPG/PNG/WebP), and Word (DOCX) files are allowed.");
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError("File is too large. Maximum file size is 10MB.");
        continue;
      }
      validFiles.push(f);
    }

    if (files.length + validFiles.length > maxFiles) {
      if (!isPremium) {
        setShowUpgradePrompt(true);
      } else {
        setError(`Upload limit reached! You can upload a maximum of ${maxFiles} files at once.`);
      }
      return;
    }

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setShowUpgradePrompt(false);
  };

  // 1. Process & Upload Chunks to Firestore
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 || !user) return;

    setError("");
    setUploading(true);
    setProgress(0);

    const filesMetadataArray: UploadedFileMetadata[] = [];
    const docId = doc(collection(db, "documents")).id;

    try {
      // Step 1: Calculate total chunks across all files to track progress accurately
      let totalExpectedChunks = 0;
      const processedFilesBlobs: Blob[] = [];

      setOptimizing(true);
      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i);
        const currentFile = files[i];
        let finalBlob: Blob = currentFile;

        // Perform Client-side image compression if the image is > 1.5MB
        if (currentFile.type.startsWith("image/") && currentFile.size > 1.5 * 1024 * 1024) {
          finalBlob = await compressImage(currentFile);
        }
        processedFilesBlobs.push(finalBlob);
      }
      setOptimizing(false);

      // Step 2: Encrypt and upload chunks
      let chunksUploadedSoFar = 0;
      
      for (let fileIndex = 0; fileIndex < processedFilesBlobs.length; fileIndex++) {
        setCurrentFileIndex(fileIndex);
        const fileBlob = processedFilesBlobs[fileIndex];
        const originalFile = files[fileIndex];

        // Encrypt locally using AES-256
        const { encryptedDataStr, keyString, ivString } = await encryptFile(fileBlob);

        // Split base64 encrypted data into ~900KB segments
        const fileChunks = chunkString(encryptedDataStr);
        totalExpectedChunks += fileChunks.length;

        // Upload chunks sequentially to Firestore subcollection
        for (let chunkIndex = 0; chunkIndex < fileChunks.length; chunkIndex++) {
          const chunkRef = doc(db, "documents", docId, "chunks", `${fileIndex}_${chunkIndex}`);
          
          await setDoc(chunkRef, {
            fileIndex: fileIndex,
            chunkIndex: chunkIndex,
            data: fileChunks[chunkIndex]
          });

          chunksUploadedSoFar++;
          // Estimate global progress percentage
          setProgress(Math.round((chunksUploadedSoFar / (files.length * 2)) * 100)); // Rough estimation before knowing final chunk counts
        }

        // Add file detail to metadata array
        filesMetadataArray.push({
          name: originalFile.name,
          type: originalFile.type,
          keyString: keyString,
          ivString: ivString,
          totalChunks: fileChunks.length
        });
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expirationHours));

      // Save complete package metadata document to Firestore root collection
      const docRef = doc(db, "documents", docId);
      await setDoc(docRef, {
        docId: docId,
        ownerUid: user.uid,
        files: filesMetadataArray,
        createdAt: new Date(),
        expiresAt: expiresAt,
        printLimit: printLimit,
        printCount: 0,
        pinCode: usePin && pinCode ? pinCode : null,
        status: "active",
      });

      setProgress(100);
      const shareLink = `${window.location.origin}/p/${docId}`;
      setGeneratedLink(shareLink);
      setUploading(false);
    } catch (err: any) {
      console.error("Upload failure: ", err);
      setError("An error occurred during secure link generation. Please try again.");
      setUploading(false);
      setOptimizing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setFiles([]);
    setGeneratedLink("");
    setPinCode("");
    setUsePin(false);
    setProgress(0);
    setError("");
    setShowUpgradePrompt(false);
  };

  const downloadQRCode = () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatedLink)}`;
    const link = document.createElement("a");
    link.href = qrUrl;
    link.target = "_blank";
    link.download = "safelyprint_qr.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFilePreview = (file: File) => {
    if (file.type.startsWith("image/")) {
      return URL.createObjectURL(file);
    }
    return "";
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50/50 via-zinc-50 to-blue-100/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950/20 px-4 py-12 transition-colors duration-300">
      <div className="w-full max-w-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl rounded-2xl p-8 space-y-6">
        
        {/* Toggle Flag Box for Testing */}
        <div className="flex items-center justify-between p-3 bg-zinc-100 dark:bg-zinc-950 rounded-xl border border-zinc-200/40 dark:border-zinc-800/30 text-xs">
          <span className="font-semibold text-zinc-600 dark:text-zinc-400">Account Type (Testing):</span>
          <button 
            type="button"
            onClick={() => { resetForm(); setIsPremium(!isPremium); }}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              isPremium 
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/10" 
                : "bg-blue-600 text-white"
            }`}
          >
            {isPremium ? "💎 Premium (Max 20 Files)" : "🆓 Free (Max 5 Files)"}
          </button>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Secure Link Generator
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload files and share a one-time print link & QR Code
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Premium Upgrade Promotion Banner */}
        {showUpgradePrompt && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 dark:border-amber-500/30 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2.5 items-start">
              <span className="text-xl">💎</span>
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                  Need to upload more documents?
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Free accounts can upload up to 5 documents per link. Upgrade to Premium to link up to 20 documents, bypass size limits, and access advanced PDF editors.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link 
                href="/pricing"
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Upgrade to Premium
              </Link>
              <button
                type="button"
                onClick={() => setShowUpgradePrompt(false)}
                className="px-3.5 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {generatedLink ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200 dark:border-blue-800 rounded-xl p-5 text-center flex flex-col items-center gap-4">
              
              <div className="flex flex-col items-center gap-2">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(generatedLink)}`}
                  alt="Print QR Code"
                  className="w-36 h-36 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl bg-white shadow-sm"
                />
                <button
                  type="button"
                  onClick={downloadQRCode}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Download QR Code
                </button>
              </div>

              <div className="text-center space-y-1">
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 block">
                  Link & QR Generated!
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Printer shop can scan the QR code or visit the link to print. Link self-destructs after printing.
                </p>
              </div>

              <div className="w-full flex gap-2 items-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg mt-1">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="flex-1 text-xs bg-transparent outline-none text-zinc-800 dark:text-zinc-200"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Here is my document link to print: ${generatedLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
              >
                Share via WhatsApp
              </a>
              <button
                onClick={resetForm}
                className="flex-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold py-2.5 rounded-xl text-sm transition-all"
              >
                New Upload
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUploadSubmit} className="space-y-6">
            
            {/* Drag and Drop Box */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                dragActive 
                  ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/10" 
                  : "border-zinc-200 dark:border-zinc-800 hover:border-blue-400"
              }`}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="space-y-2">
                <div className="flex justify-center text-zinc-400">
                  <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Select or drag multiple files
                  </p>
                  <p className="text-xs text-zinc-500">
                    PDF, DOCX, JPG, WebP, PNG (Max {maxFiles} files, up to 10MB each)
                  </p>
                </div>
              </div>
            </div>

            {/* Premium File Preview Grid */}
            {files.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1">
                  Files to Upload ({files.length}/{maxFiles})
                </span>
                
                <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                  {files.map((f, index) => {
                    const isImg = f.type.startsWith("image/");
                    const imgUrl = isImg ? getFilePreview(f) : "";

                    return (
                      <div 
                        key={index}
                        className="group relative h-24 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden flex flex-col justify-between p-2 text-[10px]"
                      >
                        {isImg ? (
                          <img 
                            src={imgUrl} 
                            alt={f.name} 
                            className="absolute inset-0 w-full h-full object-cover z-0 opacity-70 group-hover:scale-105 transition-transform" 
                          />
                        ) : (
                          <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900">
                            <span className="text-3xl">
                              {f.type === "application/pdf" ? "📄" : "📝"}
                            </span>
                            <span className="text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                              {f.type === "application/pdf" ? "PDF" : "DOCX"}
                            </span>
                          </div>
                        )}

                        <div className="relative z-10 w-full bg-black/60 backdrop-blur-[1px] p-1 rounded text-white truncate font-medium">
                          {f.name}
                        </div>

                        <div className="relative z-10 w-fit bg-zinc-900/80 p-0.5 rounded text-[8px] text-white self-start">
                          {(f.size / 1024 / 1024).toFixed(1)}MB
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 z-20 h-5 w-5 bg-red-600 text-white rounded-full flex items-center justify-center font-bold shadow hover:bg-red-700 transition"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Expiry and Print Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Expiry Duration
                </label>
                <select
                  value={expirationHours}
                  onChange={(e) => setExpirationHours(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  <option value="1">1 Hour</option>
                  <option value="3">3 Hours</option>
                  <option value="6">6 Hours</option>
                  <option value="9">9 Hours</option>
                  <option value="12">12 Hours</option>
                  <option value="18">18 Hours</option>
                  <option value="24">24 Hours (1 Day)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Print Limit (Attempts)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={printLimit}
                  onChange={(e) => setPrintLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Optional Security PIN */}
            <div className="border-t border-zinc-200/50 dark:border-zinc-800/50 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Enable Link Security PIN</span>
                <input
                  type="checkbox"
                  checked={usePin}
                  onChange={(e) => setUsePin(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500"
                />
              </div>

              {usePin && (
                <input
                  type="password"
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Set 4-6 digit numeric PIN"
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              )}
            </div>

            {/* Upload Button or Progress Indicator */}
            {uploading ? (
              <div className="space-y-2">
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-150" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-center text-xs text-zinc-500 font-semibold">
                  {optimizing 
                    ? `Optimizing document quality...` 
                    : `Securely chunking & uploading file ${currentFileIndex + 1} of ${files.length} (${progress}% overall)`
                  }
                </div>
              </div>
            ) : (
              <button
                type="submit"
                disabled={files.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/20 dark:shadow-none hover:shadow-blue-500/30 transition-all cursor-pointer"
              >
                Generate Print Link & QR Code
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
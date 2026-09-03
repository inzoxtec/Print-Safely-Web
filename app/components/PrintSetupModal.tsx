// app/components/PrintSetupModal.tsx
"use client";

import React, { useState, useEffect } from "react";

export interface PrintSettings {
  selectedFileIndices: number[]; // 0-indexed file indices to print
  paperSize: "auto" | "a4" | "letter" | "legal" | "idcard";
  orientation: "auto" | "portrait" | "landscape";
  margin: "none" | "default" | "minimal";
  preset: "custom" | "idcard" | "standard" | "certificate";
  targetPrinter: string;
}

interface FileItem {
  name: string;
  type: string;
  decryptedUrl?: string;
}

interface PrintSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPrint: (settings: PrintSettings) => void;
  files: FileItem[];
  extensionInstalled: boolean;
  singleFileIndex?: number | null;
}

export default function PrintSetupModal({
  isOpen,
  onClose,
  onConfirmPrint,
  files,
  extensionInstalled,
  singleFileIndex = null,
}: PrintSetupModalProps) {
  // Preset state
  const [preset, setPreset] = useState<"custom" | "idcard" | "standard" | "certificate">("standard");

  // Selection states (indices of files array)
  const [selectedFileIndices, setSelectedFileIndices] = useState<number[]>([]);

  // Paper & Layout settings
  const [paperSize, setPaperSize] = useState<"auto" | "a4" | "letter" | "legal" | "idcard">("a4");
  const [orientation, setOrientation] = useState<"auto" | "portrait" | "landscape">("portrait");
  const [margin, setMargin] = useState<"none" | "default" | "minimal">("none");

  // Printer Selection state
  const [targetPrinter, setTargetPrinter] = useState<string>("default");
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);

  // Sync printer list dynamically based on extension connection state
  useEffect(() => {
    if (extensionInstalled) {
      setAvailablePrinters(["⚡ SafelyPrint Direct Hardware Printer (Extension Connected)"]);
      setTargetPrinter("⚡ SafelyPrint Direct Hardware Printer (Extension Connected)");
    } else {
      setAvailablePrinters(["Default Web Printer Driver (Browser Dialog)"]);
      setTargetPrinter("Default Web Printer Driver (Browser Dialog)");
    }
  }, [extensionInstalled, isOpen]);

  // Sync file selection when modal opens
  useEffect(() => {
    if (isOpen) {
      if (singleFileIndex !== null && singleFileIndex >= 0 && singleFileIndex < files.length) {
        // Individual file mode: select only the single clicked file
        setSelectedFileIndices([singleFileIndex]);
      } else {
        // Entire package mode: select all files by default
        const allIndices = files.map((_, idx) => idx);
        setSelectedFileIndices(allIndices);
      }
    }
  }, [isOpen, singleFileIndex, files]);

  // Apply Quick Presets
  const applyPreset = (selectedPreset: "idcard" | "standard" | "certificate") => {
    setPreset(selectedPreset);
    if (selectedPreset === "idcard") {
      setPaperSize("idcard");
      setOrientation("landscape");
      setMargin("none");
    } else if (selectedPreset === "standard") {
      setPaperSize("a4");
      setOrientation("portrait");
      setMargin("none");
    } else if (selectedPreset === "certificate") {
      setPaperSize("a4");
      setOrientation("landscape");
      setMargin("none");
    }
  };

  const toggleFileSelection = (fileIdx: number) => {
    // Only allow toggling if in package mode
    if (singleFileIndex !== null) return;
    
    setSelectedFileIndices((prev) => {
      if (prev.includes(fileIdx)) {
        if (prev.length === 1) return prev; // Keep at least 1 file selected
        return prev.filter((i) => i !== fileIdx);
      } else {
        return [...prev, fileIdx].sort((a, b) => a - b);
      }
    });
  };

  const handleConfirm = () => {
    onConfirmPrint({
      selectedFileIndices,
      paperSize,
      orientation,
      margin,
      preset,
      targetPrinter,
    });
  };

  if (!isOpen) return null;

  const isSingleFileMode = singleFileIndex !== null && singleFileIndex >= 0;
  const singleFile = isSingleFileMode ? files[singleFileIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 text-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600/10 text-blue-500 flex items-center justify-center text-xl font-bold">
              🖨️
            </div>
            <div>
              <h3 className="text-lg font-bold leading-tight">Print Setup & Customization</h3>
              <p className="text-xs text-zinc-400">
                {isSingleFileMode 
                  ? `Configure print layout for ${singleFile?.name || "file"}` 
                  : "Select attachments to print and configure paper layout"
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          
          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 block">
              Quick Document Presets
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => applyPreset("idcard")}
                className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  preset === "idcard"
                    ? "bg-amber-500/10 border-amber-500/50 text-amber-300"
                    : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <span className="text-base">💳</span>
                <span className="font-bold">ID / License</span>
                <span className="text-[10px] text-zinc-500">Horizontal ID sizing</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset("standard")}
                className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  preset === "standard"
                    ? "bg-blue-500/10 border-blue-500/50 text-blue-300"
                    : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <span className="text-base">📄</span>
                <span className="font-bold">Standard A4</span>
                <span className="text-[10px] text-zinc-500">Vertical Portrait layout</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset("certificate")}
                className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  preset === "certificate"
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300"
                    : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <span className="text-base">📜</span>
                <span className="font-bold">Certificate</span>
                <span className="text-[10px] text-zinc-500">Horizontal Landscape A4</span>
              </button>
            </div>
          </div>

          {/* Destination Printer Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-zinc-300 font-bold block">Destination Printer</label>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                extensionInstalled ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40" : "bg-zinc-800 text-zinc-400"
              }`}>
                {extensionInstalled ? "⚡ Hardware Extension Active" : "Standard Web Driver"}
              </span>
            </div>
            <select
              value={targetPrinter}
              onChange={(e) => setTargetPrinter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {availablePrinters.map((printerName, i) => (
                <option key={i} value={printerName}>
                  {printerName}
                </option>
              ))}
            </select>
          </div>

          {/* Layout & Paper Configuration */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Paper Size */}
            <div className="space-y-1.5">
              <label className="text-zinc-300 font-bold block">Paper Size</label>
              <select
                value={paperSize}
                onChange={(e) => {
                  setPreset("custom");
                  setPaperSize(e.target.value as any);
                }}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="auto">Auto-Detect Document Format</option>
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="letter">Letter (8.5 × 11 in)</option>
                <option value="legal">Legal (8.5 × 14 in)</option>
                <option value="idcard">ID Card / License (85.6 × 54 mm)</option>
              </select>
            </div>

            {/* Orientation (Vertical vs Horizontal) */}
            <div className="space-y-1.5">
              <label className="text-zinc-300 font-bold block">Orientation</label>
              <select
                value={orientation}
                onChange={(e) => {
                  setPreset("custom");
                  setOrientation(e.target.value as any);
                }}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="auto">Auto-Detect Orientation</option>
                <option value="portrait">Portrait (Vertical)</option>
                <option value="landscape">Landscape (Horizontal)</option>
              </select>
            </div>
          </div>

          {/* Margin Settings */}
          <div className="space-y-1.5">
            <label className="text-zinc-300 font-bold block">Page Margins</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMargin("none")}
                className={`py-2 px-3 rounded-xl border font-bold transition text-center cursor-pointer ${
                  margin === "none"
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-zinc-950/40 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                None (0mm)
              </button>
              <button
                type="button"
                onClick={() => setMargin("minimal")}
                className={`py-2 px-3 rounded-xl border font-bold transition text-center cursor-pointer ${
                  margin === "minimal"
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-zinc-950/40 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                Minimal (5mm)
              </button>
              <button
                type="button"
                onClick={() => setMargin("default")}
                className={`py-2 px-3 rounded-xl border font-bold transition text-center cursor-pointer ${
                  margin === "default"
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-zinc-950/40 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                Default
              </button>
            </div>
          </div>

          {/* Attachment Selection by Actual File Name */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-bold block">
                {isSingleFileMode ? "Target Attachment" : "Attachment Selection"}
              </span>
              <span className="text-zinc-500 text-[10px]">
                {isSingleFileMode ? "Single File Mode" : `${selectedFileIndices.length} of ${files.length} files selected`}
              </span>
            </div>

            {/* List of Attachments by Actual Name */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {files.map((file, idx) => {
                const isSelected = selectedFileIndices.includes(idx);
                const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";

                if (isSingleFileMode && idx !== singleFileIndex) return null;

                return (
                  <div
                    key={idx}
                    onClick={() => toggleFileSelection(idx)}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                      isSingleFileMode
                        ? "bg-blue-600/10 border-blue-500/40 text-white"
                        : isSelected
                        ? "bg-blue-600/20 border-blue-500 text-white cursor-pointer"
                        : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-lg flex-shrink-0">
                        {isSingleFileMode ? "📄" : isSelected ? "☑️" : "⬜"}
                      </span>
                      <div className="overflow-hidden text-left">
                        <p className="font-bold text-xs truncate max-w-[280px]">{file.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                          Format: {ext}
                        </p>
                      </div>
                    </div>

                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                      {ext}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 transition cursor-pointer flex items-center gap-2"
          >
            <span>
              🖨️ Print {isSingleFileMode ? "Attachment" : `(${selectedFileIndices.length}) Attachments`} Now
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}

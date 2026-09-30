// app/tools/csv-to-pdf/CsvToPdf.tsx
"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import ToolLayout from "@/app/components/ToolLayout";

export default function CsvToPdf() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  
  // Action states
  const [converting, setConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // Configuration options
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setProgressMsg("Loading rendering engines...");
    await loadScript("/vendor/docx/html2pdf.bundle.min.js", "html2pdf");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "txt") {
      alert("Only CSV files (.csv or comma-separated text) are supported locally.");
      return;
    }

    setFile(selectedFile);
    setOutputUrl(null);
    setOutputBlob(null);
  };

  // Helper to parse CSV handles double quotes and commas accurately offline
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    return lines.map(line => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }).filter(row => row.length > 0 && row.some(cell => cell !== ""));
  };

  const handleConvert = async () => {
    if (!file) return;
    setConverting(true);
    setProgressMsg("Preparing rendering targets...");

    // Create a temporary block element in standard page flow
    const hiddenContainer = document.createElement("div");
    hiddenContainer.id = "csv-render-container";
    hiddenContainer.style.width = orientation === "landscape" ? "1060px" : "794px";
    hiddenContainer.style.background = "#FFFFFF";
    hiddenContainer.style.color = "#000000";
    hiddenContainer.style.margin = "0 auto";
    hiddenContainer.style.padding = "20px";
    document.body.appendChild(hiddenContainer);

    // Save native String.fromCodePoint reference
    const originalFromCodePoint = String.fromCodePoint;

    try {
      await loadAllEngines();

      setProgressMsg("Parsing local CSV tables...");
      const textContent = await file.text();
      const rows = parseCSV(textContent);

      if (rows.length === 0) {
        throw new Error("No data found inside CSV file.");
      }

      setProgressMsg("Generating layout sheets...");

      // Reconstruct clean HTML table structure
      let tableHtml = "<table>";
      
      // Header row
      const headers = rows[0];
      tableHtml += "<thead><tr>";
      headers.forEach(h => {
        tableHtml += `<th>${h.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</th>`;
      });
      tableHtml += "</tr></thead><tbody>";

      // Data rows
      for (let i = 1; i < rows.length; i++) {
        const columns = rows[i];
        tableHtml += "<tr>";
        // Fill empty cells if line row count is shorter than header count
        for (let j = 0; j < headers.length; j++) {
          const val = columns[j] || "";
          tableHtml += `<td>${val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`;
        }
        tableHtml += "</tr>";
      }
      tableHtml += "</tbody></table>";

      hiddenContainer.innerHTML = `
        <style>
          #csv-render-container table { 
            border-collapse: collapse; 
            width: 100%; 
            font-family: sans-serif; 
            font-size: 9px; 
            margin-top: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          #csv-render-container td, #csv-render-container th { 
            border: 1px solid #e2e8f0; 
            padding: 5px; 
            text-align: left; 
          }
          #csv-render-container tr:nth-child(even) { 
            background-color: #f8fafc; 
          }
          #csv-render-container th { 
            background-color: #f1f5f9; 
            font-weight: bold; 
            color: #334155;
          }
        </style>
        <div style="page-break-after: always;">
          <h2 style="font-family: sans-serif; font-size: 13px; margin-bottom: 15px; color: #0f766e; border-bottom: 2px solid #14b8a6; padding-bottom: 4px;">
            CSV Sheet Data Report
          </h2>
          <div style="overflow-x: auto;">
            ${tableHtml}
          </div>
        </div>
      `;

      setProgressMsg("Compiling final vector PDF file...");

      // 1. Override String.fromCodePoint to catch html2canvas glyph RangeError
      String.fromCodePoint = function (...codePoints: number[]) {
        try {
          return originalFromCodePoint.apply(this, codePoints);
        } catch (err) {
          return "";
        }
      };

      // 2. Generate PDF via html2pdf using outputPdf("blob")
      const html2pdfEngine = (window as any).html2pdf;
      const pdfOptions = {
        margin: 10,
        filename: `${file.name.split(".")[0]}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: "mm", format: "a4", orientation: orientation }
      };

      const pdfBlobOutput = await html2pdfEngine()
        .from(hiddenContainer)
        .set(pdfOptions)
        .outputPdf("blob");

      const url = URL.createObjectURL(pdfBlobOutput);
      setOutputBlob(pdfBlobOutput);
      setOutputUrl(url);

    } catch (err) {
      console.error("CSV conversion failure:", err);
      alert("Failed to convert CSV file. Please make sure the format is valid.");
    } finally {
      // Reset loader
      setConverting(false);
      setProgressMsg("");

      // Restore native String.fromCodePoint
      String.fromCodePoint = originalFromCodePoint;

      // Clear rendering node
      if (document.body.contains(hiddenContainer)) {
        document.body.removeChild(hiddenContainer);
      }
    }
  };

  const handleForwardToSecureShare = async () => {
    if (!outputBlob) return;
    
    const name = `${file?.name?.split(".")[0]}.pdf`;
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
        { name: "CSV to PDF", url: "https://printsafely.app/tools/csv-to-pdf" },
      ]}
    >
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
          <i className="ri-file-list-3-line text-teal-600 dark:text-teal-500"></i> CSV to PDF Converter
        </h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-400">
          Convert CSV files (.csv) into structured PDF document sheets locally. Zero server uploads.
        </p>
      </div>

      {!file && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
          <div className="h-14 w-14 bg-teal-100 dark:bg-teal-900/20 text-teal-600 dark:text-teal-500 rounded-2xl flex items-center justify-center text-2xl">
            <i className="ri-file-list-3-fill"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Select CSV file to convert</p>
            <p className="text-[14px] text-zinc-400 dark:text-zinc-555 mt-1">Upload a CSV or TXT data file to compile.</p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer"
          >
            Choose CSV File
          </button>
        </div>
      )}

      {/* LOCAL INLINE LOADER */}
      {converting && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="animate-spin h-10 w-10 text-blue-600 border-4 border-t-transparent rounded-full mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-zinc-900 dark:text-white">Converting Sheet Data...</p>
            <p className="text-xs text-zinc-550 font-mono">{progressMsg}</p>
          </div>
        </div>
      )}

      {file && !outputUrl && !converting && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl space-y-6 shadow-sm">
          
          {/* File Info */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800">
            <div className="flex items-center gap-3.5 overflow-hidden">
              <div className="h-10 w-10 bg-teal-50 dark:bg-teal-900/10 text-teal-600 dark:text-teal-450 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                <i className="ri-file-list-line"></i>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{file.name}</p>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-555 font-semibold">Loaded CSV File</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs font-bold text-red-655 hover:underline cursor-pointer font-bold text-red-600"
            >
              Change File
            </button>
          </div>

          {/* Layout Config */}
          <div className="text-left">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Page Orientation
            </label>
            <select
              value={orientation}
              onChange={(e: any) => setOrientation(e.target.value)}
              className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer font-bold"
            >
              <option value="landscape">Landscape (Best for Wide Spreadsheets)</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>

          <div className="py-6 text-center text-xs text-zinc-555 dark:text-zinc-455 space-y-2">
            <i className="ri-shuffle-line text-blue-500 text-3xl"></i>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">Spreadsheet Render Pipeline</p>
            <p className="max-w-md mx-auto leading-relaxed">
              SafelyPrint renders comma-separated text databases into structural grids and exports A4 vector-based PDFs locally.
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
            <p className="text-xs text-zinc-455 dark:text-zinc-400">Your CSV file is converted. Secure share or download below.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
            <a
              href={outputUrl}
              download={`${file?.name?.split(".")[0]}.pdf`}
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
            Convert Another CSV
          </button>
        </div>
      )}
    </ToolLayout>
  );
}


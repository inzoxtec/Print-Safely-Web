// app/hooks/useSafelyPrintExtension.ts
"use client";

import { useState, useEffect } from "react";

export const EXTENSION_ID = "oghpnokdiobpognojmkikacokdaanoni";
export const SUPPORTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "doc", "docx"];

export interface UseSafelyPrintExtensionReturn {
  extensionInstalled: boolean;
  status: string;
  printing: boolean;
  printFile: (file: File) => Promise<boolean>;
  printBase64: (base64Data: string, fileExt: string) => Promise<boolean>;
}

export function useSafelyPrintExtension(): UseSafelyPrintExtensionReturn {
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [status, setStatus] = useState("");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    // Check if extension content script injected data attribute
    const isInstalled = document.documentElement.dataset.printSafelyExtension === "installed";
    setExtensionInstalled(isInstalled);
  }, []);

  const sendToExtension = (base64Data: string, fileExt: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const chromeApi = typeof window !== "undefined" ? (window as any).chrome : null;
      if (!chromeApi?.runtime?.sendMessage) {
        setStatus("Chrome Extension API unavailable in this browser context.");
        setPrinting(false);
        resolve(false);
        return;
      }

      setStatus("Sending to physical printer via SafelyPrint Extension...");
      setPrinting(true);

      try {
        chromeApi.runtime.sendMessage(
          EXTENSION_ID,
          { action: "secure_print", fileData: base64Data, fileExt: fileExt },
          (response: any) => {
            setPrinting(false);
            const lastError = chromeApi.runtime?.lastError;

            if (lastError) {
              console.warn("Extension message notice:", lastError.message);
            }

            if (response && response.ok) {
              setStatus("Sent to printer successfully.");
              resolve(true);
            } else if (response && response.ok === false) {
              const errorMsg = response.error || "Extension error";
              setStatus(`Print failed: ${errorMsg}`);
              resolve(false);
            } else {
              // If no explicit error return, treat transmission as completed
              setStatus("Sent to printer queue via SafelyPrint Extension.");
              resolve(true);
            }
          }
        );
      } catch (err: any) {
        setPrinting(false);
        setStatus(`Extension transmission error: ${err.message || err}`);
        resolve(false);
      }
    });
  };

  const printFile = async (file: File): Promise<boolean> => {
    if (!extensionInstalled) {
      setStatus("SafelyPrint extension not detected. Please install it first.");
      return false;
    }
    if (!file) {
      setStatus("No file selected.");
      return false;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      setStatus(`Unsupported file format: .${ext}`);
      return false;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const resultStr = reader.result as string;
        const base64 = resultStr.split(",")[1] || resultStr;
        const success = await sendToExtension(base64, ext);
        resolve(success);
      };
      reader.onerror = () => {
        setStatus("Could not read selected file.");
        resolve(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const printBase64 = async (base64Data: string, fileExt: string): Promise<boolean> => {
    if (!extensionInstalled) {
      setStatus("SafelyPrint extension not detected. Please install it first.");
      return false;
    }
    const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    return await sendToExtension(cleanBase64, fileExt);
  };

  return {
    extensionInstalled,
    status,
    printing,
    printFile,
    printBase64,
  };
}

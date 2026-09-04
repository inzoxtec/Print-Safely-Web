// app/hooks/useSafelyPrintExtension.ts
"use client";

import { useState, useEffect, useCallback } from "react";

export const EXTENSION_ID = "oghpnokdiobpognojmkikacokdaanoni";
export const SUPPORTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "doc", "docx"];

export interface PrintOptions {
  printerName?: string;
  paperSize?: string;
  orientation?: string;
  margin?: string;
}

export interface UseSafelyPrintExtensionReturn {
  extensionInstalled: boolean;
  printers: string[];
  status: string;
  printing: boolean;
  refreshPrinters: () => Promise<string[]>;
  printFile: (file: File, options?: PrintOptions) => Promise<boolean>;
  printBase64: (base64Data: string, fileExt: string, options?: PrintOptions) => Promise<boolean>;
}

export function useSafelyPrintExtension(): UseSafelyPrintExtensionReturn {
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [printing, setPrinting] = useState(false);

  const checkExtensionStatus = useCallback(() => {
    if (typeof document === "undefined") return;

    const chromeApi = typeof window !== "undefined" ? (window as any).chrome : null;
    
    if (chromeApi?.runtime?.sendMessage) {
      try {
        chromeApi.runtime.sendMessage(
          EXTENSION_ID,
          { action: "ping" },
          (response: any) => {
            const lastError = chromeApi.runtime?.lastError;
            if (lastError || !response || response.enabled === false) {
              setExtensionInstalled(false);
              if (document.documentElement) {
                document.documentElement.dataset.printSafelyExtension = "disabled";
              }
            } else {
              setExtensionInstalled(true);
              if (document.documentElement) {
                document.documentElement.dataset.printSafelyExtension = "installed";
              }
            }
          }
        );
      } catch (e) {
        setExtensionInstalled(false);
      }
    } else {
      const datasetState = document.documentElement.dataset.printSafelyExtension;
      if (datasetState === "installed") {
        setExtensionInstalled(true);
      } else {
        setExtensionInstalled(false);
      }
    }
  }, []);

  const refreshPrinters = async (): Promise<string[]> => {
    const chromeApi = typeof window !== "undefined" ? (window as any).chrome : null;
    if (!chromeApi?.runtime?.sendMessage) return [];

    return new Promise((resolve) => {
      chromeApi.runtime.sendMessage(
        EXTENSION_ID,
        { action: "list_printers" },
        (response: any) => {
          const lastError = chromeApi.runtime?.lastError;
          if (lastError) console.warn("List printers notice:", lastError.message);

          if (response && (response.extensionDisabled || response.enabled === false)) {
            setExtensionInstalled(false);
            setPrinters([]);
            resolve([]);
            return;
          }

          if (response && Array.isArray(response.printers)) {
            setPrinters(response.printers);
            resolve(response.printers);
          } else {
            chromeApi.runtime.sendMessage(
              EXTENSION_ID,
              { action: "get_printers" },
              (resp2: any) => {
                if (resp2 && Array.isArray(resp2.printers)) {
                  setPrinters(resp2.printers);
                  resolve(resp2.printers);
                } else {
                  setPrinters([]);
                  resolve([]);
                }
              }
            );
          }
        }
      );
    });
  };

  useEffect(() => {
    checkExtensionStatus();

    const handleStateChange = (e: any) => {
      if (e.detail?.enabled === false) {
        setExtensionInstalled(false);
      } else {
        checkExtensionStatus();
      }
    };

    window.addEventListener("safelyPrintStateChanged", handleStateChange);

    const observer = new MutationObserver(() => {
      checkExtensionStatus();
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-print-safely-extension"],
      });
    }

    return () => {
      window.removeEventListener("safelyPrintStateChanged", handleStateChange);
      observer.disconnect();
    };
  }, [checkExtensionStatus]);

  const sendToExtension = (
    base64Data: string, 
    fileExt: string, 
    options?: PrintOptions
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const chromeApi = typeof window !== "undefined" ? (window as any).chrome : null;
      if (!chromeApi?.runtime?.sendMessage) {
        setStatus("Chrome Extension API unavailable in this browser context.");
        setPrinting(false);
        setExtensionInstalled(false);
        resolve(false);
        return;
      }

      setStatus("Sending to physical printer via SafelyPrint Extension...");
      setPrinting(true);

      const payload = {
        action: "secure_print",
        fileData: base64Data,
        fileExt: fileExt,
        printerName: options?.printerName || "",
        paperSize: options?.paperSize || "a4",
        orientation: options?.orientation || "portrait",
        margin: options?.margin || "none",
      };

      try {
        chromeApi.runtime.sendMessage(
          EXTENSION_ID,
          payload,
          (response: any) => {
            setPrinting(false);
            const lastError = chromeApi.runtime?.lastError;

            if (lastError) {
              console.warn("Extension message notice:", lastError.message);
            }

            if (response && (response.extensionDisabled || response.enabled === false)) {
              setExtensionInstalled(false);
              setStatus("Extension printing disabled by user toggle.");
              resolve(false);
              return;
            }

            if (response && response.ok) {
              setStatus("Sent to printer successfully.");
              resolve(true);
            } else if (response && response.ok === false) {
              const errorMsg = response.error || "Extension error";
              setStatus(`Print failed: ${errorMsg}`);
              resolve(false);
            } else {
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

  const printFile = async (file: File, options?: PrintOptions): Promise<boolean> => {
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
        const success = await sendToExtension(base64, ext, options);
        resolve(success);
      };
      reader.onerror = () => {
        setStatus("Could not read selected file.");
        resolve(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const printBase64 = async (
    base64Data: string, 
    fileExt: string, 
    options?: PrintOptions
  ): Promise<boolean> => {
    if (!extensionInstalled) {
      setStatus("SafelyPrint extension not detected. Please install it first.");
      return false;
    }
    const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    return await sendToExtension(cleanBase64, fileExt, options);
  };

  return {
    extensionInstalled,
    printers,
    status,
    printing,
    refreshPrinters,
    printFile,
    printBase64,
  };
}

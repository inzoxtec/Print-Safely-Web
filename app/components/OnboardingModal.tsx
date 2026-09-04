// app/components/OnboardingModal.tsx
"use client";

import React, { useState, useEffect } from "react";

interface OnboardingModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function OnboardingModal({ isOpen: externalIsOpen, onClose: externalOnClose }: OnboardingModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Check localStorage for first time visit on mount
  useEffect(() => {
    if (externalIsOpen !== undefined) return;

    const hasSeenOnboarding = localStorage.getItem("safelyprint_onboarding_seen");
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => {
        setInternalIsOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [externalIsOpen]);

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleClose = () => {
    localStorage.setItem("safelyprint_onboarding_seen", "true");
    setInternalIsOpen(false);
    if (externalOnClose) {
      externalOnClose();
    }
  };

  if (!isOpen) return null;

  const slides = [
    {
      badge: "STEP 1: SECURE PRINT LINKS",
      badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      title: "How Secure Print Links Protect Your Files",
      desc: "Stop print shop owners from keeping copies of your driving license, IDs, and financial files on their computer downloads folder.",
      illustration: (
        <div className="w-full bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-zinc-800/60 pb-3">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              1. You Upload Document
            </span>
            <span className="text-zinc-600">➔</span>
            <span className="flex items-center gap-2 text-blue-400 font-bold">
              2. Generate 1-Time Link
            </span>
            <span className="text-zinc-600">➔</span>
            <span className="flex items-center gap-2 text-zinc-300">
              3. Shop Prints Paper
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 text-[11px] space-y-1">
              <div className="text-lg">📄</div>
              <div className="font-bold text-zinc-200">Your File</div>
              <div className="text-[9px] text-zinc-500">License / ID / PDF</div>
            </div>
            <div className="bg-blue-950/40 p-3 rounded-xl border border-blue-500/30 text-[11px] space-y-1">
              <div className="text-lg">🔐</div>
              <div className="font-bold text-blue-300">Print-Only Link</div>
              <div className="text-[9px] text-blue-400/80">Downloads 100% Blocked</div>
            </div>
            <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/30 text-[11px] space-y-1">
              <div className="text-lg">🖨️</div>
              <div className="font-bold text-emerald-300">Paper Print</div>
              <div className="text-[9px] text-emerald-400/80">Self-Destructs After Print</div>
            </div>
          </div>
        </div>
      ),
      features: [
        "Zero Download Buttons: Print shop cannot download or forward your PDF.",
        "Attempt Limits: Set 1-time print attempt then the link locks permanently.",
        "Security PIN: Require a secret passcode before opening document previews."
      ]
    },
    {
      badge: "STEP 2: CHROME EXTENSION SECURITY",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      title: "Direct Hardware Printer Spooling",
      badgeIcon: "⚡",
      desc: "For print shop owners or high-security printing, install the SafelyPrint Chrome Extension for instant hardware printing.",
      illustration: (
        <div className="w-full bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-300">
            <span className="font-bold flex items-center gap-2">
              ⚡ SafelyPrint Extension Connected
            </span>
            <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded font-mono">
              Hardware Direct Mode
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-amber-400 font-bold block text-[11px]">💳 ID Card Preset</span>
              <p className="text-[10px] text-zinc-400">85.6mm × 54mm horizontal license orientation</p>
            </div>
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-blue-400 font-bold block text-[11px]">📄 Standard A4</span>
              <p className="text-[10px] text-zinc-400">Vertical Portrait & Certificate Landscape</p>
            </div>
          </div>
        </div>
      ),
      features: [
        "Blocks 'Save as PDF' Leaks: Sends document straight to physical printer paper.",
        "Custom Presets: Quick sizing for ID Cards, Licenses, Certificates & A4.",
        "Multi-Printer Selector: Choose target paper printer directly from the setup modal."
      ]
    },
    {
      badge: "STEP 3: 100% OFFLINE PDF TOOLBOX",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      title: "Private Browser PDF Converter & Editor",
      desc: "Merge, split, sign, protect, and convert PDFs 100% locally on your computer with zero server uploads.",
      illustration: (
        <div className="w-full bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-purple-300 bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl">
            <span className="font-bold flex items-center gap-2">
              🛡️ 100% Offline Client-Side Sandbox
            </span>
            <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded font-mono">
              0 Server Uploads
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
              <div className="text-sm">🧩</div>
              <div className="font-bold text-zinc-300">Merge PDF</div>
            </div>
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
              <div className="text-sm">✂️</div>
              <div className="font-bold text-zinc-300">Split PDF</div>
            </div>
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
              <div className="text-sm">✍️</div>
              <div className="font-bold text-zinc-300">Sign PDF</div>
            </div>
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
              <div className="text-sm">🔒</div>
              <div className="font-bold text-zinc-300">Protect PDF</div>
            </div>
          </div>
        </div>
      ),
      features: [
        "100% Private: All processing happens in Web Assembly & Web Crypto inside your browser.",
        "Zero Cloud Leaks: Files are never uploaded to any external server disk.",
        "Comprehensive Suite: Convert Images, Word, Excel, CSV, and plain text to PDF."
      ]
    }
  ];

  const slide = slides[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 text-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center text-lg font-bold border border-blue-500/20">
              💡
            </div>
            <div>
              <h3 className="text-base font-extrabold leading-tight">Welcome to SafelyPrint</h3>
              <p className="text-[11px] text-zinc-400">Quick 30-Second Guide to Printing &amp; Document Security</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Step Badge */}
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${slide.badgeColor}`}>
              {slide.badge}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono font-bold">
              Step {currentStep + 1} of {slides.length}
            </span>
          </div>

          {/* Slide Title & Description */}
          <div className="space-y-1.5">
            <h4 className="text-lg font-extrabold text-zinc-100">{slide.title}</h4>
            <p className="text-xs leading-relaxed text-zinc-400">{slide.desc}</p>
          </div>

          {/* Slide Visual Illustration */}
          {slide.illustration}

          {/* Key Features Checkmarks */}
          <div className="space-y-2 pt-1">
            {slide.features.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-zinc-300">
                <span className="text-emerald-400 font-bold text-sm flex-shrink-0">✓</span>
                <span className="text-[11px] leading-snug">{feat}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950/70 flex items-center justify-between">
          
          {/* Step Indicator Dots */}
          <div className="flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  currentStep === i ? "w-6 bg-blue-500" : "w-2.5 bg-zinc-700 hover:bg-zinc-600"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Next / Action Buttons */}
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Back
              </button>
            )}

            {currentStep < slides.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <span>Next</span>
                <span>→</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <span>Got It! Start Printing</span>
                <span>🚀</span>
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

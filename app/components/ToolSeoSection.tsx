// app/components/ToolSeoSection.tsx
"use client";

import React, { useState } from "react";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ToolSeoSectionProps {
  title: string;
  subtitle: string;
  steps: { title: string; desc: string }[];
  features: { title: string; desc: string; icon: string }[];
  faqs: FaqItem[];
}

export default function ToolSeoSection({
  title,
  subtitle,
  steps,
  features,
  faqs,
}: ToolSeoSectionProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-16 space-y-16 border-t border-zinc-200/60 dark:border-zinc-800/60 mt-16">
      
      {/* 1. Primary Keyword Heading & Overview */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          {title}
        </h2>
        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* 2. Step-by-Step Guide */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white text-center">
          How It Works in 3 Easy Steps
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 relative flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
            >
              <div className="space-y-3">
                <span className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center text-sm">
                  {idx + 1}
                </span>
                <h4 className="text-base font-bold text-zinc-900 dark:text-white">
                  {step.title}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Privacy & Feature Breakdown */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white text-center">
          Why Choose SafelyPrint?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 space-y-2 backdrop-blur-sm"
            >
              <span className="text-2xl">{feat.icon}</span>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                {feat.title}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Interactive FAQ Accordion Section */}
      {faqs.length > 0 && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white text-center">
            Frequently Asked Questions
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-left p-5 text-sm font-bold text-zinc-900 dark:text-white flex justify-between items-center gap-4 cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <span className="text-zinc-400 text-lg transition-transform">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/40 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import React, { useEffect } from "react";

export function GoogleTranslateWidget({ id = "google_translate_element" }: { id?: string }) {
  useEffect(() => {
    const win = typeof window !== "undefined" ? (window as any) : null;
    if (!win) return;

    const initFnName = id === "google_translate_element" ? "googleTranslateElementInit" : `googleTranslateElementInit_${id}`;

    // Define the global callback expected by Google Translate script
    win[initFnName] = () => {
      if (win.google?.translate?.TranslateElement) {
        new win.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            layout: win.google.translate.TranslateElement.InlineLayout?.SIMPLE || 0,
            autoDisplay: false,
          },
          id
        );
      }
    };

    // Check if script is already present
    const existingScript = document.getElementById("google-translate-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.type = "text/javascript";
      script.src = `https://translate.google.com/translate_a/element.js?cb=${initFnName}`;
      script.async = true;
      document.body.appendChild(script);
    } else if (win.google?.translate?.TranslateElement) {
      win[initFnName]();
    }
  }, [id]);

  return (
    <div className="inline-flex items-center" title="Website Translation">
      {/* Standard Google Website Translator Container */}
      <div
        id={id}
        className="google-translate-container text-xs inline-block"
      />
    </div>
  );
}

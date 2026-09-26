"use client";

import React, { useEffect } from "react";

export function GoogleTranslateWidget() {
  useEffect(() => {
    const win = typeof window !== "undefined" ? (window as any) : null;
    if (!win) return;

    // Define the global callback expected by Google Translate script
    win.googleTranslateElementInit = () => {
      if (win.google?.translate?.TranslateElement) {
        new win.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            layout: win.google.translate.TranslateElement.InlineLayout?.SIMPLE || 0,
            autoDisplay: false,
          },
          "google_translate_element"
        );
      }
    };

    // Check if script is already present
    const existingScript = document.getElementById("google-translate-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.type = "text/javascript";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    } else if (win.google?.translate?.TranslateElement) {
      win.googleTranslateElementInit();
    }
  }, []);

  return (
    <div className="inline-flex items-center" title="Website Translation">
      {/* Standard Google Website Translator Container */}
      <div
        id="google_translate_element"
        className="google-translate-container text-xs inline-block"
      />
    </div>
  );
}

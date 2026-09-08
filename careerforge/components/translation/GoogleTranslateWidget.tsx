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
    <div className="flex items-center">
      {/* Standard Google Website Translator Container */}
      <div
        id="google_translate_element"
        className="google-translate-container text-xs inline-block"
        title="Translate webpage"
      />
      <style jsx global>{`
        /* Clean standard Google Translate styling without banner shift */
        .goog-te-gadget-simple {
          background-color: transparent !important;
          border: 1px solid #e5e7eb !important;
          padding: 4px 8px !important;
          font-size: 12px !important;
          line-height: 1.2 !important;
          display: inline-flex !important;
          align-items: center !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
        }
        .goog-te-gadget-simple:hover {
          background-color: #f9fafb !important;
          border-color: #d1d5db !important;
        }
        .goog-te-gadget-simple .goog-te-menu-value {
          color: #374151 !important;
          font-family: inherit !important;
          font-weight: 500 !important;
        }
        .goog-te-gadget-simple .goog-te-menu-value span {
          border-left-color: #9ca3af !important;
        }
        .goog-te-gadget-icon {
          margin-right: 4px !important;
          vertical-align: middle !important;
        }
        /* Prevent Google Top Frame from shifting the layout */
        body {
          top: 0px !important;
          position: static !important;
        }
        .skiptranslate iframe {
          display: none !important;
        }
        .goog-te-banner-frame {
          display: none !important;
        }
      `}</style>
    </div>
  );
}

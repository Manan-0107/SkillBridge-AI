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
      <style jsx global>{`
        /* Clean standard Google Translate styling without banner shift or distortion */
        .goog-te-gadget {
          font-family: inherit !important;
          color: transparent !important;
          font-size: 0px !important;
          display: inline-flex !important;
          align-items: center !important;
        }
        .goog-te-gadget-simple {
          background-color: #ffffff !important;
          border: 1px solid #e5e7eb !important;
          padding: 4px 10px !important;
          font-size: 12px !important;
          line-height: 1.2 !important;
          display: inline-flex !important;
          align-items: center !important;
          border-radius: 9999px !important;
          cursor: pointer !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          transition: all 0.15s ease !important;
          white-space: nowrap !important;
          text-decoration: none !important;
        }
        .goog-te-gadget-simple:hover {
          background-color: #f9fafb !important;
          border-color: #d1d5db !important;
        }
        .goog-te-gadget-simple .goog-te-menu-value {
          color: #374151 !important;
          font-family: inherit !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          display: inline-flex !important;
          align-items: center !important;
          white-space: nowrap !important;
          text-decoration: none !important;
        }
        .goog-te-gadget-simple .goog-te-menu-value span {
          border-left: none !important;
          color: #374151 !important;
          font-size: 12px !important;
          font-family: inherit !important;
          white-space: nowrap !important;
          text-decoration: none !important;
        }
        .goog-te-gadget-simple .goog-te-menu-value span:last-child {
          font-size: 8px !important;
          margin-left: 4px !important;
          color: #9ca3af !important;
        }
        /* Hide distorted low-resolution Google sprite icon */
        .goog-te-gadget-icon {
          display: none !important;
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

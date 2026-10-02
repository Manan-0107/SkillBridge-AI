import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * WCAG 2.1 Relative Luminance and Contrast Ratio calculation
 */
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function channelLuminance(channel) {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function getContrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test("Accessibility: Dark mode body text passes WCAG AA 4.5:1 minimum", () => {
  const canvas = "#0B0B0D";
  const bodyText = "#D2D5DF"; // charcoal-200
  const highlightText = "#F0F2F7"; // charcoal-100
  const mutedText = "#7E8291"; // charcoal-400

  const bodyRatio = getContrastRatio(canvas, bodyText);
  const highlightRatio = getContrastRatio(canvas, highlightText);
  const mutedRatio = getContrastRatio(canvas, mutedText);

  assert.ok(
    bodyRatio >= 4.5,
    `Body text contrast (${bodyRatio.toFixed(2)}) must be >= 4.5:1`
  );
  assert.ok(
    highlightRatio >= 7.0,
    `Highlight text contrast (${highlightRatio.toFixed(2)}) must be >= 7.0:1 (AAA)`
  );
  assert.ok(
    mutedRatio >= 4.5,
    `Muted secondary text contrast (${mutedRatio.toFixed(2)}) must be >= 4.5:1`
  );
});

test("Accessibility: Light mode text tokens pass WCAG AA 4.5:1 minimum", () => {
  const paper = "#FAFAF8";
  const ink = "#17171A";
  const graphite = "#5B5B60";

  const inkRatio = getContrastRatio(paper, ink);
  const graphiteRatio = getContrastRatio(paper, graphite);

  assert.ok(
    inkRatio >= 7.0,
    `Ink text contrast (${inkRatio.toFixed(2)}) must be >= 7.0:1 (AAA)`
  );
  assert.ok(
    graphiteRatio >= 4.5,
    `Graphite text contrast (${graphiteRatio.toFixed(2)}) must be >= 4.5:1`
  );
});

test("Accessibility: UI components & active badges meet 3:1 minimum contrast", () => {
  const canvas = "#0B0B0D";
  const activeAmber = "#F59E0B";
  const completedGreen = "#34D399";

  const amberRatio = getContrastRatio(canvas, activeAmber);
  const greenRatio = getContrastRatio(canvas, completedGreen);

  assert.ok(
    amberRatio >= 3.0,
    `Amber accent UI contrast (${amberRatio.toFixed(2)}) must be >= 3:1`
  );
  assert.ok(
    greenRatio >= 3.0,
    `Completed green UI contrast (${greenRatio.toFixed(2)}) must be >= 3:1`
  );
});

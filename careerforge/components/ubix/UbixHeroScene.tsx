"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * UbixHeroScene
 * 
 * Three.js abstract metallic light structure for the UBIX landing page hero.
 * Features:
 * - Fluid dual-torus metallic mesh structure with soft silver & icy cyan reflections
 * - Subtle pointer-reactive orientation and illumination shift
 * - Automatic cleanup on unmount to prevent WebGL context leaks
 * - Reduced-motion support (stops rotation and displays a clean static metallic frame)
 * - Zero React state overhead (all interaction handled within rAF)
 */
export function UbixHeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    // ─── Read primary accent from CSS single source of truth ─────────────────
    // --accent is the single authored hex value in ubix-effects.css.
    // THREE.Color accepts a hex string directly, so no conversion is needed.
    const rawAccent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
    // Fallback only if CSS variable is unavailable (e.g. SSR escape hatch)
    const accentHex = rawAccent.startsWith("#") ? rawAccent : "#7DE1EA";
    const accentColor = new THREE.Color(accentHex);

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.appendChild(renderer.domElement);

    // ─── Geometry & Materials (Metallic Silver + Icy Cyan Specular) ──────────
    // Outer Torus Knot Structure
    const knotGeometry = new THREE.TorusKnotGeometry(1.6, 0.38, isMobile ? 80 : 130, 24, 2, 3);
    const knotMaterial = new THREE.MeshStandardMaterial({
      color: 0x1A1F24,
      roughness: 0.28,
      metalness: 0.88,
      wireframe: false,
    });
    const knotMesh = new THREE.Mesh(knotGeometry, knotMaterial);
    scene.add(knotMesh);

    // Inner Wireframe Latitude Ring (Technical Precision Layer)
    // Color consumed from CSS --accent source, not hardcoded
    const ringGeometry = new THREE.IcosahedronGeometry(2.1, isMobile ? 1 : 2);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    scene.add(ringMesh);

    // ─── Lighting Setup (Restrained Studio Environment) ──────────────────────
    const ambientLight = new THREE.AmbientLight(0x0E1216, 2.5);
    scene.add(ambientLight);

    // Main Soft Silver Studio Key Light
    const keyLight = new THREE.DirectionalLight(0xD8E0E6, 3.2);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    // Subtle Icy Cyan Reflected Rim Light — color from CSS --accent source
    const cyanRimLight = new THREE.DirectionalLight(accentColor, 1.8);
    cyanRimLight.position.set(-4, -2, -2);
    scene.add(cyanRimLight);

    // Delicate Center Point Light
    const centerLight = new THREE.PointLight(0xBFC5CA, 1.2, 8);
    centerLight.position.set(0, 0, 2);
    scene.add(centerLight);

    // ─── Interactive Mouse Tracking ─────────────────────────────────────────
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouse.targetX = x * 2;
      mouse.targetY = -y * 2;
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });

    // ─── Animation Loop ─────────────────────────────────────────────────────
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const render = () => {
      const elapsedTime = clock.getElapsedTime();

      // Smooth pointer interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      if (!prefersReducedMotion) {
        // Organic metallic rotation
        knotMesh.rotation.x = elapsedTime * 0.18 + mouse.y * 0.4;
        knotMesh.rotation.y = elapsedTime * 0.24 + mouse.x * 0.5;

        ringMesh.rotation.x = -elapsedTime * 0.1 + mouse.y * 0.2;
        ringMesh.rotation.y = elapsedTime * 0.14 - mouse.x * 0.3;

        // Dynamic light tilt
        keyLight.position.x = 3 + mouse.x * 2;
        keyLight.position.y = 4 + mouse.y * 2;
      }

      renderer.render(scene, camera);

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    // Initial render
    render();

    // ─── Window Resize Handler ──────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };

    window.addEventListener("resize", handleResize);

    // ─── Cleanup on Unmount ─────────────────────────────────────────────────
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("resize", handleResize);

      knotGeometry.dispose();
      knotMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center pointer-events-none select-none"
      aria-hidden="true"
    />
  );
}

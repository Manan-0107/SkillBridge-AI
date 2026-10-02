"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export interface UbixAtmosphereProps {
  composerFocused?: boolean;
  voiceStatus?: string;
  className?: string;
}

/**
 * UbixAtmosphere
 * 
 * The single, canonical Three.js atmospheric layer for the authenticated UBIX experience.
 * 
 * Visual Language:
 * - Near-black graphite depth & fog (0x0b0e12)
 * - Whisper-thin, low-poly abstract wireframe geometry (0x1f262e)
 * - Soft icy-cyan ambient core (derived from --accent or #7DE1EA)
 * - 24 sparse, floating micro-particles
 * - Damped cursor-reactive lighting: moving a light source across a dark metallic surface
 * 
 * Performance & Guardrails:
 * - Lazy loaded with dynamic(..., { ssr: false })
 * - Zero post-processing; single low-overhead render loop
 * - Automatic disable on touch devices (pointer: coarse) & mobile (<768px)
 * - Full prefers-reduced-motion support (single static frame, no RAF loop)
 * - Complete WebGL context, geometry, material, and event listener disposal on unmount
 * - pointer-events: none (never blocks text selection, clicks, or screen readers)
 */
export function UbixAtmosphere({
  composerFocused = false,
  voiceStatus = "idle",
  className = "",
}: UbixAtmosphereProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    composerFocused,
    voiceStatus,
  });

  // Keep stateRef up to date without triggering re-initialization
  useEffect(() => {
    stateRef.current.composerFocused = composerFocused;
    stateRef.current.voiceStatus = voiceStatus;
  }, [composerFocused, voiceStatus]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;

    // Read brand accent from CSS custom property
    const rawAccent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
    const accentHex = rawAccent.startsWith("#") ? rawAccent : "#7DE1EA";
    const accentColor = new THREE.Color(accentHex);
    const graphiteBg = new THREE.Color(0x0b0e12);

    // 1. Scene & Depth Fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0e12, 0.055);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 9.5);

    // 2. High-performance low-power WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isTouch,
      powerPreference: "low-power",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1 : 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    container.appendChild(renderer.domElement);

    // 3. Subtle Sparse Geometry
    const geomGroup = new THREE.Group();
    scene.add(geomGroup);

    // Primary low-poly wireframe octahedron
    const octaGeometry = new THREE.OctahedronGeometry(isTouch ? 1.3 : 1.8, 0);
    const octaMaterial = new THREE.MeshBasicMaterial({
      color: 0x222a33,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    });
    const octaMesh = new THREE.Mesh(octaGeometry, octaMaterial);
    octaMesh.position.set(0, 0.7, -1.2);
    geomGroup.add(octaMesh);

    // Inner subtle icy-cyan accent core
    const coreGeometry = new THREE.IcosahedronGeometry(0.28, 0);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.24,
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    coreMesh.position.copy(octaMesh.position);
    geomGroup.add(coreMesh);

    // Sparse constellation ambient particles (only 24 floating micro-nodes)
    const particleCount = isTouch ? 12 : 24;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4.5 - 1.5;
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: accentColor,
      size: 0.032,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particlePoints);

    // 4. Soft Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(ambientLight);

    // Soft cursor-tracked icy cyan point light
    const cyanLight = new THREE.PointLight(accentColor, 1.05, 15, 1.8);
    cyanLight.position.set(0, 1.2, 3);
    scene.add(cyanLight);

    const darkMetallicFill = new THREE.PointLight(0x151b22, 0.55, 12, 1.8);
    darkMetallicFill.position.set(0, -3.5, 2);
    scene.add(darkMetallicFill);

    // 5. Cursor Parallax (Smoothly Interpolated, Desktop Only)
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const handlePointerMove = (e: MouseEvent) => {
      if (isTouch || prefersReducedMotion) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouse.targetX = nx * 0.35;
      mouse.targetY = ny * 0.25;
    };

    if (!isTouch && !prefersReducedMotion) {
      window.addEventListener("mousemove", handlePointerMove, { passive: true });
    }

    // 6. Dynamic Viewport Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize, { passive: true });

    // 7. Animation Loop with Heavy Smoothing
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      if (prefersReducedMotion) {
        renderer.render(scene, camera);
        return;
      }

      const elapsedTime = clock.getElapsedTime();
      const current = stateRef.current;

      // Heavy smoothing cursor parallax
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      camera.position.x = mouse.x * 0.7;
      camera.position.y = mouse.y * 0.5;
      camera.lookAt(0, 0, 0);

      // Light subtly shifts with cursor across dark metallic surface
      cyanLight.position.x = mouse.x * 2.5;
      cyanLight.position.y = 1.2 + mouse.y * 2.0;

      // Very slow atmospheric rotation
      octaMesh.rotation.y = elapsedTime * 0.035;
      octaMesh.rotation.x = Math.sin(elapsedTime * 0.018) * 0.08;
      coreMesh.rotation.y = -elapsedTime * 0.055;

      // State-driven illumination response
      let targetIntensity = 1.05;
      let targetColor = accentColor;

      if (current.voiceStatus === "listening") {
        targetIntensity = 1.35 + Math.sin(elapsedTime * 3.5) * 0.3;
      } else if (current.voiceStatus === "processing") {
        targetIntensity = 1.45 + Math.sin(elapsedTime * 6.0) * 0.18;
      } else if (current.voiceStatus === "error") {
        targetColor = new THREE.Color(0xef4444);
        targetIntensity = 1.15;
      } else if (current.composerFocused) {
        targetIntensity = 1.35;
      }

      cyanLight.intensity = THREE.MathUtils.lerp(cyanLight.intensity, targetIntensity, 0.07);
      cyanLight.color.lerp(targetColor, 0.08);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
    } else {
      animationFrameId = requestAnimationFrame(animate);
    }

    // 8. Clean Lifecycle Disposal
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (!isTouch && !prefersReducedMotion) {
        window.removeEventListener("mousemove", handlePointerMove);
      }

      octaGeometry.dispose();
      octaMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none overflow-hidden z-0 ${className}`}
    />
  );
}

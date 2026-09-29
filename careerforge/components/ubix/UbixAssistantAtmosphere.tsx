"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export interface UbixAssistantAtmosphereProps {
  composerFocused?: boolean;
  voiceStatus?: string;
  className?: string;
}

/**
 * UbixAssistantAtmosphere
 * 
 * Lightweight, GPU-friendly Three.js atmospheric layer for the authenticated Assistant.
 * 
 * Principles:
 * - FELT BEFORE NOTICED: extremely sparse abstract geometry, gentle fog, soft icy-cyan lighting.
 * - ZERO INTERACTION BLOCKING: pointer-events: none, strictly aria-hidden.
 * - SMOOTH PARALLAX: heavily damped cursor following on desktop; disabled on touch/mobile.
 * - REDUCED MOTION: static composition with zero continuous animation when requested.
 * - CLEAN LIFECYCLE: complete WebGL & listener disposal on unmount.
 */
export function UbixAssistantAtmosphere({
  composerFocused = false,
  voiceStatus = "idle",
  className = "",
}: UbixAssistantAtmosphereProps) {
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
    const graphiteColor = new THREE.Color(0x0e1114);

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0e1114, 0.05);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 9);

    // 2. Renderer
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
    // Center-top abstract geometric node (whisper-thin low-poly octahedron)
    const geomGroup = new THREE.Group();
    scene.add(geomGroup);

    const octaGeometry = new THREE.OctahedronGeometry(isTouch ? 1.4 : 1.9, 0);
    const octaMaterial = new THREE.MeshBasicMaterial({
      color: 0x242b33,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const octaMesh = new THREE.Mesh(octaGeometry, octaMaterial);
    octaMesh.position.set(0, 0.8, -1.5);
    geomGroup.add(octaMesh);

    // Subtle inner accent core point
    const coreGeometry = new THREE.IcosahedronGeometry(0.3, 0);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    coreMesh.position.copy(octaMesh.position);
    geomGroup.add(coreMesh);

    // Sparse constellation ambient particles (only 28 subtle dust nodes)
    const particleCount = isTouch ? 16 : 28;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 2;
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: accentColor,
      size: 0.035,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particlePoints);

    // 4. Soft Ambient & Cyan Point Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(accentColor, 1.1, 14, 1.8);
    cyanLight.position.set(0, 1.5, 3);
    scene.add(cyanLight);

    const graphiteLight = new THREE.PointLight(0x1a2128, 0.6, 12, 1.8);
    graphiteLight.position.set(0, -3, 2);
    scene.add(graphiteLight);

    // 5. Cursor Parallax Tracking (Damped, Desktop Only)
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const handlePointerMove = (e: MouseEvent) => {
      if (isTouch || prefersReducedMotion) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouse.targetX = nx * 0.4;
      mouse.targetY = ny * 0.3;
    };

    if (!isTouch && !prefersReducedMotion) {
      window.addEventListener("mousemove", handlePointerMove, { passive: true });
    }

    // 6. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize, { passive: true });

    // 7. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      if (prefersReducedMotion) {
        renderer.render(scene, camera);
        return; // Render static single frame
      }

      const elapsedTime = clock.getElapsedTime();
      const current = stateRef.current;

      // Heavy smoothing cursor parallax
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      camera.position.x = mouse.x * 0.8;
      camera.position.y = mouse.y * 0.6;
      camera.lookAt(0, 0, 0);

      // Very slow atmospheric rotation
      octaMesh.rotation.y = elapsedTime * 0.04;
      octaMesh.rotation.x = Math.sin(elapsedTime * 0.02) * 0.1;
      coreMesh.rotation.y = -elapsedTime * 0.06;

      // State-driven illumination response
      let targetIntensity = 1.1;
      let targetColor = accentColor;

      if (current.voiceStatus === "listening") {
        // Gentle breathing pulse
        targetIntensity = 1.35 + Math.sin(elapsedTime * 3.5) * 0.35;
      } else if (current.voiceStatus === "processing") {
        targetIntensity = 1.45 + Math.sin(elapsedTime * 6.0) * 0.2;
        cyanLight.position.x = Math.sin(elapsedTime * 1.5) * 2;
      } else if (current.voiceStatus === "error") {
        targetColor = new THREE.Color(0xef4444);
        targetIntensity = 1.2;
      } else if (current.composerFocused) {
        targetIntensity = 1.4;
      }

      cyanLight.intensity = THREE.MathUtils.lerp(cyanLight.intensity, targetIntensity, 0.08);
      cyanLight.color.lerp(targetColor, 0.1);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
    } else {
      animationFrameId = requestAnimationFrame(animate);
    }

    // 8. Cleanup on Unmount
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

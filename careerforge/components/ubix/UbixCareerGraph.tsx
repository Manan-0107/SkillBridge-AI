"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  FileText,
  Target,
  BookOpen,
  Code2,
  Briefcase,
  Map,
  Sparkles,
  ArrowRight,
  X,
  Play,
  Pause,
  RotateCcw,
  LucideIcon,
} from "lucide-react";

export type CareerNodeId =
  | "resume"
  | "skills"
  | "learning"
  | "practice"
  | "jobs"
  | "roadmap"
  | "ai";

export interface NodeDefinition {
  id: CareerNodeId;
  label: string;
  category: string;
  tagline: string;
  description: string;
  ctaText: string;
  position: [number, number, number]; // 3D coordinates
  icon: LucideIcon;
}

export const CAREER_NODES: NodeDefinition[] = [
  {
    id: "resume",
    label: "Resume",
    category: "Profile Intelligence",
    tagline: "UNDERSTAND YOUR PROFILE",
    description: "Extract verified competencies, analyze ATS compatibility, and anchor your career data in one living profile.",
    ctaText: "ANALYZE RESUME",
    position: [-3.2, -1.0, 0.4],
    icon: FileText,
  },
  {
    id: "skills",
    label: "Skill Gap",
    category: "Gap Analysis",
    tagline: "SKILL GAP ANALYSIS",
    description: "Understand what you're missing before you start learning. Compare your profile against target roles in real-time.",
    ctaText: "EXPLORE GAPS",
    position: [-2.1, 1.3, -0.3],
    icon: Target,
  },
  {
    id: "learning",
    label: "Learning",
    category: "Adaptive Curriculum",
    tagline: "CLOSE YOUR SKILL GAPS",
    description: "Master verified fundamentals through sequenced micro-lessons tailored directly to your missing proficiencies.",
    ctaText: "EXPLORE LEARNING",
    position: [0.0, 2.3, 0.4],
    icon: BookOpen,
  },
  {
    id: "practice",
    label: "Practice",
    category: "Real-world Validation",
    tagline: "VALIDATE YOUR CAPABILITIES",
    description: "Prove your skills with real-world coding problems and behavioral interview simulations before applying.",
    ctaText: "START PRACTICE",
    position: [2.2, 1.2, -0.3],
    icon: Code2,
  },
  {
    id: "jobs",
    label: "Jobs",
    category: "Opportunity Matching",
    tagline: "FIND YOUR NEXT OPPORTUNITY",
    description: "Discover roles where your verified skills match employer requirements. No spam, no misaligned interviews.",
    ctaText: "EXPLORE JOBS",
    position: [3.3, -0.7, 0.5],
    icon: Briefcase,
  },
  {
    id: "roadmap",
    label: "Career Roadmap",
    category: "Milestone Trajectory",
    tagline: "NAVIGATE YOUR TRAJECTORY",
    description: "Adaptive milestones that update dynamically as you learn, build, and master new competencies.",
    ctaText: "EXPLORE ROADMAP",
    position: [1.6, -2.1, -0.3],
    icon: Map,
  },
  {
    id: "ai",
    label: "AI Assistant",
    category: "Intelligence Layer",
    tagline: "I CONNECT THE DOTS.",
    description: "The connective tissue across your entire journey. Voice-enabled, keyboard-ready, and aware of your complete profile.",
    ctaText: "TALK TO ASSISTANT",
    position: [-0.6, -0.2, 2.3],
    icon: Sparkles,
  },
];

interface UbixCareerGraphProps {
  onNodeSelect?: (nodeId: CareerNodeId) => void;
  onCtaClick?: (nodeId: CareerNodeId | "core") => void;
}

export function UbixCareerGraph({ onNodeSelect, onCtaClick }: UbixCareerGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeButtonsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // UI state
  const [selectedNode, setSelectedNode] = useState<CareerNodeId | null>(null);
  const [hoveredNode, setHoveredNode] = useState<CareerNodeId | null>(null);
  const [isCoreExpanded, setIsCoreExpanded] = useState(false);
  const [coreDiscoveryText, setCoreDiscoveryText] = useState<string | null>(null);
  const [introStep, setIntroStep] = useState<number>(0); // 0 = complete or reduced motion, 1..8 during sequence
  const [autoTourActive, setAutoTourActive] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  const [journeyStage, setJourneyStage] = useState<number>(-1); // 0: resume->skills, 1: skills->learning, 2: learning->practice, 3: practice->jobs

  // References for mutable animation state
  const stateRef = useRef({
    selectedNode: null as CareerNodeId | null,
    hoveredNode: null as CareerNodeId | null,
    isCoreExpanded: false,
    introStep: 0,
    autoTourActive: true,
    lastInteractionTime: Date.now(),
    journeyStage: -1,
    journeyTimer: 0,
  });

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current.selectedNode = selectedNode;
    stateRef.current.hoveredNode = hoveredNode;
    stateRef.current.isCoreExpanded = isCoreExpanded;
    stateRef.current.introStep = introStep;
    stateRef.current.autoTourActive = autoTourActive;
    stateRef.current.journeyStage = journeyStage;
  }, [selectedNode, hoveredNode, isCoreExpanded, introStep, autoTourActive, journeyStage]);

  // Handle mobile check
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedNode(null);
        setHoveredNode(null);
        setIsCoreExpanded(false);
      } else if (e.key >= "1" && e.key <= "7") {
        const index = parseInt(e.key, 10) - 1;
        if (CAREER_NODES[index]) {
          handleSelectNode(CAREER_NODES[index].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Intro sequence orchestration
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIntroStep(0); // instant full visibility
      return;
    }

    setIntroStep(1);

    const timeouts: NodeJS.Timeout[] = [];
    timeouts.push(setTimeout(() => setIntroStep(2), 1200)); // Resume
    timeouts.push(setTimeout(() => setIntroStep(3), 2000)); // Skill Gap
    timeouts.push(setTimeout(() => setIntroStep(4), 2800)); // Learning
    timeouts.push(setTimeout(() => setIntroStep(5), 3600)); // Practice
    timeouts.push(setTimeout(() => setIntroStep(6), 4400)); // Jobs
    timeouts.push(setTimeout(() => setIntroStep(7), 5200)); // Career Roadmap
    timeouts.push(setTimeout(() => setIntroStep(8), 6000)); // AI Assistant + connect all
    timeouts.push(setTimeout(() => setIntroStep(0), 7600)); // Complete

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  // Core discovery moment interaction
  const triggerCoreDiscovery = useCallback(() => {
    setIsCoreExpanded(true);
    setSelectedNode(null);
    setCoreDiscoveryText("THIS IS YOUR CAREER SYSTEM.");

    setTimeout(() => {
      setCoreDiscoveryText("UBIX CONNECTS THE DOTS.");
    }, 1800);

    setTimeout(() => {
      setIsCoreExpanded(false);
      setCoreDiscoveryText(null);
    }, 4200);
  }, []);

  // Node selection handler
  const handleSelectNode = useCallback(
    (id: CareerNodeId) => {
      setSelectedNode((prev) => (prev === id ? null : id));
      stateRef.current.lastInteractionTime = Date.now();
      stateRef.current.autoTourActive = false;
      setAutoTourActive(false);

      if (id === "resume" || id === "ai") {
        stateRef.current.journeyStage = 0;
        stateRef.current.journeyTimer = 0;
        setJourneyStage(0);
      } else {
        stateRef.current.journeyStage = -1;
        stateRef.current.journeyTimer = 0;
        setJourneyStage(-1);
      }

      onNodeSelect?.(id);
    },
    [onNodeSelect]
  );

  // Auto-tour idle timer
  useEffect(() => {
    if (!autoTourActive) {
      // Re-enable auto-tour after 6s of silence
      const checkIdle = setInterval(() => {
        if (Date.now() - stateRef.current.lastInteractionTime > 6000 && !stateRef.current.selectedNode && !stateRef.current.isCoreExpanded) {
          setAutoTourActive(true);
        }
      }, 2000);
      return () => clearInterval(checkIdle);
    }
  }, [autoTourActive]);

  // Main Three.js Scene Implementation
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── Read primary accent from CSS single source of truth ──
    const rawAccent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
    const accentHex = rawAccent.startsWith("#") ? rawAccent : "#7DE1EA";
    const accentColor = new THREE.Color(accentHex);
    const accentDimColor = new THREE.Color(accentHex).multiplyScalar(0.4);

    // Scene & Camera
    const scene = new THREE.Scene();
    let width = container.clientWidth || 800;
    let height = container.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const defaultCamPos = new THREE.Vector3(0, 0, 7.8);
    camera.position.copy(defaultCamPos);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Canvas insertion
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    // ── Lighting ──
    const ambientLight = new THREE.AmbientLight(0x0a0d11, 2.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xdde5eb, 3.0);
    keyLight.position.set(4, 5, 6);
    scene.add(keyLight);

    const accentRimLight = new THREE.DirectionalLight(accentColor, 2.2);
    accentRimLight.position.set(-5, -2, 2);
    scene.add(accentRimLight);

    // ── 1. Central Career Core ──
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // Crystalline neural core (faceted inner nucleus)
    const coreGeo = new THREE.IcosahedronGeometry(0.85, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x14181d,
      roughness: 0.22,
      metalness: 0.88,
      emissive: new THREE.Color(accentHex).multiplyScalar(0.08),
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Outer crystalline wireframe lattice
    const cageGeo = new THREE.IcosahedronGeometry(1.22, 1);
    const cageMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.24,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    coreGroup.add(cageMesh);

    // Inner glowing nucleus
    const nucleusGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const nucleusMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.75,
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    coreGroup.add(nucleusMesh);

    // ── 2. Particle Swarm Around Core & Universe ──
    const particleCount = 140;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.3 + Math.random() * 3.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      particlePositions[i * 3] = radius * Math.cos(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi) * Math.sin(theta);
      particleScales[i] = 0.5 + Math.random() * 0.9;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: accentColor,
      size: 0.045,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // ── 3. Career Nodes in 3D ──
    const nodeMeshes: { [id: string]: THREE.Group } = {};
    const nodePositions: { [id: string]: THREE.Vector3 } = {};

    CAREER_NODES.forEach((node) => {
      const group = new THREE.Group();
      const pos = new THREE.Vector3(...node.position);
      group.position.copy(pos);
      nodePositions[node.id] = pos;

      // Node central diamond/octahedron
      const geom = new THREE.OctahedronGeometry(node.id === "ai" ? 0.32 : 0.25, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: node.id === "ai" ? 0x222a30 : 0x171c22,
        roughness: 0.25,
        metalness: 0.85,
        emissive: node.id === "ai" ? new THREE.Color(accentHex).multiplyScalar(0.2) : 0x000000,
      });
      const mesh = new THREE.Mesh(geom, mat);
      group.add(mesh);

      // Node aura ring
      const ringGeo = new THREE.RingGeometry(0.38, 0.42, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: node.id === "ai" ? 0.45 : 0.25,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      group.add(ring);

      nodeMeshes[node.id] = group;
      scene.add(group);
    });

    // ── 4. Connection System (Bezier Curves & Pulses) ──
    interface ConnectionLine {
      fromId: string;
      toId: string;
      curve: THREE.QuadraticBezierCurve3;
      lineMesh: THREE.Line;
      pulseMesh: THREE.Mesh;
      pulseProgress: number;
      active: boolean;
      speed: number;
    }

    const connections: ConnectionLine[] = [];

    const createCurve = (v1: THREE.Vector3, v2: THREE.Vector3, curvature = 0.25) => {
      const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      // Lift midpoint slightly away from center for elegant curve
      const normal = mid.clone().normalize().multiplyScalar(curvature);
      mid.add(normal);
      return new THREE.QuadraticBezierCurve3(v1, mid, v2);
    };

    // Connection pairs:
    // Core connects to all nodes (spokes)
    CAREER_NODES.forEach((n) => {
      const curve = createCurve(new THREE.Vector3(0, 0, 0), nodePositions[n.id], 0.15);
      const points = curve.getPoints(32);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: accentDimColor,
        transparent: true,
        opacity: 0.15,
      });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      scene.add(lineMesh);

      // Traveling pulse sphere
      const pulseGeo = new THREE.SphereGeometry(0.06, 12, 12);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0,
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      scene.add(pulseMesh);

      connections.push({
        fromId: "core",
        toId: n.id,
        curve,
        lineMesh,
        pulseMesh,
        pulseProgress: Math.random(),
        active: false,
        speed: 0.4 + Math.random() * 0.3,
      });
    });

    // Flow chain connections:
    // Resume -> Skill Gap -> Learning -> Practice -> Jobs -> Roadmap -> Resume
    const pipelinePairs: [CareerNodeId, CareerNodeId][] = [
      ["resume", "skills"],
      ["skills", "learning"],
      ["learning", "practice"],
      ["practice", "jobs"],
      ["jobs", "roadmap"],
      ["roadmap", "resume"],
    ];

    pipelinePairs.forEach(([fromId, toId]) => {
      const curve = createCurve(nodePositions[fromId], nodePositions[toId], 0.3);
      const points = curve.getPoints(36);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.22,
      });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      scene.add(lineMesh);

      const pulseGeo = new THREE.SphereGeometry(0.075, 12, 12);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0,
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      scene.add(pulseMesh);

      connections.push({
        fromId,
        toId,
        curve,
        lineMesh,
        pulseMesh,
        pulseProgress: 0,
        active: false,
        speed: 0.65,
      });
    });

    // AI Assistant connects to all other 6 nodes
    const otherNodes = CAREER_NODES.filter((n) => n.id !== "ai");
    otherNodes.forEach((n) => {
      const curve = createCurve(nodePositions["ai"], nodePositions[n.id], -0.2);
      const points = curve.getPoints(32);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.12,
      });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      scene.add(lineMesh);

      const pulseGeo = new THREE.SphereGeometry(0.065, 12, 12);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0,
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      scene.add(pulseMesh);

      connections.push({
        fromId: "ai",
        toId: n.id,
        curve,
        lineMesh,
        pulseMesh,
        pulseProgress: 0,
        active: false,
        speed: 0.75,
      });
    });

    // Mouse tracking for parallax
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouse.targetX = x * 1.5;
      mouse.targetY = -y * 1.5;
      stateRef.current.lastInteractionTime = Date.now();
    };
    window.addEventListener("mousemove", handlePointerMove, { passive: true });

    // ── Main Render Loop ──
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let autoTourTimer = 0;
    let autoTourIndex = 0;

    const render = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const { selectedNode: activeSelected, hoveredNode: activeHovered, isCoreExpanded: activeExpanded, introStep: currentIntro, autoTourActive: touring } = stateRef.current;

      // Mouse smooth interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // ── Core Rotation ──
      coreGroup.rotation.y = elapsed * 0.2 + mouse.x * 0.3;
      coreGroup.rotation.x = elapsed * 0.1 + mouse.y * 0.2;

      // Core scaling (discovery moment burst)
      const targetCoreScale = activeExpanded ? 1.6 : 1.0;
      coreGroup.scale.lerp(new THREE.Vector3(targetCoreScale, targetCoreScale, targetCoreScale), 0.08);

      // Particle subtle rotation
      particlePoints.rotation.y = -elapsed * 0.05;
      particlePoints.rotation.x = elapsed * 0.02;

      // ── Intro Step Visibility Handling ──
      // Mapping intro step (1..8) to visible nodes
      // Step 1: Core only
      // Step 2: Resume
      // Step 3: Skill Gap
      // Step 4: Learning
      // Step 5: Practice
      // Step 6: Jobs
      // Step 7: Roadmap
      // Step 8: AI Assistant + all
      const isVisibleInIntro = (nodeId: CareerNodeId) => {
        if (currentIntro === 0) return true; // full view
        if (currentIntro >= 2 && nodeId === "resume") return true;
        if (currentIntro >= 3 && nodeId === "skills") return true;
        if (currentIntro >= 4 && nodeId === "learning") return true;
        if (currentIntro >= 5 && nodeId === "practice") return true;
        if (currentIntro >= 6 && nodeId === "jobs") return true;
        if (currentIntro >= 7 && nodeId === "roadmap") return true;
        if (currentIntro >= 8 && nodeId === "ai") return true;
        return false;
      };

      // ── Node Updates ──
      CAREER_NODES.forEach((node) => {
        const group = nodeMeshes[node.id];
        if (!group) return;

        const visible = isVisibleInIntro(node.id);
        const isFocused = activeSelected === node.id || activeHovered === node.id;
        const targetScale = visible ? (isFocused ? 1.35 : 1.0) : 0.001;

        group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

        // Rotation & float
        group.rotation.y = elapsed * 0.35;
        group.rotation.x = elapsed * 0.2;
        group.position.y = nodePositions[node.id].y + Math.sin(elapsed * 1.5 + node.position[0]) * 0.06;
      });

      // ── Auto-Tour Logic ──
      if (touring && currentIntro === 0 && !activeSelected && !activeExpanded) {
        autoTourTimer += delta;
        if (autoTourTimer > 3.8) {
          autoTourTimer = 0;
          autoTourIndex = (autoTourIndex + 1) % CAREER_NODES.length;
          // Trigger a pulse along the chain
          stateRef.current.hoveredNode = CAREER_NODES[autoTourIndex].id;
        }
      }

      // ── Camera Position Lerping ──
      const targetCam = defaultCamPos.clone();
      if (activeExpanded) {
        // Pulled back overview
        targetCam.set(0, 0, 10.5);
      } else if (activeSelected) {
        // Focus near the selected node
        const nodePos = nodePositions[activeSelected];
        targetCam.set(nodePos.x * 0.6, nodePos.y * 0.6, 6.2);
      } else if (activeHovered) {
        const nodePos = nodePositions[activeHovered];
        targetCam.set(nodePos.x * 0.25 + mouse.x * 0.5, nodePos.y * 0.25 + mouse.y * 0.5, 7.6);
      } else {
        // Normal interactive parallax
        targetCam.x = mouse.x * 0.8;
        targetCam.y = mouse.y * 0.8;
        targetCam.z = 7.8;
      }
      camera.position.lerp(targetCam, 0.04);
      camera.lookAt(0, 0, 0);

      // ── Journey Sequence Timer (Resume / AI) ──
      const journeyLegPairs: [string, string][] = [
        ["resume", "skills"],
        ["skills", "learning"],
        ["learning", "practice"],
        ["practice", "jobs"],
      ];

      if (activeSelected === "resume" || activeSelected === "ai") {
        stateRef.current.journeyTimer += delta;
        const legDuration = 1.1;
        const currentLeg = Math.floor(stateRef.current.journeyTimer / legDuration) % 4;
        if (stateRef.current.journeyStage !== currentLeg) {
          stateRef.current.journeyStage = currentLeg;
          setJourneyStage(currentLeg);
        }
      } else {
        if (stateRef.current.journeyStage !== -1) {
          stateRef.current.journeyStage = -1;
          stateRef.current.journeyTimer = 0;
          setJourneyStage(-1);
        }
      }

      // ── Connection Pulses Animation ──
      connections.forEach((conn) => {
        const fromVisible = conn.fromId === "core" || isVisibleInIntro(conn.fromId as CareerNodeId);
        const toVisible = isVisibleInIntro(conn.toId as CareerNodeId);
        const canShow = fromVisible && toVisible;

        // Is connection currently part of the active sequential journey?
        const activeLeg = (activeSelected === "resume" || activeSelected === "ai") ? stateRef.current.journeyStage : -1;
        const isCurrentJourneyLeg =
          activeLeg >= 0 &&
          activeLeg < journeyLegPairs.length &&
          conn.fromId === journeyLegPairs[activeLeg][0] &&
          conn.toId === journeyLegPairs[activeLeg][1];

        // Is connection highlighted?
        const isConnectedToSelected =
          isCurrentJourneyLeg ||
          activeSelected === conn.fromId ||
          activeSelected === conn.toId ||
          (activeSelected === "ai" && (conn.fromId === "ai" || conn.toId === "ai")) ||
          activeExpanded;

        const lineMaterial = conn.lineMesh.material as THREE.LineBasicMaterial;
        const pulseMaterial = conn.pulseMesh.material as THREE.MeshBasicMaterial;

        if (!canShow) {
          lineMaterial.opacity = 0;
          pulseMaterial.opacity = 0;
          return;
        }

        // Line brightness
        const targetLineOpacity = activeExpanded
          ? 0.55
          : isCurrentJourneyLeg
          ? 0.75
          : isConnectedToSelected
          ? 0.45
          : activeSelected
          ? 0.08
          : 0.18;
        lineMaterial.opacity = THREE.MathUtils.lerp(lineMaterial.opacity, targetLineOpacity, 0.08);

        // Advance pulse progress
        const speedMultiplier = isCurrentJourneyLeg ? 1.6 : 1.0;
        conn.pulseProgress = (conn.pulseProgress + delta * conn.speed * speedMultiplier) % 1.0;
        const pulsePoint = conn.curve.getPoint(conn.pulseProgress);
        conn.pulseMesh.position.copy(pulsePoint);

        const shouldPulse = isCurrentJourneyLeg || isConnectedToSelected || activeExpanded || conn.fromId !== "core";
        const targetPulseOpacity = isCurrentJourneyLeg ? 1.0 : shouldPulse ? 0.85 : 0.0;
        pulseMaterial.opacity = THREE.MathUtils.lerp(pulseMaterial.opacity, targetPulseOpacity, 0.1);
      });

      // ── Project 3D Node Positions to 2D HTML Screen Coordinates ──
      CAREER_NODES.forEach((node) => {
        const btn = nodeButtonsRef.current[node.id];
        if (!btn) return;

        const group = nodeMeshes[node.id];
        if (!group) return;

        const visible = isVisibleInIntro(node.id);
        if (!visible) {
          btn.style.opacity = "0";
          btn.style.pointerEvents = "none";
          return;
        }

        const worldPos = new THREE.Vector3();
        group.getWorldPosition(worldPos);

        // Project into normalized device coords [-1, 1]
        const projected = worldPos.clone().project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * width;
        const screenY = (-projected.y * 0.5 + 0.5) * height;

        btn.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%)`;
        btn.style.opacity = activeSelected && activeSelected !== node.id ? "0.45" : "1";
        btn.style.pointerEvents = "auto";
      });

      renderer.render(scene, camera);

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || 800;
      height = container.clientHeight || 600;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handlePointerMove);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, []);

  const activeNodeData = CAREER_NODES.find((n) => n.id === selectedNode);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[620px] sm:h-[720px] lg:h-[820px] select-none overflow-hidden rounded-3xl border border-white/[0.07] bg-[#080A0D]"
      role="region"
      aria-label="Interactive 3D Career System Graph"
    >
      {/* Background radial ambiance */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(125, 225, 234, 0.04) 0%, transparent 68%)",
        }}
      />

      {/* ── Signature Sequence Intro Overlay ── */}
      {introStep > 0 && (
        <div
          className="absolute top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none text-center transition-all duration-500"
          aria-live="polite"
        >
          {introStep === 1 && (
            <div className="space-y-1 animate-fade-in">
              <span className="font-display text-2xl font-bold tracking-tight text-white">ubix</span>
              <p className="text-xs font-mono text-[#8B9096] tracking-widest uppercase">Career Intelligence</p>
            </div>
          )}
          {introStep >= 2 && introStep <= 7 && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-[#121518]/80 backdrop-blur-md text-xs font-mono text-[--accent]">
              <span className="w-1.5 h-1.5 rounded-full bg-[--accent] animate-ping" />
              <span>ACTIVATING: {CAREER_NODES[introStep - 2]?.label.toUpperCase()}</span>
            </div>
          )}
          {introStep === 8 && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[--accent]/30 bg-[#121518]/90 backdrop-blur-md text-xs font-mono text-[--accent] shadow-[0_0_20px_rgba(125,225,234,0.25)]">
              <Sparkles size={14} className="animate-spin" />
              <span>SYNCHRONIZING INTELLIGENCE LAYER</span>
            </div>
          )}
        </div>
      )}

      {/* Skip Intro Button */}
      {introStep > 0 && (
        <button
          type="button"
          onClick={() => setIntroStep(0)}
          className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-lg border border-white/10 bg-[#0D0F12]/80 backdrop-blur-sm text-xs font-medium text-[#8B9096] hover:text-white hover:border-white/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
          aria-label="Skip sequence"
        >
          Skip Intro
        </button>
      )}

      {/* ── Discovery Moment Banner (Clicked Core) ── */}
      {coreDiscoveryText && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none p-6 text-center"
          aria-live="assertive"
        >
          <div className="max-w-xl p-8 rounded-2xl border border-[--accent]/40 bg-[#080A0D]/90 backdrop-blur-xl shadow-[0_0_60px_rgba(125,225,234,0.2)] animate-in fade-in zoom-in-95 duration-300">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[--accent]/20 text-[10px] font-mono tracking-widest text-[--accent] uppercase mb-3">
              ubix living network
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white mb-2">
              {coreDiscoveryText}
            </h2>
            <p className="text-xs sm:text-sm text-[#8B9096] font-mono">
              Resume &rarr; Skills &rarr; Learning &rarr; Practice &rarr; Opportunities
            </p>
          </div>
        </div>
      )}

      {/* ── Center Career Core Interactive Trigger ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
        <button
          id="career-core-btn"
          type="button"
          onClick={triggerCoreDiscovery}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              triggerCoreDiscovery();
            }
          }}
          className="group relative flex flex-col items-center justify-center p-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] transition-transform duration-300 hover:scale-110 cursor-pointer"
          aria-label="Career Core: ubix Career Intelligence. Click to expand system universe."
        >
          {/* Subtle pulse ring around core */}
          <span
            className="absolute inset-0 rounded-full border border-[--accent]/30 group-hover:border-[--accent] transition-colors"
            style={{ animation: "ubix-orb-pulse 2.4s ease-in-out infinite" }}
          />
          <div className="w-16 h-16 rounded-full bg-[#080A0D]/80 backdrop-blur-sm border border-white/10 flex flex-col items-center justify-center text-center">
            <span className="font-display text-xs font-bold text-white tracking-tight">ubix</span>
            <span className="text-[8px] font-mono text-[--accent] tracking-wider uppercase">core</span>
          </div>
        </button>
      </div>

      {/* ── Accessible Interactive HTML Nodes Overlay ── */}
      {CAREER_NODES.map((node) => {
        const Icon = node.icon;
        const isSelected = selectedNode === node.id;
        const isHovered = hoveredNode === node.id;

        return (
          <button
            key={node.id}
            ref={(el) => {
              nodeButtonsRef.current[node.id] = el;
            }}
            id={`career-node-${node.id}`}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${node.label}: ${node.tagline}`}
            onClick={() => handleSelectNode(node.id)}
            onMouseEnter={() => {
              setHoveredNode(node.id);
              stateRef.current.lastInteractionTime = Date.now();
            }}
            onMouseLeave={() => setHoveredNode(null)}
            onFocus={() => {
              setHoveredNode(node.id);
              stateRef.current.lastInteractionTime = Date.now();
            }}
            onBlur={() => setHoveredNode(null)}
            className={`absolute z-20 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all duration-200 cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] ${
              isSelected
                ? "bg-[--accent] text-[#080A0D] border-[--accent] shadow-[0_0_24px_rgba(125,225,234,0.35)] scale-110"
                : isHovered
                ? "bg-[#181D22] text-white border-[--accent]/50 shadow-[0_0_15px_rgba(125,225,234,0.15)] scale-105"
                : "bg-[#0D0F12]/85 text-[#C7CCD1] border-white/10 hover:border-white/30"
            }`}
          >
            <span className={isSelected ? "text-[#080A0D]" : "text-[--accent]"}>
              <Icon size={14} aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold tracking-tight font-display">{node.label}</span>
          </button>
        );
      })}

      {/* ── Floating Minimal Feature Panel ── */}
      {activeNodeData && (
        <div
          role="dialog"
          aria-labelledby="feature-panel-title"
          aria-describedby="feature-panel-desc"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[92%] sm:w-[480px] p-5 rounded-2xl border border-white/10 bg-[#0D0F12]/90 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-250"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg border border-[--accent]/30 bg-[#12161A] text-[--accent]">
                <activeNodeData.icon size={16} aria-hidden="true" />
              </span>
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[--accent] uppercase">
                  {activeNodeData.category}
                </span>
                <h3 id="feature-panel-title" className="font-display text-base font-bold text-white leading-tight">
                  {activeNodeData.tagline}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded-md text-[#8B9096] hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--accent]"
              aria-label="Close feature details"
            >
              <X size={16} />
            </button>
          </div>

          <p id="feature-panel-desc" className="text-xs text-[#A5ABB2] font-sans leading-relaxed mb-3">
            {activeNodeData.description}
          </p>

          {/* Sequential Animated Journey for Resume & AI */}
          {(activeNodeData.id === "resume" || activeNodeData.id === "ai") && (
            <div className="mb-4 p-2.5 rounded-xl border border-white/[0.08] bg-[#080A0D]/75">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#8B9096] mb-2 px-0.5">
                <span>{activeNodeData.id === "ai" ? "CONNECTING ALL NODES" : "PIPELINE CASCADE"}</span>
                <span className="text-[--accent] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[--accent] animate-pulse" />
                  PULSING
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                {[
                  { label: "Resume", idx: 0 },
                  { label: "Skills", idx: 1 },
                  { label: "Learning", idx: 2 },
                  { label: "Practice", idx: 3 },
                  { label: "Jobs", idx: 4 },
                ].map((step, i, arr) => (
                  <React.Fragment key={step.label}>
                    <span
                      className={`transition-all duration-300 font-semibold ${
                        journeyStage === step.idx
                          ? "text-[--accent] scale-105"
                          : journeyStage > step.idx
                          ? "text-white"
                          : "text-[#62676D]"
                      }`}
                    >
                      {step.label}
                    </span>
                    {i < arr.length - 1 && (
                      <span className={`text-[10px] ${journeyStage > i ? "text-[--accent]" : "text-white/20"}`}>
                        &rarr;
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/[0.06]">
            <div className="text-[11px] text-[#62676D] font-mono">
              Node route: <span className="text-white/80">/{activeNodeData.id}</span>
            </div>

            <button
              type="button"
              onClick={() => onCtaClick?.(activeNodeData.id)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[--accent] text-[#080A0D] text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            >
              <span>{activeNodeData.ctaText}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ── System Universe Controls ── */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const next = !autoTourActive;
            setAutoTourActive(next);
            stateRef.current.autoTourActive = next;
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--accent] ${
            autoTourActive
              ? "border-[--accent]/30 bg-[#12161A] text-[--accent]"
              : "border-white/10 bg-[#0D0F12] text-[#8B9096] hover:text-white"
          }`}
          aria-label={autoTourActive ? "Pause automated exploration" : "Resume automated exploration"}
        >
          {autoTourActive ? <Pause size={12} /> : <Play size={12} />}
          <span className="hidden sm:inline">{autoTourActive ? "Auto Tour: On" : "Auto Tour: Off"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedNode(null);
            setHoveredNode(null);
            setIsCoreExpanded(false);
          }}
          className="p-1.5 rounded-lg border border-white/10 bg-[#0D0F12] text-[#8B9096] hover:text-white hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--accent]"
          aria-label="Reset graph orientation"
          title="Reset View"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* ── Corner Status Badge ── */}
      <div className="absolute bottom-4 left-4 z-20 hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md border border-white/[0.06] bg-[#0D0F12]/70 text-[10px] font-mono text-[#62676D]">
        <span className="w-1.5 h-1.5 rounded-full bg-[--accent]" />
        <span>LIVING CAREER SYSTEM &bull; 7 NODES ACTIVE</span>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useAnimationFrame,
  AnimatePresence,
} from "framer-motion";
import { useNavigate } from "react-router-dom";

// Pre-calculated 24 watchmaker ticks for 44px (internal 88x88) SVG Bezel
interface TickData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isMajor: boolean;
  isMedium: boolean;
}

const BEZEL_TICKS: TickData[] = Array.from({ length: 24 }, (_, i) => {
  const angle = (i * 15 * Math.PI) / 180;
  const isMajor = i % 6 === 0; // 0, 90, 180, 270 deg
  const isMedium = i % 3 === 0 && !isMajor; // 45, 135, 225, 315 deg
  const outerR = 40;
  const innerR = isMajor ? 34.5 : isMedium ? 36.5 : 38;

  return {
    x1: 44 + outerR * Math.cos(angle),
    y1: 44 + outerR * Math.sin(angle),
    x2: 44 + innerR * Math.cos(angle),
    y2: 44 + innerR * Math.sin(angle),
    isMajor,
    isMedium,
  };
});

// Hexagon Vertices for Layer 4 (R = 25.5 in 88x88 stage)
const HEX_VERTICES = Array.from({ length: 6 }, (_, i) => {
  const angle = ((i * 60 - 30) * Math.PI) / 180;
  return {
    x: 44 + 25.5 * Math.cos(angle),
    y: 44 + 25.5 * Math.sin(angle),
  };
});

const HEX_PATH =
  HEX_VERTICES.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
  " Z";

const CIPHER_GLYPHS = "01ΔΨΩ79XKPULSE#%*".split("");

export default function KalkiPulseLogo({
  className = "",
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Hover & Active States
  const [isHovered, setIsHovered] = useState(false);
  const isHoveredRef = useRef(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [sheenKey, setSheenKey] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);
  const [cipherPulse, setCipherPulse] = useState("PULSE");
  const cipherTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------
  // 1. MAGNETIC CURSOR-TRACKING PHYSICS
  // -------------------------------------------------------------
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 300, damping: 24 };
  const emblemTiltX = useSpring(useTransform(mouseY, [-22, 22], [14, -14]), springConfig);
  const emblemTiltY = useSpring(useTransform(mouseX, [-80, 80], [-14, 14]), springConfig);
  const emblemShiftX = useSpring(useTransform(mouseX, [-80, 80], [-3, 3]), springConfig);
  const emblemShiftY = useSpring(useTransform(mouseY, [-22, 22], [-3, 3]), springConfig);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    mouseX.set(relX);
    mouseY.set(relY);
  };

  const handlePointerLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
    isHoveredRef.current = false;
  };

  // -------------------------------------------------------------
  // 2. LAYER 2: TELEMETRY OVERDRIVE VELOCITY (Zero-Reset Continuous)
  // -------------------------------------------------------------
  const telemetryAngle = useMotionValue(0);
  const currentSpeed = useRef(360 / 14000); // ~0.0257 deg/ms (14s idle rotation)

  useAnimationFrame((_, delta) => {
    // Overdrive speed on hover: 3.5x turbo spin
    const targetSpeed = isHoveredRef.current ? (360 / 14000) * 3.5 : 360 / 14000;
    // Silky lerp acceleration/deceleration
    currentSpeed.current += (targetSpeed - currentSpeed.current) * 0.08;
    telemetryAngle.set((telemetryAngle.get() + currentSpeed.current * delta) % 360);
  });

  // -------------------------------------------------------------
  // 3. LAYER 5: CENTER "K" PRISM 3D FLIP & CELEBRATION
  // -------------------------------------------------------------
  const [coreFlipDegrees, setCoreFlipDegrees] = useState(0);

  // Idle flip every 7 seconds
  useEffect(() => {
    const idleFlipInterval = setInterval(() => {
      setCoreFlipDegrees((prev) => prev + 360);
      setSheenKey((k) => k + 1);
    }, 7000);

    return () => clearInterval(idleFlipInterval);
  }, []);

  // Automatic Sonar Pulse Shockwave heartbeat every 4.5s
  useEffect(() => {
    const shockwaveInterval = setInterval(() => {
      setPulseKey((k) => k + 1);
    }, 4500);

    return () => clearInterval(shockwaveInterval);
  }, []);

  // Trigger Sonar Pulse & Turbo Spin on Hover
  const handleMouseEnter = () => {
    setIsHovered(true);
    isHoveredRef.current = true;
    setPulseKey((k) => k + 1);
    setSheenKey((k) => k + 1);
    setCoreFlipDegrees((prev) => prev + 360);

    // Trigger Cyber-Editorial Micro-Glitch (180ms)
    setIsGlitching(true);
    setTimeout(() => setIsGlitching(false), 180);

    // Trigger Cipher Scramble Settle on "PULSE" (280ms total)
    if (cipherTimerRef.current) clearInterval(cipherTimerRef.current);
    const targetWord = "PULSE";
    let frame = 0;
    const maxFrames = 8; // 8 * 35ms = 280ms
    cipherTimerRef.current = setInterval(() => {
      frame++;
      if (frame >= maxFrames) {
        if (cipherTimerRef.current) clearInterval(cipherTimerRef.current);
        setCipherPulse(targetWord);
      } else {
        const charsFixed = Math.floor((frame / maxFrames) * targetWord.length);
        const scrambled = targetWord
          .split("")
          .map((ch, idx) => {
            if (idx < charsFixed) return ch;
            return CIPHER_GLYPHS[Math.floor(Math.random() * CIPHER_GLYPHS.length)];
          })
          .join("");
        setCipherPulse(scrambled);
      }
    }, 35);
  };

  // Handle Click / Navigation
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setPulseKey((k) => k + 1);
    setSheenKey((k) => k + 1);
    setCoreFlipDegrees((prev) => prev + 720); // Celebratory dual spin!

    if (onClick) {
      onClick();
      return;
    }

    if (window.location.pathname === "/") {
      const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number) => void } }).__lenis;
      if (lenis) {
        lenis.scrollTo(0);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      navigate("/");
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      role="banner"
      aria-label="KALKI Pulse — Home"
      className={`relative inline-flex items-center gap-3.5 h-11 select-none cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 rounded-xl px-1.5 py-1 ${className}`}
      style={{ perspective: "900px" }}
    >
      {/* ========================================================= */}
      {/* 3D GYROSCOPIC PULSE REACTOR EMBLEM (44px x 44px)           */}
      {/* ========================================================= */}
      <motion.div
        className="relative w-11 h-11 shrink-0 flex items-center justify-center pointer-events-none"
        style={{
          rotateX: emblemTiltX,
          rotateY: emblemTiltY,
          x: emblemShiftX,
          y: emblemShiftY,
          transformStyle: "preserve-3d",
        }}
      >
        {/* ------------------------------------------------------- */}
        {/* LAYER 1: AMBIENT SPECULAR BACKGLOW & SONAR SHOCKWAVE     */}
        {/* Depth Plane: translateZ(-10px)                          */}
        {/* ------------------------------------------------------- */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: "translateZ(-10px)", transformStyle: "preserve-3d" }}
        >
          {/* Soft Radial Cycling Aura */}
          <motion.div
            className="absolute w-12 h-12 rounded-full blur-[9px]"
            animate={{
              background: isHovered
                ? "radial-gradient(circle, rgba(0,240,255,0.7) 0%, rgba(255,42,133,0.45) 50%, transparent 70%)"
                : "radial-gradient(circle, rgba(0,240,255,0.3) 0%, rgba(255,42,133,0.18) 55%, transparent 70%)",
              opacity: isHovered ? 0.65 : 0.28,
              scale: isHovered ? [1, 1.15, 1.08] : [1, 1.05, 1],
            }}
            transition={{
              scale: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 0.3 },
            }}
          />

          {/* Expanding Sonar Pulse Shockwave Ring */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={pulseKey}
              className="absolute w-11 h-11 rounded-full border border-cyan-400/70 shadow-[0_0_12px_rgba(0,240,255,0.45)]"
              initial={{ scale: 0.85, opacity: 0.65 }}
              animate={{ scale: 1.85, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </AnimatePresence>
        </div>

        {/* ------------------------------------------------------- */}
        {/* SVG DEF DEFINITIONS (Gradients, Filters, Clips)         */}
        {/* ------------------------------------------------------- */}
        <svg className="absolute w-0 h-0" aria-hidden="true">
          <defs>
            <linearGradient id="kalkiCyanRose" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F0FF" />
              <stop offset="55%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#FF2A85" />
            </linearGradient>

            <linearGradient id="kalkiTitanium" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#CBD5E1" />
              <stop offset="70%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>

            <linearGradient id="kalkiBladeSpine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#E2E8F0" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.6" />
            </linearGradient>

            <linearGradient id="kalkiPulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00F0FF" />
              <stop offset="60%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#00F0FF" />
            </linearGradient>

            <filter id="kalkiEmblemGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* ------------------------------------------------------- */}
        {/* LAYER 2: OUTER PRECISION TELEMETRY RING (Clockwise)     */}
        {/* Smooth GPU velocity overdrive via telemetryAngle        */}
        {/* ------------------------------------------------------- */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ rotate: telemetryAngle, transformStyle: "preserve-3d" }}
        >
          <svg
            viewBox="0 0 88 88"
            className="w-full h-full drop-shadow-[0_0_8px_rgba(0,240,255,0.3)]"
          >
            {/* Outer Bezel Foundation Track */}
            <circle
              cx="44"
              cy="44"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth="0.85"
            />

            {/* 3 Illuminated Arc Segments */}
            {/* Segment 1: 0° -> 80° */}
            <circle
              cx="44"
              cy="44"
              r="40"
              fill="none"
              stroke="url(#kalkiCyanRose)"
              strokeWidth="1.6"
              strokeDasharray="55 196.3"
              strokeDashoffset="0"
              strokeLinecap="round"
            />
            {/* Segment 2: 120° -> 190° */}
            <circle
              cx="44"
              cy="44"
              r="40"
              fill="none"
              stroke="#00F0FF"
              strokeWidth="1.6"
              strokeDasharray="48 203.3"
              strokeDashoffset="-84"
              strokeLinecap="round"
            />
            {/* Segment 3: 240° -> 310° */}
            <circle
              cx="44"
              cy="44"
              r="40"
              fill="none"
              stroke="#FF2A85"
              strokeWidth="1.6"
              strokeDasharray="48 203.3"
              strokeDashoffset="-168"
              strokeLinecap="round"
            />

            {/* 24 Micro-Calibrated Watchmaker Ticks */}
            {BEZEL_TICKS.map((tick, idx) => (
              <line
                key={idx}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke={
                  tick.isMajor
                    ? "#00F0FF"
                    : tick.isMedium
                    ? "rgba(255,255,255,0.75)"
                    : "rgba(255,255,255,0.28)"
                }
                strokeWidth={tick.isMajor ? 1.4 : tick.isMedium ? 1.0 : 0.65}
                strokeLinecap="round"
              />
            ))}

            {/* Glowing Orbital Nodes */}
            <circle cx="44" cy="4" r="1.6" fill="#00F0FF" filter="url(#kalkiEmblemGlow)" />
            <circle cx="78.6" cy="64" r="1.4" fill="#FF2A85" filter="url(#kalkiEmblemGlow)" />
            <circle cx="9.4" cy="64" r="1.4" fill="#8B5CF6" filter="url(#kalkiEmblemGlow)" />
          </svg>
        </motion.div>

        {/* ------------------------------------------------------- */}
        {/* LAYER 3: 3D TILTED GYROSCOPIC ORBITAL RING               */}
        {/* Dual-Axis Gyro Tilt (Idle vs Hover Harmonic Plane)      */}
        {/* Counter-Clockwise 7s Linear Orbit                       */}
        {/* ------------------------------------------------------- */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{
            rotateX: isHovered ? 48 : 62,
            rotateY: isHovered ? 28 : -22,
          }}
          transition={{
            type: "spring",
            stiffness: 140,
            damping: 18,
          }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <motion.div
            className="w-full h-full flex items-center justify-center"
            animate={{ rotateZ: [0, -360] }}
            transition={{ repeat: Infinity, duration: 7, ease: "linear" }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <svg viewBox="0 0 88 88" className="w-full h-full overflow-visible">
              {/* Elliptical Orbital Ring Track */}
              <circle
                cx="44"
                cy="44"
                r="35"
                fill="none"
                stroke="rgba(0,240,255,0.22)"
                strokeWidth="0.8"
                strokeDasharray="2 3"
              />
              {/* Light Chaser / Glowing Comet Tail */}
              <circle
                cx="44"
                cy="44"
                r="35"
                fill="none"
                stroke="url(#kalkiCyanRose)"
                strokeWidth="1.8"
                strokeDasharray="32 188"
                strokeDashoffset="0"
                strokeLinecap="round"
                filter="url(#kalkiEmblemGlow)"
              />
              {/* Comet Head Photon Particle */}
              <circle
                cx="79"
                cy="44"
                r="2"
                fill="#FFFFFF"
                stroke="#00F0FF"
                strokeWidth="1"
                className="drop-shadow-[0_0_6px_#00F0FF]"
              />
            </svg>
          </motion.div>
        </motion.div>

        {/* ------------------------------------------------------- */}
        {/* LAYER 4: INNER HEX-PRISM CONTAINMENT RING (18s CCW)     */}
        {/* Brushed Titanium Micro-Dashed Hexagon + Cyan Vertices   */}
        {/* ------------------------------------------------------- */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{ rotate: [0, -360] }}
          transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
          style={{ transform: "translateZ(2px)", transformStyle: "preserve-3d" }}
        >
          <svg viewBox="0 0 88 88" className="w-full h-full">
            {/* Hexagon Outline */}
            <path
              d={HEX_PATH}
              fill="rgba(0, 240, 255, 0.02)"
              stroke="rgba(255,255,255,0.32)"
              strokeWidth="0.9"
              strokeDasharray="4 2.5"
            />
            {/* 6 Glowing Cyan Vertices */}
            {HEX_VERTICES.map((v, i) => (
              <circle
                key={i}
                cx={v.x}
                cy={v.y}
                r="1.3"
                fill="#00F0FF"
                className="drop-shadow-[0_0_4px_#00F0FF]"
              />
            ))}
          </svg>
        </motion.div>

        {/* ------------------------------------------------------- */}
        {/* LAYER 5: CENTER LEVITATING "K" PRISM CORE (3D Kinetic)  */}
        {/* Faceted Titanium Spine + Cyan-to-Rose Pulse Chevron     */}
        {/* ------------------------------------------------------- */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{
            rotateY: coreFlipDegrees,
            scale: isHovered ? 1.08 : [1, 1.04, 1],
            z: isHovered ? 10 : 5,
          }}
          transition={{
            rotateY: { type: "spring", stiffness: 260, damping: 18 },
            scale: isHovered
              ? { duration: 0.25 }
              : { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            z: { duration: 0.3 },
          }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <svg viewBox="0 0 88 88" className="w-full h-full overflow-visible">
            {/* --- MONOGRAM K: FACETED TITANIUM VERTICAL SPINE --- */}
            {/* Left Beveled Facet */}
            <path
              d="M 33.5 27 L 37.5 25 L 37.5 63 L 33.5 61 Z"
              fill="url(#kalkiTitanium)"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.5"
            />
            {/* Center Chamfer Highlight */}
            <path
              d="M 37.5 25 L 39.5 26.5 L 39.5 61.5 L 37.5 63 Z"
              fill="url(#kalkiBladeSpine)"
            />

            {/* --- MONOGRAM K: UPPER ENERGY CHEVRON BLADE --- */}
            <path
              d="M 39.5 42 L 53.5 27.5 L 58 29.5 L 42 45.5 Z"
              fill="url(#kalkiCyanRose)"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="0.5"
              className="drop-shadow-[0_0_6px_rgba(0,240,255,0.4)]"
            />
            {/* Top Crystal Blade Bevel */}
            <path
              d="M 42 45.5 L 58 29.5 L 55.5 32 L 40.5 46.5 Z"
              fill="#FFFFFF"
              opacity="0.35"
            />

            {/* --- MONOGRAM K: LOWER PULSE SPIKE BLADE (Cardiogram Surge) --- */}
            {/* Pulse Spike Geometry: Starts at spine (39.5, 45) -> Drops to (45, 51.5) -> Surges Up to (48, 43.5) -> Drops to (52, 57.5) -> Extends to (58.5, 62) */}
            <path
              d="M 39.5 46 L 44 51 L 47.5 44 L 51 56 L 57.5 62 L 53.5 62.5 L 49.5 57 L 47 48 L 44.5 53.5 L 39.5 48.5 Z"
              fill="url(#kalkiCyanRose)"
              stroke="rgba(0,240,255,0.6)"
              strokeWidth="0.6"
              className="drop-shadow-[0_0_8px_rgba(255,42,133,0.45)]"
            />

            {/* Central Precision Quantum Node */}
            <circle
              cx="40.5"
              cy="44"
              r="2"
              fill="#FFFFFF"
              className="drop-shadow-[0_0_6px_#00F0FF]"
            />
            <circle cx="40.5" cy="44" r="0.9" fill="#00F0FF" />
          </svg>

          {/* Diagonal Glass Sheen Sweep Overlay on Hover/Flip */}
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            <motion.div
              key={sheenKey}
              className="absolute inset-0 w-[200%] h-full pointer-events-none"
              style={{
                background:
                  "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.65) 50%, rgba(0,240,255,0.8) 55%, transparent 70%)",
              }}
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </motion.div>
      </motion.div>

      {/* ========================================================= */}
      {/* LUXURY BRAND WORDMARK LOCKUP (Right of Reactor)           */}
      {/* ========================================================= */}
      <div className="flex flex-col justify-center select-none text-left leading-none">
        {/* Top Row: KALKI PULSE */}
        <div className="relative flex items-center font-display tracking-[0.16em] uppercase">
          {/* Base Layer: KALKI (Chiseled Titanium Metallic) */}
          <span
            className="font-black text-[17.5px] bg-clip-text text-transparent transition-all duration-300"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 42%, #94A3B8 68%, #E2E8F0 100%)",
              letterSpacing: "0.19em",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))",
            }}
          >
            KALKI
          </span>

          {/* Precision Quantum Micro-Separator (High-End Horology Diamond Node) */}
          <span className="mx-2.5 flex items-center justify-center pointer-events-none" aria-hidden="true">
            <span className="relative flex size-1.5 items-center justify-center">
              <span className="absolute size-full rotate-45 rounded-[0.5px] bg-[#00F0FF] opacity-75 shadow-[0_0_8px_#00F0FF] animate-pulse" />
              <span className="relative size-0.5 rounded-full bg-white" />
            </span>
          </span>

          {/* PULSE with High-End Futuristic Holographic Luminescence */}
          <span
            className="font-extrabold text-[17.5px] bg-clip-text text-transparent transition-all duration-300"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #00F0FF 0%, #38BDF8 45%, #00F0FF 80%, #A5F3FC 100%)",
              letterSpacing: "0.22em",
              filter: "drop-shadow(0 0 14px rgba(0,240,255,0.5))",
            }}
          >
            {cipherPulse}
          </span>

          {/* Cyber-Editorial RGB Chromatic Aberration Micro-Glitch (180ms) */}
          {isGlitching && (
            <>
              {/* Cyan Split Offset (-1.5px) */}
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center font-display text-[17.5px] uppercase text-[#00F0FF] opacity-75 pointer-events-none"
                style={{
                  transform: "translateX(-1.5px)",
                  clipPath: "inset(20% 0 40% 0)",
                  letterSpacing: "0.19em",
                }}
              >
                <span className="font-black">KALKI</span>
                <span className="mx-2.5 opacity-50">✦</span>
                <span className="font-extrabold" style={{ letterSpacing: "0.22em" }}>{cipherPulse}</span>
              </span>

              {/* Laser Rose Split Offset (+1.5px) */}
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center font-display text-[17.5px] uppercase text-[#FF2A85] opacity-75 pointer-events-none"
                style={{
                  transform: "translateX(1.5px)",
                  clipPath: "inset(45% 0 15% 0)",
                  letterSpacing: "0.19em",
                }}
              >
                <span className="font-black">KALKI</span>
                <span className="mx-2.5 opacity-50">✦</span>
                <span className="font-extrabold" style={{ letterSpacing: "0.22em" }}>{cipherPulse}</span>
              </span>
            </>
          )}
        </div>

        {/* Bottom Micro-Row: BY KALKI SAAS + Precision Oscilloscope Trace */}
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-[8.5px] font-medium tracking-[0.26em] text-slate-400/90 uppercase">
            BY KALKI SAAS
          </span>

          {/* Ultra-Fine Precision Divider */}
          <span className="h-2 w-px bg-slate-700/60" aria-hidden="true" />

          {/* Live Precision Animated SVG Heartbeat / Pulse Waveform (32px × 10px) */}
          <div
            className="relative w-8 h-2.5 flex items-center"
            title="Live Telemetry Engine Active"
          >
            <svg viewBox="0 0 32 10" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="liveWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.2" />
                  <stop offset="40%" stopColor="#00F0FF" />
                  <stop offset="70%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Background Reference Track */}
              <path
                d="M 0 5 L 8 5 L 10 6.5 L 14 1 L 16 8.5 L 19 5 L 32 5"
                fill="none"
                stroke="rgba(0, 240, 255, 0.22)"
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Active Laser Pulse Trace */}
              <motion.path
                d="M 0 5 L 8 5 L 10 6.5 L 14 1 L 16 8.5 L 19 5 L 32 5"
                fill="none"
                stroke="url(#liveWaveGrad)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="10 30"
                animate={{ strokeDashoffset: [40, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "linear",
                }}
                className="drop-shadow-[0_0_5px_#00F0FF]"
              />

              {/* Real-time Photon Node */}
              <motion.circle
                cx={0}
                cy={5}
                r="1.2"
                fill="#00F0FF"
                className="drop-shadow-[0_0_6px_#00F0FF]"
                initial={{ cx: 0, cy: 5, opacity: 0.3 }}
                animate={{
                  cx: [0, 8, 10, 14, 16, 19, 32],
                  cy: [5, 5, 6.5, 1, 8.5, 5, 5],
                  opacity: [0.3, 0.9, 1, 1, 1, 0.9, 0.3],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "easeInOut",
                  times: [0, 0.25, 0.32, 0.44, 0.52, 0.62, 1],
                }}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

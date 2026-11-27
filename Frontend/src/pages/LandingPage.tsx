import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import KalkiPulseForgeSplash from "../components/ui/KalkiPulseForgeSplash";
import ScrollReveal from "../components/ui/ScrollReveal";
import Navbar from "../components/sections/Navbar";
import HeroSection from "../components/sections/HeroSection";
import TelemetryMarquee from "../components/sections/TelemetryMarquee";
import PurposeXRaySection from "../components/sections/PurposeXRaySection";
import GoalsPipelineSection from "../components/sections/GoalsPipelineSection";
import BenefitsBentoSection from "../components/sections/BenefitsBentoSection";
import PricingSection from "../components/ui/pricing-section";
import FinaleCtaFooter from "../components/sections/FinaleCtaFooter";

export default function LandingPage() {
  const [splashPhase, setSplashPhase] = useState<"forge" | "reveal" | "ready">("forge");
  const [spike, setSpike] = useState(0);
  const lenisRef = useRef<Lenis | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const l = new Lenis({
      lerp: reduced ? 1 : 0.075,
      smoothWheel: !reduced,
      wheelMultiplier: 0.95,
    });
    lenisRef.current = l;
    (window as unknown as { __lenis?: Lenis }).__lenis = l;
    l.stop();

    l.on("scroll", ({ progress }: { progress: number }) => {
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scale3d(${Math.min(1, Math.max(0, progress))}, 1, 1)`;
      }
    });

    let r = 0;
    const f = (t: number) => {
      l.raf(t);
      r = requestAnimationFrame(f);
    };
    r = requestAnimationFrame(f);
    return () => {
      cancelAnimationFrame(r);
      l.destroy();
      lenisRef.current = null;
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  const revealed = splashPhase !== "forge";

  useEffect(() => {
    const l = lenisRef.current;
    if (!l) return;
    if (revealed) {
      l.start();
      l.resize();
    } else {
      l.stop();
    }
  }, [revealed]);

  const fire = () => {
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    setSpike(1);
    setTimeout(() => setSpike(0), 250);
  };

  return (
    <div
      className={`relative min-h-screen bg-[#030306] text-white ${
        splashPhase === "forge" ? "h-screen overflow-hidden" : ""
      }`}
    >
      {splashPhase !== "ready" && (
        <KalkiPulseForgeSplash
          onHandoffStart={() => setSplashPhase("reveal")}
          onComplete={() => setSplashPhase("ready")}
        />
      )}

      {/* GPU-composited top scroll progress indicator */}
      <div
        aria-hidden
        className="fixed top-0 inset-x-0 h-[2px] z-[60] pointer-events-none transition-opacity duration-700"
        style={{ opacity: revealed ? 1 : 0 }}
      >
        <div
          ref={progressBarRef}
          className="h-full w-full origin-left bg-gradient-to-r from-[#00F0FF] via-[#38BDF8] to-[#10B981]"
          style={{
            transform: "scale3d(0, 1, 1)",
            willChange: "transform",
          }}
        />
      </div>

      {/* GPU-composited Navbar fade & settle; clears transform once ready so fixed header stays pinned on scroll */}
      <div
        style={{
          opacity: revealed ? 1 : 0,
          transform:
            splashPhase === "ready"
              ? "none"
              : revealed
              ? "translate3d(0, 0, 0)"
              : "translate3d(0, -10px, 0)",
          transition:
            "opacity 1150ms cubic-bezier(0.22, 1, 0.36, 1) 420ms, transform 1200ms cubic-bezier(0.16, 1, 0.3, 1) 420ms",
          willChange: splashPhase === "ready" ? "auto" : "opacity, transform",
        }}
      >
        <Navbar />
      </div>

      {/* Hero stays unscaled so WebGL canvas & glass backdrops never re-rasterize */}
      <HeroSection spike={spike} revealed={revealed} coreActive={revealed} />

      <ScrollReveal y={20} duration={850}>
        <TelemetryMarquee />
      </ScrollReveal>

      <PurposeXRaySection onToggle={fire} />
      <GoalsPipelineSection />
      <BenefitsBentoSection />
      <PricingSection />
      <FinaleCtaFooter />
    </div>
  );
}

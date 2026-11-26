import { useEffect, useState } from "react";
import Lenis from "lenis";
import KalkiPulseForgeSplash from "../components/ui/KalkiPulseForgeSplash";
import Navbar from "../components/sections/Navbar";
import HeroSection from "../components/sections/HeroSection";
import TelemetryMarquee from "../components/sections/TelemetryMarquee";
import PurposeXRaySection from "../components/sections/PurposeXRaySection";
import GoalsPipelineSection from "../components/sections/GoalsPipelineSection";
import BenefitsBentoSection from "../components/sections/BenefitsBentoSection";
import FinaleCtaFooter from "../components/sections/FinaleCtaFooter";

export default function LandingPage() {
  const [ready, setReady] = useState(false);
  const [spike, setSpike] = useState(0);

  useEffect(() => {
    const l = new Lenis();
    (window as unknown as { __lenis?: Lenis }).__lenis = l;
    let r = 0;
    const f = (t: number) => {
      l.raf(t);
      r = requestAnimationFrame(f);
    };
    r = requestAnimationFrame(f);
    return () => {
      cancelAnimationFrame(r);
      l.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  const fire = () => {
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    setSpike(1);
    setTimeout(() => setSpike(0), 250);
  };

  return (
    <div className="relative min-h-screen bg-[#030306] text-white">
      {!ready && <KalkiPulseForgeSplash onComplete={() => setReady(true)} />}
      <Navbar />
      <HeroSection spike={spike} />
      <TelemetryMarquee />
      <PurposeXRaySection onToggle={fire} />
      <GoalsPipelineSection />
      <BenefitsBentoSection />
      <FinaleCtaFooter />
    </div>
  );
}

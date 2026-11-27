import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import NeuralRoiCore from "../canvas/NeuralRoiCore";
import GlitchText from "../ui/GlitchText";
import MagneticButton from "../ui/MagneticButton";
import CipherNumber from "../ui/CipherNumber";

const EV = [
  "@glowbyria | YouTube Shorts | +1.2K views | High Buyer Intent",
  "@skincarestudio | YouTube | +640 likes | Verified Reach",
  "@beautybyananya | YouTube Shorts | +310 comments | Strong Conversion",
];

export default function HeroSection({
  spike,
  revealed = true,
  coreActive = true,
}: {
  spike: number;
  revealed?: boolean;
  coreActive?: boolean;
}) {
  const nav = useNavigate();
  const [k, setK] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setK((x) => x + 1), 1400);
    return () => clearInterval(i);
  }, []);

  return (
    <section id="hero-section" className="hero-section relative h-screen overflow-hidden">
      <NeuralRoiCore spike={spike} active={coreActive} />

      <div
        className="relative z-10 h-full flex flex-col justify-center px-6 md:px-16 max-w-5xl pointer-events-none [&_*]:pointer-events-auto"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translate3d(0, 0, 0)" : "translate3d(0, 16px, 0)",
          transition:
            "opacity 1300ms cubic-bezier(0.22, 1, 0.36, 1) 250ms, transform 1400ms cubic-bezier(0.16, 1, 0.3, 1) 250ms",
          willChange: "opacity, transform",
        }}
      >
        <span className="num text-xs text-cyan-300 mb-6 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
          CREATOR ROI INTELLIGENCE PLATFORM
        </span>

        <h1 className="font-maison text-[clamp(2.9rem,7.2vw,6.15rem)] leading-[0.96] select-none">
          <span className="block text-white font-semibold drop-shadow-[0_2px_18px_rgba(255,255,255,0.14)]">
            DECODE INFLUENCE
          </span>
          <span className="block mt-2 sm:mt-3 font-semibold italic bg-clip-text text-transparent bg-gradient-to-r from-[#00F0FF] via-[#38BDF8] to-[#10B981] drop-shadow-[0_0_35px_rgba(0,240,255,0.35)]">
            <GlitchText>PREDICT EXACT ROI</GlitchText>
          </span>
        </h1>

        <p className="muted max-w-xl mt-6 text-base md:text-lg leading-relaxed text-slate-300/80">
          Know every creator&apos;s true commercial impact and forecast campaign revenue before you spend a rupee.
        </p>

        <div className="flex gap-4 mt-8">
          <MagneticButton onClick={() => nav("/auth")}>
            Start Subscription
          </MagneticButton>
          <MagneticButton
            primary={false}
            onClick={() => {
              const el = document.getElementById("goals");
              if (!el) return;
              const lenis = (window as unknown as { __lenis?: { scrollTo: (t: HTMLElement, o?: { offset?: number; duration?: number }) => void } }).__lenis;
              if (lenis) {
                lenis.scrollTo(el, { offset: -16, duration: 1.35 });
              } else {
                el.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            Try ROI Simulator
          </MagneticButton>
        </div>
      </div>

      <div className="hidden lg:block absolute right-10 top-32 w-80 glass p-4 num text-[11px] text-cyan-200 z-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="truncate">
            {EV[(k + i) % 3]}
          </div>
        ))}
      </div>

      <div className="hidden lg:block absolute right-24 bottom-24 w-72 glass sheen overflow-hidden p-4 z-10">
        <div className="muted text-xs">Predicted Net ROI</div>
        <div className="text-3xl text-emerald-400">
          <CipherNumber value="+210.8%" />
        </div>
        <div className="num text-xs muted mt-2">
          Est. Reach: 310,000 · Verified Forecast
        </div>
        <svg viewBox="0 0 100 24" className="mt-2">
          <polyline
            fill="none"
            stroke="#10B981"
            strokeWidth="1.5"
            points="0,20 15,16 30,18 45,9 60,12 75,5 100,2"
          />
        </svg>
      </div>
    </section>
  );
}

import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import NeuralRoiCore from "../canvas/NeuralRoiCore";
import GlitchText from "../ui/GlitchText";
import MagneticButton from "../ui/MagneticButton";
import CipherNumber from "../ui/CipherNumber";

const EV = [
  "@alexfit_089 | IG | +620 likes | sentiment: 0.85 | 14,240 evt/s",
  "@glowbyria | YT | +1.2K views | sentiment: 0.91 | 13,870 evt/s",
  "@makeupmira | IG | +310 shares | sentiment: 0.78 | 15,102 evt/s",
];

export default function HeroSection({ spike }: { spike: number }) {
  const nav = useNavigate();
  const [k, setK] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setK((x) => x + 1), 1400);
    return () => clearInterval(i);
  }, []);

  return (
    <section className="relative h-screen overflow-hidden">
      <NeuralRoiCore spike={spike} />

      <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-16 max-w-5xl pointer-events-none [&_*]:pointer-events-auto">
        <span className="num text-xs text-cyan-300 mb-6 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
          XGBOOST + ONNX RUNTIME • &lt;50MS REAL-TIME INFERENCE
        </span>

        <h1 className="font-extrabold tracking-tight text-[clamp(2.75rem,6.8vw,5.75rem)] leading-[0.98] select-none">
          <span className="block text-white drop-shadow-[0_2px_18px_rgba(255,255,255,0.12)]">
            DECODE INFLUENCE
          </span>
          <span className="block mt-2 sm:mt-3 bg-clip-text text-transparent bg-gradient-to-r from-[#00F0FF] via-[#38BDF8] to-[#10B981] drop-shadow-[0_0_35px_rgba(0,240,255,0.35)]">
            <GlitchText>PREDICT EXACT ROI</GlitchText>
          </span>
        </h1>

        <p className="muted max-w-xl mt-6 text-base md:text-lg leading-relaxed text-slate-300/80">
          The high-frequency AI decision engine that fuses real-time social engagement velocity, NLP buyer-intent sentiment, and historical Nykaa, Tira & Purplle conversion baselines to forecast exact revenue before you spend a rupee.
        </p>

        <div className="flex gap-4 mt-8">
          <MagneticButton onClick={() => nav("/auth")}>
            Launch ROI Dashboard
          </MagneticButton>
          <MagneticButton primary={false} onClick={() => nav("/data-pipeline")}>
            Inspect Data Pipeline
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
          Est. Reach: 310,000 · ONNX Latency: 4.1ms
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

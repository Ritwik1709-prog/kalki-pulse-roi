import { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

// -------------------------------------------------------------
// CENTRAL LEVITATING LIQUID-CRYSTAL TORUS CORE
// Pure, distraction-free architectural 3D centerpiece
// -------------------------------------------------------------
function Core() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ pointer, camera }, dt) => {
    if (!g.current) return;
    g.current.rotation.x += dt * 0.18;
    g.current.rotation.y += dt * 0.26;
    const k = matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 1;
    camera.position.x += (pointer.x * 0.9 * k - camera.position.x) * 0.04;
    camera.position.y += (pointer.y * 0.6 * k - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={g}>
      <mesh>
        <torusKnotGeometry args={[1.14, 0.36, 256, 48]} />
        <meshPhysicalMaterial
          transmission={0.92}
          ior={1.55}
          thickness={1.8}
          roughness={0.08}
          iridescence={1}
          clearcoat={1}
          color="#0a0e18"
        />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------
// MAIN NEURAL ROI CANVAS STAGE
// -------------------------------------------------------------
export default function NeuralRoiCore({ spike = 0 }: { spike?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(true);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVis(e.isIntersecting));
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);

  const off = useMemo(
    () => new THREE.Vector2(0.0006 + spike * 0.004, 0.0006 + spike * 0.004),
    [spike]
  );

  return (
    <div ref={box} className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        frameloop={vis ? "always" : "never"}
        camera={{ position: [0, 0, 6], fov: 45 }}
      >
        <Environment preset="night" />
        <pointLight position={[4, 2, 3]} color="#00F0FF" intensity={80} />
        <pointLight position={[-4, -2, 3]} color="#FF2A85" intensity={80} />

        {/* Central Levitating Glass Knot */}
        <Float speed={1.2}>
          <Core />
        </Float>

        <EffectComposer>
          <Bloom luminanceThreshold={0.85} intensity={0.45} />
          <ChromaticAberration
            offset={off}
            radialModulation={false}
            modulationOffset={0}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

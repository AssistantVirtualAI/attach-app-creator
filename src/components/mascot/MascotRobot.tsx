import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * Cute chibi 3D robot — oversized round head, tiny body, big glowing eyes,
 * bouncy idle, blink, wave, and mouth animation when talking.
 */
function Robot({ talking, listening }: { talking: boolean; listening: boolean }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const antennaTip = useRef<THREE.Mesh>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const leftCheek = useRef<THREE.Mesh>(null);
  const rightCheek = useRef<THREE.Mesh>(null);
  const seed = useRef(Math.random() * 10);

  useFrame((s) => {
    const t = s.clock.elapsedTime + seed.current;
    if (root.current) {
      // Bouncy idle
      root.current.position.y = -0.15 + Math.abs(Math.sin(t * 2.2)) * 0.08;
      root.current.rotation.y = listening
        ? Math.sin(t * 1.4) * 0.22
        : Math.sin(t * 0.6) * 0.1;
    }
    if (head.current) {
      head.current.rotation.x = Math.sin(t * 1.2) * 0.06;
      head.current.rotation.z = Math.sin(t * 0.8) * 0.04;
    }
    // Wave with right arm continuously, gentle left
    if (rightArm.current) {
      rightArm.current.rotation.z = -1.0 + Math.sin(t * 3.5) * 0.5;
      rightArm.current.rotation.x = Math.sin(t * 3.5) * 0.2;
    }
    if (leftArm.current) {
      leftArm.current.rotation.z = 0.35 + Math.sin(t * 1.6 + 1) * 0.12;
    }
    if (antennaTip.current) {
      const s2 = 1 + Math.sin(t * 4) * 0.15;
      antennaTip.current.scale.set(s2, s2, s2);
    }
    // Blink
    const blink = Math.sin(t * 0.8) > 0.97 ? 0.08 : 1;
    if (leftEye.current) leftEye.current.scale.y = blink;
    if (rightEye.current) rightEye.current.scale.y = blink;
    // Cheek pulse
    const cp = 1 + Math.sin(t * 2.5) * 0.06;
    if (leftCheek.current) leftCheek.current.scale.setScalar(cp);
    if (rightCheek.current) rightCheek.current.scale.setScalar(cp);
    // Mouth
    if (mouth.current) {
      const open = talking ? 0.55 + Math.abs(Math.sin(t * 16)) * 0.55 : 0.25;
      mouth.current.scale.y = open;
    }
  });

  const shell = new THREE.MeshStandardMaterial({
    color: "#f4f7fb",
    metalness: 0.25,
    roughness: 0.45,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: "#0023e6",
    metalness: 0.5,
    roughness: 0.25,
    emissive: "#0023e6",
    emissiveIntensity: 0.35,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#1a1d24",
    metalness: 0.3,
    roughness: 0.5,
  });
  const eyeGlow = new THREE.MeshBasicMaterial({ color: "#7dffce" });
  const cheek = new THREE.MeshBasicMaterial({
    color: "#ff7aa2",
    transparent: true,
    opacity: 0.85,
  });
  const mouthMat = new THREE.MeshBasicMaterial({ color: "#15181f" });

  return (
    <group ref={root} position={[0, -0.15, 0]}>
      {/* Tiny body (small relative to head — chibi proportions) */}
      <mesh position={[0, -0.55, 0]} material={shell}>
        <capsuleGeometry args={[0.42, 0.35, 8, 16]} />
      </mesh>
      {/* Chest badge */}
      <mesh position={[0, -0.55, 0.38]} material={accent}>
        <circleGeometry args={[0.13, 28]} />
      </mesh>
      <mesh position={[0, -0.55, 0.4]}>
        <circleGeometry args={[0.07, 24]} />
        <meshBasicMaterial color="#7dffce" />
      </mesh>

      {/* Little legs */}
      <mesh position={[-0.18, -1.02, 0]} material={dark}>
        <capsuleGeometry args={[0.1, 0.18, 6, 12]} />
      </mesh>
      <mesh position={[0.18, -1.02, 0]} material={dark}>
        <capsuleGeometry args={[0.1, 0.18, 6, 12]} />
      </mesh>
      <mesh position={[-0.18, -1.22, 0.05]} material={accent}>
        <sphereGeometry args={[0.13, 16, 16]} />
      </mesh>
      <mesh position={[0.18, -1.22, 0.05]} material={accent}>
        <sphereGeometry args={[0.13, 16, 16]} />
      </mesh>

      {/* Arms (rotate around shoulder) */}
      <group ref={leftArm} position={[-0.46, -0.4, 0]}>
        <mesh position={[-0.05, -0.22, 0]} material={shell}>
          <capsuleGeometry args={[0.085, 0.32, 6, 12]} />
        </mesh>
        <mesh position={[-0.1, -0.45, 0]} material={accent}>
          <sphereGeometry args={[0.12, 16, 16]} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.46, -0.4, 0]}>
        <mesh position={[0.05, -0.22, 0]} material={shell}>
          <capsuleGeometry args={[0.085, 0.32, 6, 12]} />
        </mesh>
        {/* Waving hand */}
        <mesh position={[0.1, -0.45, 0]} material={accent}>
          <sphereGeometry args={[0.13, 16, 16]} />
        </mesh>
      </group>

      {/* Oversized round head */}
      <group ref={head} position={[0, 0.38, 0]}>
        <mesh material={shell}>
          <sphereGeometry args={[0.7, 32, 32]} />
        </mesh>
        {/* Visor band */}
        <mesh position={[0, 0.04, 0.5]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.42, 0.05, 12, 32, Math.PI]} />
          <meshStandardMaterial color="#0b1020" metalness={0.7} roughness={0.2} />
        </mesh>
        {/* Big eyes */}
        <mesh ref={leftEye} position={[-0.22, 0.04, 0.6]} material={eyeGlow}>
          <sphereGeometry args={[0.11, 20, 20]} />
        </mesh>
        <mesh ref={rightEye} position={[0.22, 0.04, 0.6]} material={eyeGlow}>
          <sphereGeometry args={[0.11, 20, 20]} />
        </mesh>
        {/* Pupil sparkle */}
        <mesh position={[-0.19, 0.08, 0.69]}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.25, 0.08, 0.69]}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Cheeks */}
        <mesh ref={leftCheek} position={[-0.4, -0.14, 0.52]} material={cheek}>
          <sphereGeometry args={[0.085, 16, 16]} />
        </mesh>
        <mesh ref={rightCheek} position={[0.4, -0.14, 0.52]} material={cheek}>
          <sphereGeometry args={[0.085, 16, 16]} />
        </mesh>
        {/* Smiley mouth */}
        <mesh ref={mouth} position={[0, -0.22, 0.6]} material={mouthMat}>
          <capsuleGeometry args={[0.045, 0.16, 6, 12]} />
        </mesh>
        {/* Side bolts/ears */}
        <mesh position={[-0.7, -0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={accent}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
        </mesh>
        <mesh position={[0.7, -0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={accent}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
        </mesh>
        {/* Antenna */}
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
          <meshStandardMaterial color="#1a1d24" />
        </mesh>
        <mesh ref={antennaTip} position={[0, 0.92, 0]}>
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial
            color="#7dffce"
            emissive="#7dffce"
            emissiveIntensity={2}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function MascotRobot({
  talking,
  listening,
  className = "",
  compact = false,
}: {
  talking?: boolean;
  listening?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={"relative w-full h-full " + className}>
      <Canvas
        camera={{ position: [0, 0.05, compact ? 3.5 : 3.2], fov: 32 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#7dffce" />
        <pointLight position={[0, -2, 3]} intensity={0.4} color="#ff7aa2" />
        <Robot talking={!!talking} listening={!!listening} />
      </Canvas>
    </div>
  );
}

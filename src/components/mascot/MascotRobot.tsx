import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * Cute 3D robot mascot, full-body. Idle bob + breathing, blinking eyes,
 * arms wave gently. Mouth opens while `talking` (streaming).
 */
function Robot({ talking, listening }: { talking: boolean; listening: boolean }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const antenna = useRef<THREE.Mesh>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const seed = useRef(Math.random() * 10);

  useFrame((s) => {
    const t = s.clock.elapsedTime + seed.current;
    if (root.current) {
      root.current.position.y = -0.05 + Math.sin(t * 1.6) * 0.04;
      root.current.rotation.y = listening ? Math.sin(t * 1.2) * 0.18 : Math.sin(t * 0.5) * 0.08;
    }
    if (head.current) head.current.rotation.x = Math.sin(t * 0.9) * 0.04;
    if (leftArm.current) leftArm.current.rotation.z = 0.35 + Math.sin(t * 1.8) * 0.12;
    if (rightArm.current) rightArm.current.rotation.z = -0.35 - Math.sin(t * 1.8 + 0.4) * 0.12;
    if (antenna.current) antenna.current.rotation.z = Math.sin(t * 2.4) * 0.18;
    // Blink
    const blink = Math.sin(t * 0.7) > 0.985 ? 0.05 : 1;
    if (leftEye.current) leftEye.current.scale.y = blink;
    if (rightEye.current) rightEye.current.scale.y = blink;
    // Mouth open during talking
    if (mouth.current) {
      const open = talking ? 0.55 + Math.abs(Math.sin(t * 14)) * 0.45 : 0.18;
      mouth.current.scale.y = open;
    }
  });

  const metal = new THREE.MeshStandardMaterial({ color: "#dfe6ef", metalness: 0.55, roughness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: "#0023e6", metalness: 0.4, roughness: 0.3, emissive: "#0023e6", emissiveIntensity: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: "#1a1d24", metalness: 0.3, roughness: 0.5 });
  const eyeGlow = new THREE.MeshBasicMaterial({ color: "#7dffce" });
  const mouthMat = new THREE.MeshBasicMaterial({ color: "#0e1116" });

  return (
    <group ref={root} position={[0, -0.1, 0]}>
      {/* Legs */}
      <mesh position={[-0.28, -1.05, 0]} material={dark}>
        <boxGeometry args={[0.32, 0.4, 0.32]} />
      </mesh>
      <mesh position={[0.28, -1.05, 0]} material={dark}>
        <boxGeometry args={[0.32, 0.4, 0.32]} />
      </mesh>
      <mesh position={[-0.28, -1.32, 0.06]} material={metal}>
        <boxGeometry args={[0.42, 0.16, 0.5]} />
      </mesh>
      <mesh position={[0.28, -1.32, 0.06]} material={metal}>
        <boxGeometry args={[0.42, 0.16, 0.5]} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, -0.35, 0]} material={metal}>
        <boxGeometry args={[1.05, 1.0, 0.7]} />
      </mesh>
      {/* Chest panel */}
      <mesh position={[0, -0.25, 0.36]} material={accent}>
        <boxGeometry args={[0.55, 0.38, 0.04]} />
      </mesh>
      <mesh position={[0, -0.25, 0.39]}>
        <circleGeometry args={[0.09, 24]} />
        <meshBasicMaterial color="#7dffce" />
      </mesh>

      {/* Arms */}
      <group ref={leftArm} position={[-0.62, -0.05, 0]}>
        <mesh position={[-0.12, -0.35, 0]} material={metal}>
          <capsuleGeometry args={[0.13, 0.55, 6, 12]} />
        </mesh>
        <mesh position={[-0.22, -0.78, 0]} material={accent}>
          <sphereGeometry args={[0.16, 16, 16]} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.62, -0.05, 0]}>
        <mesh position={[0.12, -0.35, 0]} material={metal}>
          <capsuleGeometry args={[0.13, 0.55, 6, 12]} />
        </mesh>
        <mesh position={[0.22, -0.78, 0]} material={accent}>
          <sphereGeometry args={[0.16, 16, 16]} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 0.22, 0]} material={dark}>
        <cylinderGeometry args={[0.13, 0.15, 0.18, 16]} />
      </mesh>

      {/* Head */}
      <group ref={head} position={[0, 0.62, 0]}>
        <mesh material={metal}>
          <boxGeometry args={[0.95, 0.78, 0.78]} />
        </mesh>
        {/* Visor */}
        <mesh position={[0, 0.05, 0.4]}>
          <boxGeometry args={[0.78, 0.32, 0.04]} />
          <meshStandardMaterial color="#0b1020" metalness={0.6} roughness={0.2} />
        </mesh>
        {/* Eyes */}
        <mesh ref={leftEye} position={[-0.18, 0.05, 0.43]} material={eyeGlow}>
          <sphereGeometry args={[0.06, 16, 16]} />
        </mesh>
        <mesh ref={rightEye} position={[0.18, 0.05, 0.43]} material={eyeGlow}>
          <sphereGeometry args={[0.06, 16, 16]} />
        </mesh>
        {/* Cheek blush */}
        <mesh position={[-0.36, -0.1, 0.39]}>
          <circleGeometry args={[0.07, 18]} />
          <meshBasicMaterial color="#ff7aa2" transparent opacity={0.65} />
        </mesh>
        <mesh position={[0.36, -0.1, 0.39]}>
          <circleGeometry args={[0.07, 18]} />
          <meshBasicMaterial color="#ff7aa2" transparent opacity={0.65} />
        </mesh>
        {/* Mouth */}
        <mesh ref={mouth} position={[0, -0.18, 0.4]} material={mouthMat}>
          <boxGeometry args={[0.24, 0.06, 0.02]} />
        </mesh>
        {/* Ears */}
        <mesh position={[-0.51, 0, 0]} material={accent}>
          <boxGeometry args={[0.08, 0.22, 0.22]} />
        </mesh>
        <mesh position={[0.51, 0, 0]} material={accent}>
          <boxGeometry args={[0.08, 0.22, 0.22]} />
        </mesh>
        {/* Antenna */}
        <mesh ref={antenna} position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.34, 8]} />
          <meshStandardMaterial color="#1a1d24" />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#7dffce" emissive="#7dffce" emissiveIntensity={1.5} />
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
}: { talking?: boolean; listening?: boolean; className?: string; compact?: boolean }) {
  return (
    <div className={"relative w-full h-full " + className}>
      <Canvas
        camera={{ position: [0, 0.2, compact ? 4.6 : 4.2], fov: 32 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#7dffce" />
        <Robot talking={!!talking} listening={!!listening} />
      </Canvas>
    </div>
  );
}

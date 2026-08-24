"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

const NODE_COUNT = 22;

/** Points roughly evenly spread on a sphere (golden-angle spiral). */
function fibonacciSphere(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    points.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(radius));
  }
  return points;
}

function Orb({ interactive }: { interactive: boolean }) {
  const group = useRef<THREE.Group>(null);
  const nodes = useMemo(() => fibonacciSphere(NODE_COUNT, 1.6), []);

  const edgePositions = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      let closest: number[] = [];
      const distances = nodes
        .map((p, j) => ({ j, d: i === j ? Infinity : p.distanceTo(nodes[i]) }))
        .sort((a, b) => a.d - b.d);
      closest = distances.slice(0, 2).map((d) => d.j);
      for (const j of closest) {
        positions.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
      }
    }
    return new Float32Array(positions);
  }, [nodes]);

  useFrame((state, delta) => {
    if (!group.current) return;
    if (interactive) {
      group.current.rotation.y += delta * 0.08;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        state.pointer.y * 0.15,
        0.05,
      );
      group.current.rotation.z = THREE.MathUtils.lerp(
        group.current.rotation.z,
        -state.pointer.x * 0.1,
        0.05,
      );
    }
  });

  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edgePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#f2b341" transparent opacity={0.25} />
      </lineSegments>
      {nodes.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial
            color="#f2b341"
            emissive="#f2b341"
            emissiveIntensity={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Ambient, decorative — a floating knowledge-graph orb for the landing hero. */
export function KnowledgeOrb() {
  const reducedMotion = useReducedMotion();

  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.5]}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 2, 4]} intensity={40} color="#f2b341" />
      <Orb interactive={!reducedMotion} />
    </Canvas>
  );
}

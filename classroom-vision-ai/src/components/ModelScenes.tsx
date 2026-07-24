import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { VisualEntry } from '../types';

type ModelProps = {
  visual: VisualEntry;
  exploded: boolean;
  paused: boolean;
};

function createLabelTexture(text: string) {
  const canvas = document.createElement('canvas');
  const width = 512;
  const height = 128;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);

  context.clearRect(0, 0, width, height);
  context.fillStyle = 'rgba(3, 10, 24, 0.72)';
  context.strokeStyle = 'rgba(100, 220, 255, 0.72)';
  context.lineWidth = 4;
  context.roundRect(8, 8, width - 16, height - 16, 28);
  context.fill();
  context.stroke();
  context.font = '600 40px Inter, Arial, sans-serif';
  context.fillStyle = 'rgba(230, 250, 255, 0.98)';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function LabelSprite({ text, position, scale = 1 }: { text: string; position: [number, number, number]; scale?: number }) {
  const texture = useMemo(() => createLabelTexture(text), [text]);
  return (
    <sprite position={position} scale={[1.9 * scale, 0.48 * scale, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

function CylinderBetween({
  start,
  end,
  radius = 0.025,
  color = '#6ee7ff',
  opacity = 0.75,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius?: number;
  color?: string;
  opacity?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const lengthValue = direction.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return { position: mid, quaternion: rotation, length: lengthValue };
  }, [end, start]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 16]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.35} metalness={0.15} />
    </mesh>
  );
}

function GlowSphere({
  position,
  radius,
  color,
  emissive,
  opacity = 1,
}: {
  position: [number, number, number];
  radius: number;
  color: string;
  emissive?: string;
  opacity?: number;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 48, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={0.32}
        roughness={0.28}
        metalness={0.08}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function HeartModel({ exploded, paused }: ModelProps) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current || paused) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 4.2) * 0.035;
    group.current.scale.setScalar(pulse);
  });

  const offset = exploded ? 0.48 : 0;

  return (
    <group ref={group}>
      <GlowSphere position={[-0.33 - offset, 0.35, 0]} radius={0.47} color="#ff375f" emissive="#b91435" />
      <GlowSphere position={[0.33 + offset, 0.35, 0]} radius={0.47} color="#ff426d" emissive="#b91435" />
      <mesh position={[0, -0.18 - offset * 0.35, 0]} rotation={[0, 0, Math.PI]} scale={[0.96, 1.15, 0.76]}>
        <coneGeometry args={[0.7, 1.25, 64]} />
        <meshStandardMaterial color="#d80f3d" emissive="#7e0924" emissiveIntensity={0.26} roughness={0.32} />
      </mesh>
      <mesh position={[0.1, 0.92 + offset, 0]} rotation={[0.25, 0.2, -0.2]}>
        <torusGeometry args={[0.36, 0.075, 18, 64, Math.PI * 1.22]} />
        <meshStandardMaterial color="#59d8ff" emissive="#1a7fa2" emissiveIntensity={0.42} roughness={0.25} />
      </mesh>
      <mesh position={[-0.28 - offset, 0.78, 0.05]} rotation={[0.4, 0, 0.24]}>
        <cylinderGeometry args={[0.08, 0.1, 0.88, 32]} />
        <meshStandardMaterial color="#feef87" emissive="#8d7000" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.42 + offset, 0.72, -0.02]} rotation={[0.4, 0, -0.35]}>
        <cylinderGeometry args={[0.075, 0.095, 0.82, 32]} />
        <meshStandardMaterial color="#71ddff" emissive="#1d7d9f" emissiveIntensity={0.32} />
      </mesh>
      <LabelSprite text="Aorta" position={[0.52, 1.24, 0.05]} scale={0.72} />
      <LabelSprite text="Ventricles" position={[0, -1.08, 0.14]} scale={0.78} />
    </group>
  );
}

function OSIModel({ visual, exploded }: ModelProps) {
  const layers = visual.layers ?? [];
  const palette = ['#69e3ff', '#7ee8d3', '#92f59b', '#f5e36d', '#ffb86b', '#ff7fa1', '#ba8cff'];

  return (
    <group rotation={[0.02, -0.32, 0]}>
      {layers.map((layer, index) => {
        const y = (layers.length - index - 1) * 0.28 - 0.85;
        const zOffset = exploded ? (layers.length - index - 3.5) * 0.1 : 0;
        return (
          <group key={layer} position={[0, y, zOffset]}>
            <mesh>
              <boxGeometry args={[2.15, 0.2, 1.18]} />
              <meshStandardMaterial
                color={palette[index % palette.length]}
                emissive={palette[index % palette.length]}
                emissiveIntensity={0.14}
                transparent
                opacity={0.84}
                roughness={0.24}
                metalness={0.12}
              />
            </mesh>
            <mesh position={[0, 0.115, 0]}>
              <boxGeometry args={[2.22, 0.018, 1.24]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.24} />
            </mesh>
            <LabelSprite text={`${7 - index}. ${layer}`} position={[0, y + 0.02, 0.76]} scale={0.58} />
          </group>
        );
      })}
    </group>
  );
}

function DNAModel({ exploded, paused }: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const pairs = useMemo(() => {
    return Array.from({ length: 28 }, (_, index) => {
      const t = index * 0.48;
      const y = (index - 13.5) * 0.09;
      const radius = exploded ? 0.72 : 0.52;
      const a = new THREE.Vector3(Math.cos(t) * radius, y, Math.sin(t) * radius);
      const b = new THREE.Vector3(Math.cos(t + Math.PI) * radius, y, Math.sin(t + Math.PI) * radius);
      return { a, b, t };
    });
  }, [exploded]);

  useFrame(({ clock }) => {
    if (!group.current || paused) return;
    group.current.rotation.y = clock.elapsedTime * 0.34;
  });

  return (
    <group ref={group}>
      {pairs.map((pair, index) => (
        <group key={index}>
          <GlowSphere position={[pair.a.x, pair.a.y, pair.a.z]} radius={0.08} color="#64e9ff" />
          <GlowSphere position={[pair.b.x, pair.b.y, pair.b.z]} radius={0.08} color="#ff8bd1" />
          <CylinderBetween start={pair.a} end={pair.b} radius={0.018} color={index % 2 ? '#fce67a' : '#9effb4'} opacity={0.78} />
          {index > 0 && (
            <>
              <CylinderBetween start={pairs[index - 1].a} end={pair.a} radius={0.015} color="#6beaff" opacity={0.62} />
              <CylinderBetween start={pairs[index - 1].b} end={pair.b} radius={0.015} color="#ff92d6" opacity={0.62} />
            </>
          )}
        </group>
      ))}
      <LabelSprite text="Base pairs" position={[0, 1.42, 0]} scale={0.75} />
    </group>
  );
}

function SolarPlanet({
  radius,
  speed,
  size,
  color,
  paused,
  start = 0,
}: {
  radius: number;
  speed: number;
  size: number;
  color: string;
  paused: boolean;
  start?: number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current || paused) return;
    group.current.rotation.y = clock.elapsedTime * speed + start;
  });
  return (
    <group ref={group}>
      <mesh position={[radius, 0, 0]}>
        <sphereGeometry args={[size, 32, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} roughness={0.34} />
      </mesh>
    </group>
  );
}

function SolarSystem({ exploded, paused }: ModelProps) {
  const spacing = exploded ? 1.22 : 1;
  return (
    <group rotation={[0.2, 0.15, 0]}>
      <GlowSphere position={[0, 0, 0]} radius={0.28} color="#ffd166" emissive="#ff8d00" />
      {[0.54, 0.84, 1.14, 1.48].map((radius) => (
        <mesh key={radius} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * spacing, 0.006, 8, 96]} />
          <meshBasicMaterial color="#70e6ff" transparent opacity={0.28} />
        </mesh>
      ))}
      <SolarPlanet radius={0.54 * spacing} speed={1.35} size={0.055} color="#b7becd" paused={paused} />
      <SolarPlanet radius={0.84 * spacing} speed={0.9} size={0.082} color="#54d6ff" paused={paused} start={1.3} />
      <SolarPlanet radius={1.14 * spacing} speed={0.66} size={0.071} color="#ff7f50" paused={paused} start={2.1} />
      <SolarPlanet radius={1.48 * spacing} speed={0.42} size={0.12} color="#f6d365" paused={paused} start={2.8} />
      <LabelSprite text="Orbit rings" position={[0, -1.02, 0.15]} scale={0.68} />
    </group>
  );
}

function AtomModel({ exploded, paused }: ModelProps) {
  const electronRefs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const shellRadius = exploded ? 1.25 : 0.92;

  useFrame(({ clock }) => {
    if (paused) return;
    electronRefs.forEach((ref, index) => {
      if (!ref.current) return;
      ref.current.rotation.z = clock.elapsedTime * (1.1 + index * 0.45);
      ref.current.rotation.y = clock.elapsedTime * (0.7 + index * 0.2);
    });
  });

  return (
    <group>
      <GlowSphere position={[0, 0, 0]} radius={0.2} color="#ff6b6b" emissive="#ff3030" />
      <GlowSphere position={[0.18, 0.08, 0.06]} radius={0.14} color="#ffd166" emissive="#ffa600" />
      <GlowSphere position={[-0.16, -0.1, 0.04]} radius={0.14} color="#7ee7ff" emissive="#2d9ccd" />
      {[0, 1, 2].map((index) => (
        <group key={index} rotation={[index * 0.9, index * 0.7, index * 0.4]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[shellRadius, 0.008, 10, 128]} />
            <meshBasicMaterial color="#76e9ff" transparent opacity={0.34} />
          </mesh>
          <group ref={electronRefs[index]}>
            <GlowSphere position={[shellRadius, 0, 0]} radius={0.065} color="#9dffac" emissive="#33ff62" />
          </group>
        </group>
      ))}
      <LabelSprite text="Nucleus" position={[0, 0.58, 0.25]} scale={0.65} />
    </group>
  );
}

function CellModel({ exploded, paused }: ModelProps) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current || paused) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.35) * 0.18;
  });

  const e = exploded ? 0.42 : 0;

  return (
    <group ref={group}>
      <mesh scale={[1.55, 0.95, 0.25]}>
        <sphereGeometry args={[0.9, 64, 32]} />
        <meshStandardMaterial color="#63dd8b" emissive="#1f8d47" emissiveIntensity={0.16} transparent opacity={0.28} />
      </mesh>
      <mesh scale={[1.68, 1.05, 0.28]}>
        <sphereGeometry args={[0.9, 64, 32]} />
        <meshBasicMaterial color="#bbff9d" transparent opacity={0.12} wireframe />
      </mesh>
      <GlowSphere position={[-0.32 - e, 0.12, 0.08]} radius={0.25} color="#a78bfa" emissive="#6d4ad8" />
      <GlowSphere position={[0.42 + e, -0.05, 0.05]} radius={0.32} color="#65e7ff" emissive="#1b9aba" opacity={0.72} />
      {[-0.84, -0.62, 0.72, 0.93].map((x, index) => (
        <mesh key={x} position={[x + (index % 2 ? e : -e), index < 2 ? -0.32 : 0.33, 0.15]} rotation={[0.2, 0.1, index]}>
          <capsuleGeometry args={[0.08, 0.2, 6, 16]} />
          <meshStandardMaterial color="#7dff90" emissive="#2bb246" emissiveIntensity={0.25} />
        </mesh>
      ))}
      <LabelSprite text="Nucleus" position={[-0.42 - e, 0.63, 0.26]} scale={0.58} />
      <LabelSprite text="Vacuole" position={[0.48 + e, -0.58, 0.24]} scale={0.58} />
    </group>
  );
}

function NeuralNetwork({ exploded, paused }: ModelProps) {
  const pulse = useRef<THREE.Group>(null);
  const xPositions = exploded ? [-1.15, 0, 1.15] : [-0.95, 0, 0.95];
  const layerCounts = [4, 5, 3];
  const nodes = useMemo(() => {
    return layerCounts.flatMap((count, layerIndex) => {
      return Array.from({ length: count }, (_, nodeIndex) => ({
        layerIndex,
        nodeIndex,
        position: new THREE.Vector3(
          xPositions[layerIndex],
          (nodeIndex - (count - 1) / 2) * 0.34,
          0,
        ),
      }));
    });
  }, [exploded]);

  useFrame(({ clock }) => {
    if (!pulse.current || paused) return;
    pulse.current.position.x = -1.2 + ((clock.elapsedTime * 0.7) % 2.4);
  });

  const layerNodes = (layer: number) => nodes.filter((node) => node.layerIndex === layer);

  return (
    <group>
      {[0, 1].map((layer) =>
        layerNodes(layer).flatMap((from) =>
          layerNodes(layer + 1).map((to) => (
            <CylinderBetween key={`${from.layerIndex}-${from.nodeIndex}-${to.nodeIndex}`} start={from.position} end={to.position} radius={0.006} color="#72eaff" opacity={0.24} />
          )),
        ),
      )}
      {nodes.map((node) => (
        <GlowSphere
          key={`${node.layerIndex}-${node.nodeIndex}`}
          position={[node.position.x, node.position.y, node.position.z]}
          radius={0.09}
          color={node.layerIndex === 1 ? '#ffd166' : '#74e8ff'}
        />
      ))}
      <group ref={pulse}>
        <GlowSphere position={[0, 0, 0.22]} radius={0.045} color="#ffffff" emissive="#80ecff" />
      </group>
      <LabelSprite text="Input → Hidden → Output" position={[0, -1.05, 0.12]} scale={0.72} />
    </group>
  );
}

function WaterCycle({ exploded, paused }: ModelProps) {
  const cloud = useRef<THREE.Group>(null);
  const e = exploded ? 0.28 : 0;

  useFrame(({ clock }) => {
    if (!cloud.current || paused) return;
    cloud.current.position.x = Math.sin(clock.elapsedTime * 0.55) * 0.12;
  });

  return (
    <group>
      <mesh position={[0, -0.76, 0]} scale={[1.75, 0.04, 0.72]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1c8dff" emissive="#0a5eaa" emissiveIntensity={0.18} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.78 + e, -0.34, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.38, 0.82, 4]} />
        <meshStandardMaterial color="#8d8a7b" emissive="#433f33" emissiveIntensity={0.12} />
      </mesh>
      <group ref={cloud} position={[-0.3 - e, 0.62, 0]}>
        <GlowSphere position={[-0.28, 0, 0]} radius={0.24} color="#e8fbff" emissive="#8feaff" opacity={0.9} />
        <GlowSphere position={[0, 0.08, 0]} radius={0.3} color="#e8fbff" emissive="#8feaff" opacity={0.9} />
        <GlowSphere position={[0.32, -0.02, 0]} radius={0.22} color="#e8fbff" emissive="#8feaff" opacity={0.9} />
      </group>
      {[0, 1, 2, 3].map((index) => (
        <CylinderBetween
          key={index}
          start={new THREE.Vector3(-0.45 + index * 0.14, 0.3, 0)}
          end={new THREE.Vector3(-0.7 + index * 0.12, -0.52, 0)}
          radius={0.012}
          color="#72eaff"
          opacity={0.48}
        />
      ))}
      <CylinderBetween start={new THREE.Vector3(-0.88, -0.48, 0)} end={new THREE.Vector3(-0.62 - e, 0.35, 0)} radius={0.018} color="#ffd166" opacity={0.8} />
      <CylinderBetween start={new THREE.Vector3(0.35, 0.38, 0)} end={new THREE.Vector3(0.8 + e, -0.1, 0)} radius={0.018} color="#a8ff78" opacity={0.8} />
      <LabelSprite text="Evaporation" position={[-1.0, 0.05, 0.18]} scale={0.55} />
      <LabelSprite text="Rain" position={[0.32, 0.27, 0.16]} scale={0.55} />
    </group>
  );
}

export function EducationalModel(props: ModelProps) {
  switch (props.visual.id) {
    case 'heart':
      return <HeartModel {...props} />;
    case 'osi':
      return <OSIModel {...props} />;
    case 'dna':
      return <DNAModel {...props} />;
    case 'solar':
      return <SolarSystem {...props} />;
    case 'atom':
      return <AtomModel {...props} />;
    case 'cell':
      return <CellModel {...props} />;
    case 'neural':
      return <NeuralNetwork {...props} />;
    case 'waterCycle':
      return <WaterCycle {...props} />;
    default:
      return <HeartModel {...props} />;
  }
}

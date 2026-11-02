import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { VisualEntry } from "../types";

type ModelProps = {
  visual: VisualEntry;
  exploded: boolean;
  paused: boolean;
};

function createLabelTexture(text: string) {
  const canvas = document.createElement("canvas");
  const width = 512;
  const height = 128;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(255, 255, 252, 0.96)";
  context.strokeStyle = "rgba(190, 198, 184, 0.85)";
  context.lineWidth = 2;
  context.roundRect(8, 8, width - 16, height - 16, 22);
  context.fill();
  context.stroke();
  context.font = "500 46px Arial, sans-serif";
  context.fillStyle = "#34483c";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, height / 2, width - 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function LabelSprite({
  text,
  position,
  scale = 1,
}: {
  text: string;
  position: [number, number, number];
  scale?: number;
}) {
  const texture = useMemo(() => createLabelTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[1.9 * scale, 0.48 * scale, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        depthTest={false}
        toneMapped={false}
      />
    </sprite>
  );
}

function CylinderBetween({
  start,
  end,
  radius = 0.025,
  color = "#73978b",
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
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    return { position: mid, quaternion: rotation, length: lengthValue };
  }, [end, start]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 16]} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.6}
        metalness={0.02}
      />
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
        emissiveIntensity={0.04}
        roughness={0.52}
        metalness={0.02}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

type Point3 = [number, number, number];

function Vessel({
  points,
  radius,
  color,
}: {
  points: Point3[];
  radius: number;
  color: string;
}) {
  const signature = JSON.stringify(points);
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point)),
      ),
    [signature],
  );
  return (
    <mesh>
      <tubeGeometry args={[curve, 48, radius, 16, false]} />
      <meshStandardMaterial
        color={color}
        roughness={0.5}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function HeartChamber({
  position,
  scale,
  rotation = 0,
  color,
}: {
  position: Point3;
  scale: Point3;
  rotation?: number;
  color: string;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.SphereGeometry(1, 64, 48);
    const vertices = shape.attributes.position;
    for (let index = 0; index < vertices.count; index++) {
      const x = vertices.getX(index);
      const y = vertices.getY(index);
      const z = vertices.getZ(index);
      const lower = (1 - y) / 2;
      const width = 0.88 + y * 0.13 + Math.sin(y * 3) * 0.035;
      vertices.setXYZ(
        index,
        x * width + lower * lower * 0.18,
        y,
        z * (0.94 + Math.sin(y * 4) * 0.04),
      );
    }
    shape.computeVertexNormals();
    return shape;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={position}
      scale={scale}
      rotation={[0, 0, rotation]}
    >
      <meshStandardMaterial color={color} roughness={0.48} metalness={0} />
    </mesh>
  );
}

function HeartModel({ exploded, paused }: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const beat = useRef(0);
  useFrame((_, delta) => {
    if (!group.current || paused) return;
    beat.current += delta;
    const pulse = 1 + Math.sin(beat.current * 4.2) * 0.018;
    group.current.scale.setScalar(pulse);
  });
  const offset = exploded ? 0.3 : 0;
  return (
    <group>
      <group ref={group} rotation={[0, -0.12, -0.06]}>
        <HeartChamber
          position={[0.13 + offset, -0.14 - offset * 0.2, 0]}
          scale={[0.61, 0.86, 0.45]}
          rotation={-0.25}
          color="#ad4b47"
        />
        <HeartChamber
          position={[-0.25 - offset, 0.06, 0.2]}
          scale={[0.46, 0.63, 0.34]}
          rotation={0.22}
          color="#c66f66"
        />
        <HeartChamber
          position={[-0.35 - offset, 0.54 + offset, -0.03]}
          scale={[0.32, 0.3, 0.33]}
          rotation={0.2}
          color="#be6b61"
        />
        <HeartChamber
          position={[0.37 + offset, 0.53 + offset, -0.08]}
          scale={[0.26, 0.26, 0.28]}
          rotation={-0.3}
          color="#a7514d"
        />
        <group position={[0, offset, 0]}>
          <Vessel
            points={[
              [0.03, 0.45, -0.03],
              [0.04, 0.85, -0.05],
              [-0.1, 1.13, -0.08],
              [-0.38, 1.2, -0.14],
              [-0.56, 1.04, -0.2],
              [-0.53, 0.75, -0.25],
            ]}
            radius={0.13}
            color="#ae544a"
          />
          <Vessel
            points={[
              [-0.05, 1.08, -0.07],
              [0, 1.32, -0.06],
              [0.03, 1.43, -0.04],
            ]}
            radius={0.05}
            color="#ae544a"
          />
          <Vessel
            points={[
              [-0.23, 1.17, -0.1],
              [-0.22, 1.39, -0.11],
            ]}
            radius={0.045}
            color="#ae544a"
          />
          <Vessel
            points={[
              [-0.4, 1.15, -0.15],
              [-0.46, 1.34, -0.2],
            ]}
            radius={0.045}
            color="#ae544a"
          />
          <Vessel
            points={[
              [0.23, 0.38, 0.18],
              [0.26, 0.7, 0.2],
              [0.42, 0.91, 0.12],
              [0.7, 0.94, 0],
            ]}
            radius={0.11}
            color="#6f9297"
          />
          <Vessel
            points={[
              [0.29, 0.75, 0.18],
              [0.06, 0.82, 0.24],
              [-0.18, 0.8, 0.24],
            ]}
            radius={0.07}
            color="#6f9297"
          />
          <Vessel
            points={[
              [-0.42, 0.45, -0.13],
              [-0.58, 0.73, -0.13],
              [-0.64, 1.14, -0.1],
            ]}
            radius={0.1}
            color="#63898f"
          />
          <Vessel
            points={[
              [-0.4, 0.42, -0.19],
              [-0.62, 0.16, -0.15],
              [-0.61, -0.19, -0.17],
            ]}
            radius={0.09}
            color="#63898f"
          />
          <Vessel
            points={[
              [0.4, 0.57, -0.08],
              [0.68, 0.65, -0.13],
              [0.78, 0.78, -0.15],
            ]}
            radius={0.075}
            color="#b7655d"
          />
        </group>
        <group position={[offset * 0.2, 0, 0]}>
          <Vessel
            points={[
              [0.06, 0.46, 0.4],
              [0.16, 0.23, 0.46],
              [0.1, -0.06, 0.49],
              [0.16, -0.38, 0.39],
              [0.31, -0.66, 0.19],
            ]}
            radius={0.024}
            color="#8b3b39"
          />
          <Vessel
            points={[
              [0.14, 0.2, 0.46],
              [0.34, 0.11, 0.44],
              [0.48, -0.05, 0.35],
            ]}
            radius={0.016}
            color="#8b3b39"
          />
          <Vessel
            points={[
              [0.1, -0.06, 0.49],
              [-0.13, -0.24, 0.45],
              [-0.26, -0.43, 0.29],
            ]}
            radius={0.015}
            color="#8b3b39"
          />
          <Vessel
            points={[
              [0.12, 0.39, 0.43],
              [-0.13, 0.44, 0.49],
              [-0.43, 0.36, 0.4],
            ]}
            radius={0.018}
            color="#9a4640"
          />
        </group>
      </group>
      <CylinderBetween
        start={new THREE.Vector3(-0.1, 1.18 + offset, 0.02)}
        end={new THREE.Vector3(1.07, 1.18 + offset, 0.02)}
        radius={0.005}
        color="#9daa97"
        opacity={1}
      />
      <LabelSprite
        text="Aorta"
        position={[1.29, 1.18 + offset, 0.03]}
        scale={0.55}
      />
      <CylinderBetween
        start={new THREE.Vector3(-0.48 - offset, 0.28, 0.22)}
        end={new THREE.Vector3(-1.08 - offset, 0.28, 0.22)}
        radius={0.005}
        color="#9daa97"
        opacity={1}
      />
      <LabelSprite
        text="Right atrium"
        position={[-1.31 - offset, 0.28, 0.24]}
        scale={0.61}
      />
      <CylinderBetween
        start={new THREE.Vector3(0.44 + offset, -0.43, 0.22)}
        end={new THREE.Vector3(1.05 + offset, -0.43, 0.22)}
        radius={0.005}
        color="#9daa97"
        opacity={1}
      />
      <LabelSprite
        text="Left ventricle"
        position={[1.29 + offset, -0.43, 0.25]}
        scale={0.64}
      />
    </group>
  );
}

function OSIModel({ visual, exploded }: ModelProps) {
  const layers = visual.layers ?? [];
  const palette = [
    "#a7c5b2",
    "#84ad9f",
    "#93aaa7",
    "#c4c49b",
    "#c8aa83",
    "#be9189",
    "#aaa4bc",
  ];

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
                emissiveIntensity={0.02}
                transparent
                opacity={0.96}
                roughness={0.6}
                metalness={0.02}
              />
            </mesh>
            <mesh position={[0, 0.115, 0]}>
              <boxGeometry args={[2.22, 0.018, 1.24]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.24} />
            </mesh>
            <LabelSprite
              text={`${7 - index}. ${layer}`}
              position={[0, 0.01, 0.76]}
              scale={0.5}
            />
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
      const a = new THREE.Vector3(
        Math.cos(t) * radius,
        y,
        Math.sin(t) * radius,
      );
      const b = new THREE.Vector3(
        Math.cos(t + Math.PI) * radius,
        y,
        Math.sin(t + Math.PI) * radius,
      );
      return { a, b, t };
    });
  }, [exploded]);

  useFrame((_, delta) => {
    if (!group.current || paused) return;
    group.current.rotation.y += Math.min(delta, 0.1) * 0.34;
  });

  return (
    <group ref={group}>
      {pairs.map((pair, index) => (
        <group key={index}>
          <GlowSphere
            position={[pair.a.x, pair.a.y, pair.a.z]}
            radius={0.08}
            color="#609989"
          />
          <GlowSphere
            position={[pair.b.x, pair.b.y, pair.b.z]}
            radius={0.08}
            color="#bd8072"
          />
          <CylinderBetween
            start={pair.a}
            end={pair.b}
            radius={0.018}
            color={index % 2 ? "#cba86a" : "#8ca398"}
            opacity={0.78}
          />
          {index > 0 && (
            <>
              <CylinderBetween
                start={pairs[index - 1].a}
                end={pair.a}
                radius={0.015}
                color="#609989"
                opacity={0.62}
              />
              <CylinderBetween
                start={pairs[index - 1].b}
                end={pair.b}
                radius={0.015}
                color="#bd8072"
                opacity={0.62}
              />
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
  useFrame((_, delta) => {
    if (!group.current || paused) return;
    group.current.rotation.y += Math.min(delta, 0.1) * speed;
  });
  return (
    <group ref={group} rotation={[0, start, 0]}>
      <mesh position={[radius, 0, 0]}>
        <sphereGeometry args={[size, 32, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.04}
          roughness={0.34}
        />
      </mesh>
    </group>
  );
}

function SolarSystem({ exploded, paused }: ModelProps) {
  const spacing = exploded ? 1.22 : 1;
  return (
    <group rotation={[0.2, 0.15, 0]}>
      <GlowSphere
        position={[0, 0, 0]}
        radius={0.28}
        color="#d5af65"
        emissive="#b8752d"
      />
      {[0.54, 0.84, 1.14, 1.48].map((radius) => (
        <mesh key={radius} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * spacing, 0.006, 8, 96]} />
          <meshBasicMaterial color="#95a491" transparent opacity={0.6} />
        </mesh>
      ))}
      <SolarPlanet
        radius={0.54 * spacing}
        speed={1.35}
        size={0.055}
        color="#a6a99c"
        paused={paused}
      />
      <SolarPlanet
        radius={0.84 * spacing}
        speed={0.9}
        size={0.082}
        color="#709aa4"
        paused={paused}
        start={1.3}
      />
      <SolarPlanet
        radius={1.14 * spacing}
        speed={0.66}
        size={0.071}
        color="#c17a58"
        paused={paused}
        start={2.1}
      />
      <SolarPlanet
        radius={1.48 * spacing}
        speed={0.42}
        size={0.12}
        color="#c8ab79"
        paused={paused}
        start={2.8}
      />
      <LabelSprite
        text="Orbit rings"
        position={[0, -1.02, 0.15]}
        scale={0.68}
      />
    </group>
  );
}

function AtomModel({ exploded, paused }: ModelProps) {
  const electronRefs = [
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
  ];
  const shellRadius = exploded ? 1.25 : 0.92;

  useFrame((_, delta) => {
    if (paused) return;
    electronRefs.forEach((ref, index) => {
      if (!ref.current) return;
      ref.current.rotation.z += Math.min(delta, 0.1) * (1.1 + index * 0.45);
      ref.current.rotation.y += Math.min(delta, 0.1) * (0.7 + index * 0.2);
    });
  });

  return (
    <group>
      <GlowSphere
        position={[0, 0, 0]}
        radius={0.2}
        color="#bf7767"
        emissive="#8b473e"
      />
      <GlowSphere
        position={[0.18, 0.08, 0.06]}
        radius={0.14}
        color="#d5af65"
        emissive="#b38339"
      />
      <GlowSphere
        position={[-0.16, -0.1, 0.04]}
        radius={0.14}
        color="#7e9eac"
        emissive="#466d7c"
      />
      {[0, 1, 2].map((index) => (
        <group key={index} rotation={[index * 0.9, index * 0.7, index * 0.4]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[shellRadius, 0.008, 10, 128]} />
            <meshBasicMaterial color="#79978a" transparent opacity={0.68} />
          </mesh>
          <group ref={electronRefs[index]}>
            <GlowSphere
              position={[shellRadius, 0, 0]}
              radius={0.065}
              color="#7b9f7d"
              emissive="#426944"
            />
          </group>
        </group>
      ))}
      <LabelSprite text="Nucleus" position={[0, 0.58, 0.25]} scale={0.65} />
    </group>
  );
}

function CellModel({ exploded, paused }: ModelProps) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!group.current || paused) return;
    elapsed.current += Math.min(delta, 0.1);
    group.current.rotation.y = Math.sin(elapsed.current * 0.35) * 0.18;
  });

  const e = exploded ? 0.42 : 0;

  return (
    <group ref={group}>
      <mesh scale={[1.55, 0.95, 0.25]}>
        <sphereGeometry args={[0.9, 64, 32]} />
        <meshStandardMaterial
          color="#94b792"
          emissive="#487655"
          emissiveIntensity={0.03}
          transparent
          opacity={0.28}
        />
      </mesh>
      <mesh scale={[1.68, 1.05, 0.28]}>
        <sphereGeometry args={[0.9, 64, 32]} />
        <meshBasicMaterial
          color="#7f9e70"
          transparent
          opacity={0.075}
          wireframe
        />
      </mesh>
      <GlowSphere
        position={[-0.32 - e, 0.12, 0.08]}
        radius={0.25}
        color="#aaa1c0"
        emissive="#645b82"
      />
      <GlowSphere
        position={[0.42 + e, -0.05, 0.05]}
        radius={0.32}
        color="#9bbcc3"
        emissive="#5b838d"
        opacity={0.72}
      />
      {[-0.84, -0.62, 0.72, 0.93].map((x, index) => (
        <mesh
          key={x}
          position={[x + (index % 2 ? e : -e), index < 2 ? -0.32 : 0.33, 0.15]}
          rotation={[0.2, 0.1, index]}
        >
          <capsuleGeometry args={[0.08, 0.2, 6, 16]} />
          <meshStandardMaterial
            color="#7f9e70"
            emissive="#48633f"
            emissiveIntensity={0.03}
          />
        </mesh>
      ))}
      <LabelSprite
        text="Nucleus"
        position={[-0.42 - e, 0.63, 0.26]}
        scale={0.58}
      />
      <LabelSprite
        text="Vacuole"
        position={[0.48 + e, -0.58, 0.24]}
        scale={0.58}
      />
    </group>
  );
}

function NeuralNetwork({ exploded, paused }: ModelProps) {
  const pulse = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
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

  useFrame((_, delta) => {
    if (!pulse.current || paused) return;
    elapsed.current += Math.min(delta, 0.1);
    pulse.current.position.x = -1.2 + ((elapsed.current * 0.7) % 2.4);
  });

  const layerNodes = (layer: number) =>
    nodes.filter((node) => node.layerIndex === layer);

  return (
    <group>
      {[0, 1].map((layer) =>
        layerNodes(layer).flatMap((from) =>
          layerNodes(layer + 1).map((to) => (
            <CylinderBetween
              key={`${from.layerIndex}-${from.nodeIndex}-${to.nodeIndex}`}
              start={from.position}
              end={to.position}
              radius={0.006}
              color="#789b9e"
              opacity={0.5}
            />
          )),
        ),
      )}
      {nodes.map((node) => (
        <GlowSphere
          key={`${node.layerIndex}-${node.nodeIndex}`}
          position={[node.position.x, node.position.y, node.position.z]}
          radius={0.09}
          color={node.layerIndex === 1 ? "#d5af65" : "#75a491"}
        />
      ))}
      <group ref={pulse}>
        <GlowSphere
          position={[0, 0, 0.22]}
          radius={0.045}
          color="#ffffff"
          emissive="#557b6d"
        />
      </group>
      <LabelSprite
        text="Input → Hidden → Output"
        position={[0, -1.05, 0.12]}
        scale={0.72}
      />
    </group>
  );
}

function WaterCycle({ exploded, paused }: ModelProps) {
  const cloud = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const e = exploded ? 0.28 : 0;

  useFrame((_, delta) => {
    if (!cloud.current || paused) return;
    elapsed.current += Math.min(delta, 0.1);
    cloud.current.position.x =
      -0.3 - e + Math.sin(elapsed.current * 0.55) * 0.12;
  });

  return (
    <group>
      <mesh position={[0, -0.76, 0]} scale={[1.75, 0.04, 0.72]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#89aeb9"
          emissive="#557c87"
          emissiveIntensity={0.03}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh position={[0.78 + e, -0.34, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.38, 0.82, 4]} />
        <meshStandardMaterial
          color="#9b9e85"
          emissive="#65684d"
          emissiveIntensity={0.02}
        />
      </mesh>
      <group ref={cloud} position={[-0.3 - e, 0.62, 0]}>
        <GlowSphere
          position={[-0.28, 0, 0]}
          radius={0.24}
          color="#cbd7d5"
          emissive="#7b9b9e"
          opacity={0.9}
        />
        <GlowSphere
          position={[0, 0.08, 0]}
          radius={0.3}
          color="#cbd7d5"
          emissive="#7b9b9e"
          opacity={0.9}
        />
        <GlowSphere
          position={[0.32, -0.02, 0]}
          radius={0.22}
          color="#cbd7d5"
          emissive="#7b9b9e"
          opacity={0.9}
        />
      </group>
      {[0, 1, 2, 3].map((index) => (
        <CylinderBetween
          key={index}
          start={new THREE.Vector3(-0.45 + index * 0.14, 0.3, 0)}
          end={new THREE.Vector3(-0.7 + index * 0.12, -0.52, 0)}
          radius={0.012}
          color="#789b9e"
          opacity={0.48}
        />
      ))}
      <CylinderBetween
        start={new THREE.Vector3(-0.88, -0.48, 0)}
        end={new THREE.Vector3(-0.62 - e, 0.35, 0)}
        radius={0.018}
        color="#d5af65"
        opacity={0.8}
      />
      <CylinderBetween
        start={new THREE.Vector3(0.35, 0.38, 0)}
        end={new THREE.Vector3(0.8 + e, -0.1, 0)}
        radius={0.018}
        color="#94a875"
        opacity={0.8}
      />
      <LabelSprite
        text="Evaporation"
        position={[-1.0, 0.05, 0.18]}
        scale={0.55}
      />
      <LabelSprite text="Rain" position={[0.32, 0.27, 0.16]} scale={0.55} />
    </group>
  );
}

export function EducationalModel(props: ModelProps) {
  switch (props.visual.id) {
    case "heart":
      return <HeartModel {...props} />;
    case "osi":
      return <OSIModel {...props} />;
    case "dna":
      return <DNAModel {...props} />;
    case "solar":
      return <SolarSystem {...props} />;
    case "atom":
      return <AtomModel {...props} />;
    case "cell":
      return <CellModel {...props} />;
    case "neural":
      return <NeuralNetwork {...props} />;
    case "waterCycle":
      return <WaterCycle {...props} />;
    default:
      return <HeartModel {...props} />;
  }
}

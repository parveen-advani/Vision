import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { EducationalModel } from "./ModelScenes";
import type { GestureState, ModelTransform, VisualEntry } from "../types";

const categoryNames = {
  biology: "Biology",
  "computer-science": "Computer science",
  physics: "Physics",
  "earth-science": "Earth science",
};

function CameraFraming({
  visual,
  exploded,
}: {
  visual: VisualEntry;
  exploded: boolean;
}) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    // Reserve room for annotation sprites and separated parts on narrow canvases.
    const widths: Record<VisualEntry["id"], [number, number]> = {
      heart: [4.45, 5],
      osi: [3.2, 3.5],
      dna: [2.4, 2.8],
      solar: [3.7, 4.4],
      atom: [3, 3.5],
      cell: [3.8, 4.6],
      neural: [3.3, 3.7],
      waterCycle: [3.7, 4.1],
    };
    const width = widths[visual.id][exploded ? 1 : 0];
    const aspect = size.width / Math.max(size.height, 1);
    const distance =
      width /
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect) +
      0.3;
    camera.position.z = Math.max(4.8, distance);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, visual.id, exploded]);
  return null;
}

function SceneRig({
  visual,
  transform,
  gesture,
}: {
  visual: VisualEntry;
  transform: ModelTransform;
  gesture: GestureState;
}) {
  const group = useRef<THREE.Group>(null);
  const autoRotation = useRef(0);
  const previousTransform = useRef(transform);
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  useEffect(() => {
    autoRotation.current = 0;
  }, [visual.id]);
  useEffect(() => {
    const previous = previousTransform.current;
    if (
      !transform.rotationX &&
      !transform.rotationY &&
      transform.zoom === 1 &&
      !transform.exploded &&
      (previous.rotationX ||
        previous.rotationY ||
        previous.zoom !== 1 ||
        previous.exploded)
    )
      autoRotation.current = 0;
    previousTransform.current = transform;
  }, [transform]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const liveGesture =
      gesture.active &&
      (gesture.name === "open-palm" || gesture.name === "point");
    if (!transform.paused && !liveGesture)
      autoRotation.current += Math.min(delta, 0.1) * 0.075;
    const x =
      transform.rotationX +
      (liveGesture ? (gesture.y - 0.5) * Math.PI * 0.85 : 0);
    const y =
      transform.rotationY +
      autoRotation.current +
      (liveGesture ? (0.5 - gesture.x) * Math.PI * 1.15 : 0);
    const gestureScale = gesture.active && gesture.name === "pinch" ? 1.18 : 1;
    const scale = Math.max(0.58, Math.min(1.9, transform.zoom * gestureScale));
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      x,
      6,
      delta,
    );
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      y,
      6,
      delta,
    );
    group.current.scale.lerp(
      targetScale.current.setScalar(scale),
      1 - Math.exp(-delta * 6),
    );
  });
  return (
    <group ref={group}>
      <EducationalModel
        visual={visual}
        exploded={transform.exploded}
        paused={transform.paused}
      />
    </group>
  );
}

export function ProjectionStage({
  visual,
  transform,
  gesture,
  projectorMode,
  children,
  onRotate,
}: {
  visual: VisualEntry;
  transform: ModelTransform;
  gesture: GestureState;
  projectorMode: boolean;
  children?: ReactNode;
  onRotate?: (deltaYaw: number, deltaPitch: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const lastPointer = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    engaged: boolean;
  } | null>(null);
  const showSpotlight = gesture.active && gesture.name === "point";
  const title = visual.id === "heart" ? "Human heart" : visual.shortTitle;
  return (
    <section
      className={`projection-stage ${projectorMode ? "projection-stage--wide" : ""}`}
      aria-label={`${title} interactive model`}
    >
      <div className="stage-chrome">
        <div>
          <p className="eyebrow">
            {categoryNames[visual.category]} <span aria-hidden="true">/</span>{" "}
            3D exploration
          </p>
          <h2>{title}</h2>
        </div>
        <div className="stage-status">
          <span className={transform.paused ? "warn" : "ok"}>
            <i aria-hidden="true" />
            {transform.paused ? "Paused" : "Animated"}
          </span>
          {transform.exploded && <span>Parts view</span>}
        </div>
      </div>
      <div
        className={`canvas-shell${dragging ? " is-dragging" : ""}`}
        style={{
          cursor: onRotate ? (dragging ? "grabbing" : "grab") : undefined,
          touchAction: onRotate ? "pan-y pinch-zoom" : undefined,
        }}
        onPointerDown={(event) => {
          if (!onRotate || event.button !== 0 || !event.isPrimary) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const engaged = event.pointerType !== "touch";
          lastPointer.current = {
            x: event.clientX,
            y: event.clientY,
            startX: event.clientX,
            startY: event.clientY,
            engaged,
          };
          setDragging(engaged);
        }}
        onPointerMove={(event) => {
          if (!lastPointer.current || !onRotate) return;
          const pointer = lastPointer.current;
          if (!pointer.engaged) {
            const dx = Math.abs(event.clientX - pointer.startX);
            const dy = Math.abs(event.clientY - pointer.startY);
            if (dx < 6 || dx <= dy) return;
            pointer.engaged = true;
            setDragging(true);
          }
          onRotate(
            (event.clientX - pointer.x) * 0.008,
            event.pointerType === "touch"
              ? 0
              : (event.clientY - pointer.y) * 0.006,
          );
          pointer.x = event.clientX;
          pointer.y = event.clientY;
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          lastPointer.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          lastPointer.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={() => {
          lastPointer.current = null;
          setDragging(false);
        }}
      >
        <Canvas
          shadows
          camera={{ position: [0, 0.05, 4.8], fov: 42 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true }}
        >
          <CameraFraming visual={visual} exploded={transform.exploded} />
          <color attach="background" args={["#f6f5f0"]} />
          <ambientLight intensity={1.05} />
          <hemisphereLight args={["#fff9ee", "#b3c2b6", 1.7]} />
          <directionalLight
            position={[-3, 5, 5]}
            intensity={2.4}
            color="#fff8ef"
          />
          <directionalLight
            position={[4, 1, 2]}
            intensity={0.9}
            color="#e9f0ec"
          />
          <Suspense fallback={null}>
            <SceneRig visual={visual} transform={transform} gesture={gesture} />
          </Suspense>
        </Canvas>
        <div className="stage-orientation" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path
              d="M17 20V6M17 20L30 26M17 20L5 27"
              stroke="#b3bdb0"
              strokeWidth="1.5"
            />
            <circle cx="17" cy="20" r="2.5" fill="#657f68" />
            <path
              d="M15 8L17 5L19 8M27 23L31 26L27 27M8 24L4 27L8 28"
              stroke="#657f68"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="stage-caption">
          {onRotate ? "Drag to rotate" : "Interactive 3D model"}
          <span aria-hidden="true"> · </span>
          {Math.round(transform.zoom * 100)}%
        </div>
        <span className="stage-model-note">Illustrative model</span>
        {showSpotlight && (
          <div
            className="gesture-spotlight"
            style={{
              left: `${Math.round(gesture.x * 100)}%`,
              top: `${Math.round(gesture.y * 100)}%`,
            }}
          />
        )}
      </div>
      {children}
    </section>
  );
}

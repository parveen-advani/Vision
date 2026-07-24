import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { EducationalModel } from './ModelScenes';
import type { GestureState, ModelTransform, VisualEntry } from '../types';

function GridFloor() {
  const grid = useMemo(() => new THREE.GridHelper(6, 24, '#1bdcff', '#123047'), []);
  return <primitive object={grid} position={[0, -1.35, 0]} />;
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
  const halo = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;

    const liveGesture = gesture.active && (gesture.name === 'open-palm' || gesture.name === 'point');
    const targetX = transform.rotationX + (liveGesture ? (gesture.y - 0.5) * Math.PI * 0.85 : 0);
    const targetY = transform.rotationY + (liveGesture ? (0.5 - gesture.x) * Math.PI * 1.15 : 0);
    const gestureScale = gesture.name === 'pinch' ? 1.18 : 1;
    const targetScale = Math.max(0.58, Math.min(1.9, transform.zoom * gestureScale));

    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 1 - Math.exp(-delta * 5));
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 1 - Math.exp(-delta * 5));
    group.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-delta * 4));

    if (!transform.paused) {
      group.current.rotation.y += delta * 0.18;
    }

    if (halo.current) {
      halo.current.rotation.z = clock.elapsedTime * 0.08;
    }
  });

  return (
    <group>
      <mesh ref={halo} position={[0, 0, -0.16]} rotation={[0, 0, 0]}>
        <torusGeometry args={[1.72, 0.006, 8, 192]} />
        <meshBasicMaterial color="#37dfff" transparent opacity={0.28} />
      </mesh>
      <group ref={group}>
        <EducationalModel visual={visual} exploded={transform.exploded} paused={transform.paused} />
      </group>
    </group>
  );
}

export function ProjectionStage({
  visual,
  transform,
  gesture,
  projectorMode,
}: {
  visual: VisualEntry;
  transform: ModelTransform;
  gesture: GestureState;
  projectorMode: boolean;
}) {
  const showSpotlight = gesture.active && gesture.name === 'point';
  const spotlightStyle = {
    left: `${Math.round(gesture.x * 100)}%`,
    top: `${Math.round(gesture.y * 100)}%`,
  };

  return (
    <section className={`projection-stage ${projectorMode ? 'projection-stage--wide' : ''}`}>
      <div className="stage-chrome">
        <div>
          <p className="eyebrow">Live smart board</p>
          <h2>{visual.title}</h2>
          <span>{visual.subtitle}</span>
        </div>
        <div className="stage-status">
          <span className={transform.paused ? 'warn' : 'ok'}>{transform.paused ? 'Paused' : 'Animated'}</span>
          <span>{transform.exploded ? 'Parts view' : 'Unified view'}</span>
        </div>
      </div>

      <div className="canvas-shell">
        <Canvas camera={{ position: [0, 0.2, 4.2], fov: 45 }} dpr={[1, 1.8]}>
          <color attach="background" args={["#030713"]} />
          <fog attach="fog" args={["#030713", 5, 10]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[2.5, 4, 4]} intensity={1.55} />
          <pointLight position={[-2, 1, 2]} color="#2ee8ff" intensity={1.8} />
          <pointLight position={[2, -1, -2]} color="#826bff" intensity={1.1} />
          <Suspense fallback={null}>
            <SceneRig visual={visual} transform={transform} gesture={gesture} />
            <GridFloor />
          </Suspense>
        </Canvas>
        <div className="hologram-scan" />
        {showSpotlight && <div className="gesture-spotlight" style={spotlightStyle} />}
      </div>

      <div className="model-explanation">
        <strong>Teacher narration helper</strong>
        <p>{visual.explanation}</p>
      </div>
    </section>
  );
}

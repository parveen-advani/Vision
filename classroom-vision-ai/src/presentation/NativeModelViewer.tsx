import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { Icon } from "../components/Icon";
import type { GestureState } from "../types";
import { gestureMotion } from "../utils/handMotion";
import "./native-model-viewer.css";

export interface NativeModelViewerProps {
  file: File;
  onClose: () => void;
  gesture?: GestureState;
  gestureEnabled: boolean;
  resetToken: number;
  source?: {
    title: string;
    author: string;
    sourceUrl: string;
    license: string;
    licenseUrl: string;
  };
}

interface LocalAsset {
  file: File;
  gltf: GLTF;
  object: THREE.Group;
  floor: number;
  copyright: string;
  meshes: number;
  triangles: number;
}
interface NativeActions {
  zoom: (factor: number) => void;
  rotate: (angle: number) => void;
  reset: () => void;
}
const MAX_FILE_BYTES = 50 * 1024 * 1024;
class LocalModelError extends Error {}

function settleOrbit(controls: OrbitControls) {
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = true;
}

function inspectGlb(data: ArrayBuffer) {
  const view = new DataView(data);
  if (
    data.byteLength < 20 ||
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== data.byteLength
  ) {
    throw new LocalModelError(
      "This is not a valid GLB 2.0 file. Export the model as a binary glTF (.glb) and try again.",
    );
  }
  let offset = 12;
  let json: Record<string, unknown> | null = null;
  while (offset < data.byteLength) {
    if (offset + 8 > data.byteLength)
      throw new LocalModelError(
        "This GLB file is incomplete. Export a fresh copy and try again.",
      );
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (length % 4 !== 0 || offset + 8 + length > data.byteLength)
      throw new LocalModelError(
        "This GLB file contains an invalid data chunk.",
      );
    if (offset === 12 && type !== 0x4e4f534a)
      throw new LocalModelError(
        "The GLB file is missing its model description.",
      );
    if (type === 0x4e4f534a) {
      if (json)
        throw new LocalModelError(
          "This GLB file contains more than one model description.",
        );
      try {
        json = JSON.parse(
          new TextDecoder()
            .decode(new Uint8Array(data, offset + 8, length))
            .replace(/\0+$/, ""),
        );
      } catch {
        throw new LocalModelError(
          "The GLB model description could not be read.",
        );
      }
    }
    offset += 8 + length;
  }
  if (!json || typeof json !== "object" || Array.isArray(json))
    throw new LocalModelError("The GLB model description is missing.");
  const pending: unknown[] = [json];
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== "object") continue;
    for (const [key, value] of Object.entries(item)) {
      if (
        key === "uri" &&
        (typeof value !== "string" || !/^data:/i.test(value))
      ) {
        throw new LocalModelError(
          "This model links to an external file. Export a self-contained GLB with its geometry and textures embedded.",
        );
      }
      if (value && typeof value === "object") pending.push(value);
    }
  }
  const extensions = new Set([
    ...(Array.isArray(json.extensionsRequired) ? json.extensionsRequired : []),
    ...(Array.isArray(json.extensionsUsed) ? json.extensionsUsed : []),
  ]);
  if (extensions.has("KHR_draco_mesh_compression"))
    throw new LocalModelError(
      "This file uses Draco compression. Export a GLB without Draco compression to open it here.",
    );
  if (extensions.has("KHR_texture_basisu"))
    throw new LocalModelError(
      "This file uses KTX2 compressed textures. Export a GLB with embedded PNG or JPEG textures to open it here.",
    );
  const supportedExtensions = new Set([
    "KHR_lights_punctual",
    "KHR_materials_clearcoat",
    "KHR_materials_dispersion",
    "KHR_materials_ior",
    "KHR_materials_sheen",
    "KHR_materials_specular",
    "KHR_materials_transmission",
    "KHR_materials_iridescence",
    "KHR_materials_anisotropy",
    "KHR_materials_unlit",
    "KHR_materials_volume",
    "KHR_texture_transform",
    "KHR_mesh_quantization",
    "KHR_materials_emissive_strength",
    "EXT_materials_bump",
    "EXT_texture_webp",
    "EXT_texture_avif",
    "EXT_meshopt_compression",
    "EXT_mesh_gpu_instancing",
  ]);
  for (const extension of Array.isArray(json.extensionsRequired)
    ? json.extensionsRequired
    : []) {
    if (typeof extension !== "string" || !supportedExtensions.has(extension))
      throw new LocalModelError(
        `This file requires an unsupported model extension (${String(extension)}). Export a standard GLB and try again.`,
      );
  }
  const decodedLimit = 128 * 1024 * 1024;
  const componentSizes: Record<number, number> = {
    5120: 1,
    5121: 1,
    5122: 2,
    5123: 2,
    5125: 4,
    5126: 4,
  };
  const componentCounts: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
  };
  let decodedBytes = 0;
  for (const value of Array.isArray(json.accessors) ? json.accessors : []) {
    const accessor = value as {
      count?: number;
      type?: string;
      componentType?: number;
      sparse?: { count?: number };
    };
    const bytes = componentSizes[accessor.componentType ?? 0];
    const components = componentCounts[accessor.type ?? ""];
    if (
      !Number.isSafeInteger(accessor.count) ||
      (accessor.count ?? -1) < 0 ||
      !bytes ||
      !components
    )
      throw new LocalModelError("This model contains invalid geometry data.");
    if (
      accessor.sparse &&
      (!Number.isSafeInteger(accessor.sparse.count) ||
        (accessor.sparse.count ?? -1) < 0 ||
        accessor.sparse.count! > accessor.count!)
    )
      throw new LocalModelError(
        "This model contains invalid sparse geometry data.",
      );
    decodedBytes += accessor.count! * bytes * components;
    if (decodedBytes > decodedLimit)
      throw new LocalModelError(
        "This model expands beyond the browser’s supported geometry budget. Export a lighter version and try again.",
      );
  }
  const buffers = Array.isArray(json.buffers)
    ? (json.buffers as Array<{ byteLength?: number }>)
    : [];
  for (const buffer of buffers) {
    if (
      !Number.isSafeInteger(buffer.byteLength) ||
      (buffer.byteLength ?? -1) < 0 ||
      buffer.byteLength! > decodedLimit
    )
      throw new LocalModelError(
        "This model declares an unsupported buffer size. Export a lighter GLB and try again.",
      );
  }
  let meshoptBytes = 0;
  for (const value of Array.isArray(json.bufferViews) ? json.bufferViews : []) {
    const bufferView = value as {
      buffer?: number;
      byteOffset?: number;
      byteLength?: number;
      extensions?: {
        EXT_meshopt_compression?: { count?: number; byteStride?: number };
      };
    };
    const start = bufferView.byteOffset ?? 0;
    const buffer = buffers[bufferView.buffer ?? -1];
    if (
      !buffer ||
      !Number.isSafeInteger(start) ||
      start < 0 ||
      !Number.isSafeInteger(bufferView.byteLength) ||
      (bufferView.byteLength ?? -1) < 0 ||
      start + bufferView.byteLength! > buffer.byteLength!
    )
      throw new LocalModelError(
        "This model contains an invalid geometry buffer range.",
      );
    const meshopt = bufferView.extensions?.EXT_meshopt_compression;
    if (meshopt) {
      const bytes = (meshopt.count ?? 0) * (meshopt.byteStride ?? 0);
      if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > decodedLimit)
        throw new LocalModelError(
          "This compressed model expands beyond the browser’s supported geometry budget.",
        );
      meshoptBytes += bytes;
      if (meshoptBytes > decodedLimit)
        throw new LocalModelError(
          "This compressed model expands beyond the browser’s supported geometry budget.",
        );
    }
  }
  return { meshopt: extensions.has("EXT_meshopt_compression") };
}

function disposeGltf(gltf: GLTF) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  const images = new Set<ImageBitmap>();
  for (const scene of gltf.scenes)
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material)
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material])
          materials.add(material);
      if ((object as THREE.SkinnedMesh).skeleton)
        skeletons.add((object as THREE.SkinnedMesh).skeleton);
    });
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) {
    const source = texture.source?.data;
    for (const image of Array.isArray(source) ? source : [source]) {
      if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap)
        images.add(image);
    }
    texture.dispose();
  }
  for (const image of images) image.close();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}

function prepareAsset(gltf: GLTF, file: File): LocalAsset {
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene, true);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  if (
    bounds.isEmpty() ||
    !Number.isFinite(sphere.radius) ||
    sphere.radius <= 1e-12 ||
    !sphere.center.toArray().every(Number.isFinite)
  ) {
    throw new LocalModelError(
      "This file has no visible model geometry to display.",
    );
  }
  const object = new THREE.Group();
  object.scale.setScalar(1 / sphere.radius);
  object.position.copy(sphere.center).multiplyScalar(-1 / sphere.radius);
  object.add(gltf.scene);
  let meshes = 0;
  let triangles = 0;
  gltf.scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const geometry = mesh.geometry;
    triangles += Math.floor(
      (geometry.index?.count ?? geometry.getAttribute("position")?.count ?? 0) /
        3,
    );
  });
  if (!meshes)
    throw new LocalModelError("This file has no mesh geometry to display.");
  return {
    file,
    gltf,
    object,
    meshes,
    triangles,
    floor: (bounds.min.y - sphere.center.y) / sphere.radius - 0.025,
    copyright:
      typeof gltf.asset.copyright === "string" ? gltf.asset.copyright : "",
  };
}

function useLocalAsset(file: File, retry: number) {
  const [state, setState] = useState<{
    asset: LocalAsset | null;
    file: File;
    retry: number;
    error: string;
  }>({ asset: null, file, retry, error: "" });
  useEffect(() => {
    let active = true;
    let expired = false;
    let loaded: GLTF | null = null;
    const blobUrls = new Set<string>();
    setState({ asset: null, file, retry, error: "" });
    const timer = window.setTimeout(() => {
      expired = true;
      if (active)
        setState({
          asset: null,
          file,
          retry,
          error:
            "This model is taking too long to decode. Try a smaller GLB or export a fresh copy.",
        });
      for (const url of blobUrls) URL.revokeObjectURL(url);
    }, 30000);
    async function parse() {
      if (!/\.glb$/i.test(file.name))
        throw new LocalModelError(
          "Choose a .glb file. Other 3D file formats are not supported here yet.",
        );
      if (file.size > MAX_FILE_BYTES)
        throw new LocalModelError(
          "This model is larger than 50 MB. Export a smaller GLB to open it here.",
        );
      const data = await file.arrayBuffer();
      const options = inspectGlb(data);
      if (!active || expired) return;
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const manager = new THREE.LoadingManager();
      let resourceFailed = false;
      manager.onError = () => {
        resourceFailed = true;
      };
      manager.setURLModifier((url) => {
        if (/^data:/i.test(url)) return url;
        if (url.startsWith(`blob:${window.location.origin}/`)) {
          blobUrls.add(url);
          return url;
        }
        throw new LocalModelError(
          "This model requested an external resource. Use a GLB with all geometry and textures embedded.",
        );
      });
      const loader = new GLTFLoader(manager);
      if (options.meshopt) {
        const decoderModule = await import(
          "three/addons/libs/meshopt_decoder.module.js"
        );
        loader.setMeshoptDecoder(
          (
            decoderModule as unknown as {
              MeshoptDecoder: Parameters<typeof loader.setMeshoptDecoder>[0];
            }
          ).MeshoptDecoder,
        );
      }
      const gltf = await loader.parseAsync(data, "");
      if (!active || expired) {
        disposeGltf(gltf);
        return;
      }
      loaded = gltf;
      if (resourceFailed)
        throw new LocalModelError(
          "An embedded texture could not be read. Export the model with embedded PNG or JPEG textures and try again.",
        );
      const asset = prepareAsset(gltf, file);
      setState({ asset, file, retry, error: "" });
    }
    parse()
      .catch((error) => {
        if (loaded) {
          disposeGltf(loaded);
          loaded = null;
        }
        if (active && !expired)
          setState({
            asset: null,
            file,
            retry,
            error:
              error instanceof LocalModelError
                ? error.message
                : "The model geometry or textures could not be read. Export a fresh self-contained GLB and try again.",
          });
      })
      .finally(() => {
        clearTimeout(timer);
        for (const url of blobUrls) URL.revokeObjectURL(url);
        blobUrls.clear();
      });
    return () => {
      active = false;
      clearTimeout(timer);
      if (loaded) {
        disposeGltf(loaded);
        loaded = null;
      }
      for (const url of blobUrls) URL.revokeObjectURL(url);
      blobUrls.clear();
    };
  }, [file, retry]);
  return state.file === file && state.retry === retry
    ? state
    : { asset: null, file, error: "" };
}

class NativeCanvasBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function LocalScene({
  asset,
  gesture,
  gestureEnabled,
  resetToken,
  playing,
  animationIndex,
  onReady,
  onContextLost,
}: {
  asset: LocalAsset;
  gesture?: GestureState;
  gestureEnabled: boolean;
  resetToken: number;
  playing: boolean;
  animationIndex: number;
  onReady: (actions: NativeActions | null) => void;
  onContextLost: () => void;
}) {
  const { camera, gl, scene, size, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const previousGesture = useRef<GestureState | null>(null);
  const fittedDistance = useRef(0);
  const actions = useRef<NativeActions | null>(null);
  const currentPlaying = useRef(playing);
  currentPlaying.current = playing;
  const fitDistance = useCallback(() => {
    const vertical =
      THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) / 2;
    const horizontal = Math.atan(
      (Math.tan(vertical) * size.width) / Math.max(1, size.height),
    );
    return 1.22 / Math.sin(Math.min(vertical, horizontal));
  }, [camera, size.width, size.height]);
  const currentFit = useRef(fitDistance);
  currentFit.current = fitDistance;

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.12;
    orbit.rotateSpeed = 0.7;
    orbit.zoomSpeed = 0.8;
    orbit.minPolarAngle = 0.05;
    orbit.maxPolarAngle = Math.PI - 0.05;
    const changed = () => invalidate();
    orbit.addEventListener("change", changed);
    controls.current = orbit;
    const update = () => {
      orbit.update();
      invalidate();
    };
    const reset = () => {
      settleOrbit(orbit);
      const distance = currentFit.current();
      fittedDistance.current = distance;
      camera.position.copy(
        new THREE.Vector3(2.6, 1.7, 3.6).normalize().multiplyScalar(distance),
      );
      orbit.target.set(0, 0, 0);
      orbit.minDistance = 0.3;
      orbit.maxDistance = distance * 8;
      camera.lookAt(orbit.target);
      previousGesture.current = null;
      update();
    };
    const zoom = (factor: number) => {
      settleOrbit(orbit);
      const offset = camera.position.clone().sub(orbit.target);
      offset.setLength(
        THREE.MathUtils.clamp(
          offset.length() / factor,
          orbit.minDistance,
          orbit.maxDistance,
        ),
      );
      camera.position.copy(orbit.target).add(offset);
      update();
    };
    const rotate = (angle: number) => {
      settleOrbit(orbit);
      const offset = camera.position
        .clone()
        .sub(orbit.target)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      camera.position.copy(orbit.target).add(offset);
      update();
    };
    actions.current = { zoom, rotate, reset };
    reset();
    onReady(actions.current);
    let mounted = true;
    const contextLost = (event: Event) => {
      if (!mounted) return;
      event.preventDefault();
      onContextLost();
    };
    gl.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      mounted = false;
      onReady(null);
      actions.current = null;
      controls.current = null;
      orbit.removeEventListener("change", changed);
      orbit.dispose();
      gl.domElement.removeEventListener("webglcontextlost", contextLost);
    };
  }, [camera, gl, invalidate, onReady, onContextLost]);

  useEffect(() => {
    const environment = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(environment, 0.04);
    const previous = scene.environment;
    scene.environment = target.texture;
    invalidate();
    return () => {
      scene.environment = previous;
      target.dispose();
      generator.dispose();
      environment.dispose();
    };
  }, [gl, scene, invalidate]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !fittedDistance.current) return;
    settleOrbit(orbit);
    const distance = fitDistance();
    const ratio = distance / fittedDistance.current;
    camera.position.sub(orbit.target).multiplyScalar(ratio).add(orbit.target);
    orbit.maxDistance = distance * 8;
    fittedDistance.current = distance;
    orbit.update();
    invalidate();
  }, [camera, fitDistance, invalidate]);

  useEffect(() => {
    actions.current?.reset();
  }, [resetToken]);
  useEffect(() => {
    const orbit = controls.current;
    if (
      !orbit ||
      !gestureEnabled ||
      !gesture?.active ||
      (gesture.name !== "open-palm" && gesture.name !== "pinch")
    ) {
      previousGesture.current = null;
      return;
    }
    const motion = gestureMotion(previousGesture.current, gesture);
    previousGesture.current = gesture;
    if (!motion.yaw && !motion.pitch && motion.zoomFactor === 1) return;
    settleOrbit(orbit);
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(orbit.target),
    );
    spherical.theta -= motion.yaw;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi - motion.pitch,
      orbit.minPolarAngle,
      orbit.maxPolarAngle,
    );
    spherical.radius = THREE.MathUtils.clamp(
      spherical.radius / motion.zoomFactor,
      orbit.minDistance,
      orbit.maxDistance,
    );
    camera.position
      .copy(orbit.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    orbit.update();
    invalidate();
  }, [camera, gesture, gestureEnabled, invalidate]);

  useEffect(() => {
    const animationMixer = new THREE.AnimationMixer(asset.gltf.scene);
    mixer.current = animationMixer;
    const clip = asset.gltf.animations[animationIndex];
    if (clip) {
      animationMixer.clipAction(clip).reset().play();
      animationMixer.update(0);
    }
    invalidate();
    return () => {
      animationMixer.stopAllAction();
      animationMixer.uncacheRoot(asset.gltf.scene);
      mixer.current = null;
    };
  }, [asset, animationIndex, invalidate]);
  useEffect(() => {
    invalidate();
  }, [playing, invalidate]);
  useFrame((_, delta) => {
    controls.current?.update();
    if (currentPlaying.current && mixer.current) {
      mixer.current.update(Math.min(delta, 0.05));
      invalidate();
    }
  });
  return (
    <>
      <color attach="background" args={["#f4f5ef"]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#ffffff", "#899882", 1.3]} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.1}
        shadow-camera-far={18}
      />
      <directionalLight
        position={[-4, 2, -3]}
        intensity={0.65}
        color="#dfe9d7"
      />
      <primitive object={asset.object} dispose={null} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, asset.floor, 0]}
        receiveShadow
      >
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.12} transparent depthWrite={false} />
      </mesh>
    </>
  );
}

export function NativeModelViewer({
  file,
  onClose,
  gesture,
  gestureEnabled,
  resetToken,
  source,
}: NativeModelViewerProps) {
  const [retry, setRetry] = useState(0);
  const { asset, error } = useLocalAsset(file, retry);
  const [playing, setPlaying] = useState(false);
  const [animationIndex, setAnimationIndex] = useState(0);
  const [rendererError, setRendererError] = useState(false);
  const [ready, setReady] = useState(false);
  const actionRef = useRef<NativeActions | null>(null);
  const currentAsset = useRef(asset);
  currentAsset.current = asset;
  const currentGeneration = useRef(retry);
  currentGeneration.current = retry;
  const onReady = useCallback(
    (actions: NativeActions | null) => {
      if (currentAsset.current !== asset) return;
      actionRef.current = actions;
      setReady(!!actions);
    },
    [asset],
  );
  const onContextLost = useCallback(() => {
    if (currentGeneration.current !== retry) return;
    setRendererError(true);
    setReady(false);
  }, [retry]);
  useEffect(() => {
    if (!asset) {
      actionRef.current = null;
      setReady(false);
    }
  }, [asset]);
  useEffect(() => {
    setPlaying(false);
    const idleIndex =
      asset?.gltf.animations.findIndex((clip) =>
        /^idle(?:\b|_)/i.test(clip.name.trim()),
      ) ?? -1;
    setAnimationIndex(Math.max(0, idleIndex));
  }, [asset]);
  useEffect(() => {
    setPlaying(false);
    setAnimationIndex(0);
    setRendererError(false);
    setReady(false);
  }, [file]);
  const title =
    source?.title || file.name.replace(/\.glb$/i, "").replace(/[_-]+/g, " ");
  const failure =
    error ||
    (rendererError
      ? "The 3D renderer is unavailable. Enable hardware acceleration in your browser, then try again."
      : "");
  const state = failure ? "error" : asset && ready ? "ready" : "loading";
  return (
    <section
      className="native-model-viewer"
      data-native-state={state}
      aria-label={`${title} ${source ? "interactive" : "local"} 3D model`}
    >
      <header className="native-model-heading">
        <div>
          <span>{source ? "VISION 3D STUDIO" : "YOUR 3D MODEL"}</span>
          <h3 title={title}>{title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close local model">
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className="native-model-stage">
        {!rendererError && (
          <NativeCanvasBoundary key={retry} onError={onContextLost}>
            <Canvas
              shadows
              dpr={[1, 1.6]}
              frameloop="demand"
              camera={{ fov: 40, near: 0.01, far: 2000, position: [3, 2, 4] }}
              gl={{ antialias: true, alpha: false }}
              fallback={
                <p>
                  This browser cannot display the 3D canvas. Try a browser with
                  WebGL support.
                </p>
              }
            >
              <Suspense fallback={null}>
                {asset && (
                  <LocalScene
                    key={asset.gltf.scene.uuid}
                    asset={asset}
                    gesture={gesture}
                    gestureEnabled={gestureEnabled}
                    resetToken={resetToken}
                    playing={playing}
                    animationIndex={animationIndex}
                    onReady={onReady}
                    onContextLost={onContextLost}
                  />
                )}
              </Suspense>
            </Canvas>
          </NativeCanvasBoundary>
        )}
        {state === "loading" && (
          <div className="native-model-message" role="status">
            <span className="native-loading-ring" />
            <strong>Opening {source ? "the model" : "your model"}</strong>
            <p>
              {source
                ? `Preparing ${source.title}.`
                : `Reading ${file.name} in this browser.`}
            </p>
          </div>
        )}
        {failure && (
          <div
            className="native-model-message native-model-message--error"
            role="alert"
          >
            <strong>We couldn’t open this model</strong>
            <p>{failure}</p>
            <button
              type="button"
              onClick={() => {
                setRendererError(false);
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}
        {state === "ready" && (
          <span className="native-model-hint">
            Drag to orbit · Scroll or pinch to zoom
          </span>
        )}
      </div>
      <div
        className="native-model-toolbar"
        role="group"
        aria-label="Local model controls"
      >
        <div className="native-model-camera-controls">
          <button
            type="button"
            disabled={!ready || !!failure}
            aria-label="Rotate local model left"
            title="Rotate left"
            onClick={() => actionRef.current?.rotate(Math.PI / 12)}
          >
            <Icon name="rotate-left" size={17} />
          </button>
          <button
            type="button"
            disabled={!ready || !!failure}
            aria-label="Rotate local model right"
            title="Rotate right"
            onClick={() => actionRef.current?.rotate(-Math.PI / 12)}
          >
            <Icon name="rotate-right" size={17} />
          </button>
          <span className="native-toolbar-divider" />
          <button
            type="button"
            disabled={!ready || !!failure}
            aria-label="Zoom out local model"
            title="Zoom out"
            onClick={() => actionRef.current?.zoom(1 / 1.2)}
          >
            <Icon name="minus" size={17} />
          </button>
          <button
            type="button"
            disabled={!ready || !!failure}
            aria-label="Zoom in local model"
            title="Zoom in"
            onClick={() => actionRef.current?.zoom(1.2)}
          >
            <Icon name="plus" size={17} />
          </button>
          <button
            type="button"
            disabled={!ready || !!failure}
            aria-label="Reset local model view"
            title="Reset view"
            onClick={() => actionRef.current?.reset()}
          >
            <Icon name="reset" size={16} />
            <span>Reset</span>
          </button>
        </div>
        {!!asset?.gltf.animations.length && (
          <div className="native-model-animation-controls">
            {asset.gltf.animations.length > 1 && (
              <select
                aria-label="Model animation"
                value={animationIndex}
                onChange={(event) =>
                  setAnimationIndex(Number(event.target.value))
                }
              >
                {asset.gltf.animations.map((clip, index) => (
                  <option key={clip.uuid} value={index}>
                    {clip.name || `Animation ${index + 1}`}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={!ready || !!failure}
              aria-label={
                playing
                  ? "Pause local model animation"
                  : "Play local model animation"
              }
              aria-pressed={playing}
              onClick={() => setPlaying((value) => !value)}
            >
              <Icon name={playing ? "pause" : "play"} size={15} />
              <span>{playing ? "Pause" : "Play animation"}</span>
            </button>
          </div>
        )}
      </div>
      <details className="native-model-details">
        <summary>
          <Icon name="info" size={14} />
          Model details
          <Icon name="chevron-down" size={13} />
        </summary>
        <div>
          <dl>
            {source && (
              <>
                <div>
                  <dt>Creator</dt>
                  <dd>
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                      {source.author}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Original source</dt>
                  <dd>
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                      View original model
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>License</dt>
                  <dd>
                    <a
                      href={source.licenseUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.license}
                    </a>
                  </dd>
                </div>
              </>
            )}
            <div>
              <dt>{source ? "Model file" : "Local file"}</dt>
              <dd>{file.name}</dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>{(file.size / (1024 * 1024)).toFixed(2)} MB</dd>
            </div>
            {asset && (
              <>
                <div>
                  <dt>Geometry</dt>
                  <dd>
                    {asset.meshes.toLocaleString()} meshes ·{" "}
                    {asset.triangles.toLocaleString()} triangles
                  </dd>
                </div>
                <div>
                  <dt>Animations</dt>
                  <dd>{asset.gltf.animations.length}</dd>
                </div>
              </>
            )}
            {asset?.copyright && (
              <div>
                <dt>Source copyright</dt>
                <dd>{asset.copyright}</dd>
              </div>
            )}
          </dl>
          <p>
            {source
              ? "Part of the Vision model library. Original model credits and licence are listed above."
              : "Opened in this browser. Your file is not uploaded. Ownership and license terms remain with the model’s source."}
          </p>
        </div>
      </details>
    </section>
  );
}

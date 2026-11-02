export interface NativeCatalogEntry {
  id: string;
  title: string;
  description: string;
  file: string;
  preview: string;
  size: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
}

export const nativeCatalog: NativeCatalogEntry[] = [
  {
    id: "robot",
    title: "Expressive robot",
    description: "Explore movement, pose and character animation.",
    file: "/models/robot/robot.glb",
    preview: "/models/robot/preview.png",
    size: "453 KB · 14 animations",
    author: "Tomás Laulhé · adapted by Don McCurdy",
    sourceUrl:
      "https://github.com/mrdoob/three.js/tree/r171/examples/models/gltf/RobotExpressive",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  {
    id: "toy-car",
    title: "Toy car — materials study",
    description: "A closer look at glass, painted metal and fabric.",
    file: "/models/toy-car/toy-car.glb",
    preview: "/models/toy-car/preview.png",
    size: "5.2 MB · Detailed materials",
    author: "Guido Odendahl · Eric Chadwick",
    sourceUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/ToyCar",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
];

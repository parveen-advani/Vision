# Native model credits

Vision includes these models as self-hosted examples. Their original creators retain credit; inclusion does not imply that Vision created the models or that the creators endorse Vision. Both models are distributed under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/legalcode), as documented by their upstream publishers below. They do not require a Sketchfab account or paid viewer.

Source and license records were checked on **2026-11-02**. The SHA-256 values identify the exact GLB files included in this project. The model binaries are unmodified; framing, lighting, playback, and presentation controls are provided at runtime by Vision. Any bundled preview images are renders of these CC0 models made for this library.

## Animated robot

- Local file: `robot/robot.glb`
- Original model: **RobotExpressive**, by [Tomás Laulhé / Quaternius](https://www.patreon.com/quaternius).
- Upstream modifications: [Don McCurdy](https://donmccurdy.com/) added facial-expression morph targets, converted the model with FBX2GLTF, removed duplicate materials, and adjusted metalness.
- License authority: the [RobotExpressive README in Three.js release r171](https://github.com/mrdoob/three.js/blob/r171/examples/models/gltf/RobotExpressive/README.md) explicitly identifies the model as **CC0 1.0**. A copy of that source notice is retained in [`robot/SOURCE.md`](robot/SOURCE.md).
- Exact download source: [RobotExpressive.glb, Three.js r171](https://raw.githubusercontent.com/mrdoob/three.js/r171/examples/models/gltf/RobotExpressive/RobotExpressive.glb).
- File size: **463,988 bytes**.
- SHA-256: `047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319`.
- The original GLB has no `asset.copyright` field; the attribution above preserves the upstream creator and modification credits.

## Toy car

- Local file: `toy-car/toy-car.glb`
- Original model: **Toy Car**, initial car model by **Guido Odendahl**; extensions and scene composition by **Eric Chadwick** (2020).
- Publisher: [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/ToyCar).
- License authority: the [model README](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/ToyCar/README.md), [metadata](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/ToyCar/metadata.json), and [per-model LICENSE.md](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/ToyCar/LICENSE.md) identify the model and associated image/binary files as **CC0-1.0**. The upstream metadata and license documentation themselves use CC BY 4.0; these links preserve their attribution to the Khronos repository.
- Exact download source used: [ToyCar.glb, Khronos glTF Sample Assets revision 8f492390ddc7a2ae221a1369ef560589cf8c70fb](https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/ToyCar/glTF-Binary/ToyCar.glb), retrieved on 2026-11-02. Its SHA-256 was checked against the bundled file.
- File size: **5,422,412 bytes**.
- SHA-256: `01a60862de55cd4b9f3acfab0b0def86451800f9c42467fcd61052c16cb9838c`.
- Retained embedded `asset.copyright`: “Public domain (CC0). Toy car model created by Guido Odendahl. Materials edited by Eric Chadwick.”

The Toy Car is a static product/material example, not an engine simulation. The robot's animations and the car's materials are supplied by their source assets. No Sketchfab viewer content was extracted to create this library.

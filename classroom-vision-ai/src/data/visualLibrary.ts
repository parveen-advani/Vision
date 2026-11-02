import type { VisualEntry, VisualId } from "../types";

export const visualLibrary: VisualEntry[] = [
  {
    id: "heart",
    title: "Human Heart 3D Model",
    shortTitle: "Heart",
    category: "biology",
    subtitle: "A classroom-safe animated model for blood-flow explanation.",
    keywords: [
      "heart",
      "human heart",
      "cardiac",
      "blood",
      "blood flow",
      "circulation",
      "atrium",
      "ventricle",
      "biology",
      "dil",
    ],
    explanation:
      "The heart model highlights chambers, arteries, and circulation direction. Use an open palm to rotate it, pinch to zoom, and say reset to restore the view.",
    teacherPrompts: [
      "Show the human heart",
      "Zoom into the heart",
      "Explode the heart model",
      "Reset the view",
    ],
  },
  {
    id: "osi",
    title: "OSI Model Layer Stack",
    shortTitle: "OSI Model",
    category: "computer-science",
    subtitle:
      "Seven-layer networking architecture rendered as an interactive stack.",
    keywords: [
      "osi",
      "osi model",
      "network",
      "networking",
      "layers",
      "seven layers",
      "application layer",
      "transport layer",
      "data link",
    ],
    layers: [
      "Application",
      "Presentation",
      "Session",
      "Transport",
      "Network",
      "Data Link",
      "Physical",
    ],
    explanation:
      "The OSI model separates network communication into seven layers. The top layers work closer to software and the bottom layers work closer to signals and hardware.",
    teacherPrompts: [
      "Show OSI model",
      "Rotate right",
      "Explode the layers",
      "Next model",
    ],
  },
  {
    id: "dna",
    title: "DNA Double Helix",
    shortTitle: "DNA",
    category: "biology",
    subtitle:
      "A rotating helix with base-pair bridges for biology explanations.",
    keywords: [
      "dna",
      "double helix",
      "genetics",
      "gene",
      "chromosome",
      "base pair",
      "nucleotide",
    ],
    explanation:
      "DNA stores genetic instructions. The model shows two strands wrapped around each other with bridge-like base pairs connecting them.",
    teacherPrompts: [
      "Show DNA double helix",
      "Rotate left",
      "Zoom in",
      "Pause rotation",
    ],
  },
  {
    id: "solar",
    title: "Solar System Orbit Map",
    shortTitle: "Solar System",
    category: "physics",
    subtitle: "A simplified orbit demonstration for space and motion lessons.",
    keywords: [
      "solar system",
      "sun",
      "planet",
      "orbit",
      "space",
      "earth",
      "mars",
      "astronomy",
    ],
    explanation:
      "The model uses orbit rings and animated planets to explain relative distance, revolution, and orbital motion.",
    teacherPrompts: [
      "Show solar system",
      "Pause rotation",
      "Zoom out",
      "Resume rotation",
    ],
  },
  {
    id: "atom",
    title: "Atomic Structure Model",
    shortTitle: "Atom",
    category: "physics",
    subtitle: "Nucleus, shells, and electrons visualized in 3D.",
    keywords: [
      "atom",
      "atomic",
      "electron",
      "proton",
      "neutron",
      "nucleus",
      "shell",
      "chemistry",
    ],
    explanation:
      "The atom model shows a central nucleus and moving electrons. It is designed for conceptual teaching rather than exact quantum scale.",
    teacherPrompts: ["Show atom", "Explode atom", "Rotate up", "Reset"],
  },
  {
    id: "cell",
    title: "Plant Cell Diagram",
    shortTitle: "Plant Cell",
    category: "biology",
    subtitle:
      "Cell wall, nucleus, vacuole, and organelles arranged for projector teaching.",
    keywords: [
      "cell",
      "plant cell",
      "nucleus",
      "vacuole",
      "chloroplast",
      "cell wall",
      "biology cell",
    ],
    explanation:
      "This diagram-like 3D view separates major plant-cell parts so students can understand their relative location and function.",
    teacherPrompts: [
      "Show plant cell",
      "Explode cell",
      "Zoom in",
      "Previous model",
    ],
  },
  {
    id: "neural",
    title: "Neural Network Concept Map",
    shortTitle: "Neural Network",
    category: "computer-science",
    subtitle: "Nodes and weighted connections for AI/ML introductions.",
    keywords: [
      "ai",
      "artificial intelligence",
      "neural network",
      "machine learning",
      "deep learning",
      "nodes",
    ],
    explanation:
      "The model visualizes input, hidden, and output layers. Animated pulses show how information flows through connected neurons.",
    teacherPrompts: [
      "Show neural network",
      "Explain AI",
      "Rotate right",
      "Projector mode",
    ],
  },
  {
    id: "waterCycle",
    title: "Water Cycle Process Diagram",
    shortTitle: "Water Cycle",
    category: "earth-science",
    subtitle:
      "Evaporation, condensation, precipitation, and collection in one animated scene.",
    keywords: [
      "water cycle",
      "evaporation",
      "condensation",
      "precipitation",
      "rain",
      "cloud",
      "geography",
    ],
    explanation:
      "The scene connects ocean, clouds, mountains, and rain arrows to explain how water moves through Earth systems.",
    teacherPrompts: [
      "Show water cycle",
      "Explode process",
      "Zoom out",
      "Reset view",
    ],
  },
];

export const getVisualById = (id: VisualId): VisualEntry => {
  const visual = visualLibrary.find((item) => item.id === id);
  if (!visual) {
    return visualLibrary[0];
  }
  return visual;
};

export const getNextVisual = (id: VisualId): VisualEntry => {
  const index = visualLibrary.findIndex((item) => item.id === id);
  return visualLibrary[(index + 1) % visualLibrary.length];
};

export const getPreviousVisual = (id: VisualId): VisualEntry => {
  const index = visualLibrary.findIndex((item) => item.id === id);
  return visualLibrary[
    (index - 1 + visualLibrary.length) % visualLibrary.length
  ];
};

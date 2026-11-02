const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");

function hand(shape = "open-palm") {
  const coordinates = [
    [0.5, 0.85],
    [0.4, 0.76],
    [0.3, 0.65],
    [0.24, 0.54],
    [0.18, 0.43],
    [0.4, 0.6],
    [0.38, 0.43],
    [0.37, 0.31],
    [0.36, 0.22],
    [0.5, 0.57],
    [0.5, 0.39],
    [0.5, 0.27],
    [0.5, 0.17],
    [0.6, 0.6],
    [0.61, 0.43],
    [0.62, 0.32],
    [0.63, 0.24],
    [0.68, 0.65],
    [0.72, 0.52],
    [0.74, 0.43],
    [0.76, 0.35],
  ];
  const landmarks = coordinates.map(([x, y]) => ({ x, y, z: 0 }));
  const fold = (mcp) => {
    const { x, y } = landmarks[mcp];
    landmarks[mcp + 1] = { x, y: y - 0.13, z: 0 };
    landmarks[mcp + 2] = { x: x + 0.01, y: y + 0.02, z: 0 };
    landmarks[mcp + 3] = { x: x + 0.02, y: y + 0.08, z: 0 };
  };
  if (shape === "fist" || shape === "thumbs-up" || shape === "point") {
    [5, 9, 13, 17]
      .filter((mcp) => shape !== "point" || mcp !== 5)
      .forEach(fold);
    landmarks[2] = { x: 0.35, y: 0.73, z: 0 };
    landmarks[3] = { x: 0.4, y: 0.67, z: 0 };
    landmarks[4] = { x: 0.43, y: 0.66, z: 0 };
  }
  if (shape === "thumbs-up") {
    landmarks[2] = { x: 0.3, y: 0.68, z: 0 };
    landmarks[3] = { x: 0.3, y: 0.48, z: 0 };
    landmarks[4] = { x: 0.3, y: 0.28, z: 0 };
  }
  if (shape === "pinch") {
    landmarks[4] = { x: 0.31, y: 0.42, z: 0 };
    landmarks[8] = { x: 0.32, y: 0.42, z: 0 };
  }
  return landmarks;
}

function transformed(points, scale = 1, angle = 0, mirror = false) {
  return points.map((point) => {
    const x = (point.x - 0.5) * scale * (mirror ? -1 : 1);
    const y = (point.y - 0.5) * scale;
    return {
      x: 0.5 + x * Math.cos(angle) - y * Math.sin(angle),
      y: 0.5 + x * Math.sin(angle) + y * Math.cos(angle),
      z: (point.z ?? 0) * scale,
    };
  });
}

(async () => {
  const bundle = await esbuild.build({
    entryPoints: [path.join(__dirname, "../src/utils/gesture.ts")],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
  });
  const compiled = new Module(
    path.join(__dirname, "gesture-in-memory.cjs"),
    module,
  );
  compiled.filename = path.join(__dirname, "gesture-in-memory.cjs");
  compiled.paths = module.paths;
  compiled._compile(bundle.outputFiles[0].text, compiled.filename);
  const { classifyHandGesture, createGestureEventTracker } = compiled.exports;
  const motionBundle = await esbuild.build({
    entryPoints: [path.join(__dirname, "../src/utils/handMotion.ts")],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
  });
  const motionModule = new Module(
    path.join(__dirname, "motion-in-memory.cjs"),
    module,
  );
  motionModule.filename = path.join(__dirname, "motion-in-memory.cjs");
  motionModule.paths = module.paths;
  motionModule._compile(
    motionBundle.outputFiles[0].text,
    motionModule.filename,
  );
  const { gestureMotion } = motionModule.exports;
  const checks = [];
  const check = (name, test) => {
    test();
    checks.push(name);
    console.log("PASS:", name);
  };
  const state = (name, x = 0.5, y = 0.5, active = true) => ({
    name,
    x,
    y,
    active,
    z: 0,
    confidence: 0.9,
    pinchDistance: 0.1,
    message: "",
    timestamp: 0,
  });

  check(
    "Canonical open palm, point, pinch, fist and thumbs-up are distinct",
    () => {
      for (const name of ["open-palm", "point", "pinch", "fist", "thumbs-up"])
        assert.equal(classifyHandGesture(hand(name)).name, name);
      assert.ok(
        classifyHandGesture(hand("fist")).pinchDistance < 0.055,
        "Fixture reproduces the old false-pinch condition.",
      );
    },
  );
  check(
    "Classification remains stable across hand scales and left/right mirroring",
    () => {
      for (const name of ["open-palm", "point", "pinch", "fist", "thumbs-up"]) {
        for (const scale of [0.45, 0.8, 1.5]) {
          for (const mirror of [false, true])
            assert.equal(
              classifyHandGesture(
                transformed(hand(name), scale, 0, mirror),
                mirror ? "Left" : "Right",
              ).name,
              name,
            );
        }
      }
    },
  );
  check(
    "Finger extension works when palm is rotated; thumb approval still requires upright thumb",
    () => {
      for (const name of ["open-palm", "point", "pinch", "fist"])
        assert.equal(
          classifyHandGesture(transformed(hand(name), 1, Math.PI / 2)).name,
          name,
        );
      assert.notEqual(
        classifyHandGesture(transformed(hand("thumbs-up"), 1, Math.PI / 2))
          .name,
        "thumbs-up",
      );
    },
  );
  check(
    "Invalid, missing, or degenerate landmarks cannot generate active movement",
    () => {
      assert.equal(classifyHandGesture([]).active, false);
      assert.equal(
        classifyHandGesture(
          Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 })),
        ).active,
        false,
      );
      const invalid = hand();
      invalid[8].x = NaN;
      assert.equal(classifyHandGesture(invalid).active, false);
    },
  );
  check("A held fist resets once, after a short deliberate hold", () => {
    const tracker = createGestureEventTracker();
    const events = [];
    for (let time = 0; time <= 2400; time += 50) {
      const event = tracker.update(state("fist"), time);
      if (event) events.push(event);
    }
    assert.equal(events.length, 1);
    assert.equal(events[0].name, "fist");
    assert.equal(events[0].timestamp, 300);
  });
  check(
    "Thumbs-up approval requires 650ms and stays latched through brief tracking flicker",
    () => {
      const tracker = createGestureEventTracker();
      const events = [];
      for (let time = 0; time <= 2000; time += 50) {
        const event = tracker.update(state("thumbs-up"), time);
        if (event) events.push(event);
      }
      assert.equal(events.length, 1);
      assert.equal(events[0].timestamp, 650);
      tracker.update(state("idle", 0.5, 0.5, false), 2100);
      for (let time = 2200; time <= 3000; time += 50)
        assert.equal(tracker.update(state("thumbs-up"), time), null);
      for (let time = 3100; time <= 3300; time += 100)
        tracker.update(state("idle", 0.5, 0.5, false), time);
      for (let time = 3400; time <= 4200; time += 50) {
        const event = tracker.update(state("thumbs-up"), time);
        if (event) events.push(event);
      }
      assert.equal(events.length, 2);
      assert.equal(events[1].timestamp, 4050);
    },
  );
  check("A stalled frame cannot count as a continuous approval hold", () => {
    const tracker = createGestureEventTracker();
    tracker.update(state("thumbs-up"), 0);
    tracker.update(state("thumbs-up"), 100);
    assert.equal(tracker.update(state("thumbs-up"), 1000), null);
    for (let time = 1050; time < 1650; time += 50)
      assert.equal(tracker.update(state("thumbs-up"), time), null);
    assert.equal(tracker.update(state("thumbs-up"), 1650)?.name, "thumbs-up");
  });
  check(
    "Open-palm swipe uses a motion window and retains mirrored left/right directions",
    () => {
      for (const direction of [-1, 1]) {
        const tracker = createGestureEventTracker();
        const events = [];
        for (let index = 0; index < 7; index++) {
          const event = tracker.update(
            state("open-palm", 0.5 + index * 0.05 * direction),
            index * 60,
          );
          if (event) events.push(event);
        }
        assert.equal(events.length, 1);
        assert.equal(
          events[0].name,
          direction < 0 ? "swipe-right" : "swipe-left",
        );
      }
    },
  );
  check(
    "Slow rotation, vertical motion, pointed movement, and tracking jumps are not swipes",
    () => {
      for (const mode of ["slow", "vertical", "point"]) {
        const tracker = createGestureEventTracker();
        for (let index = 0; index < 10; index++) {
          const gesture =
            mode === "vertical"
              ? state("open-palm", 0.5, 0.1 + index * 0.05)
              : state(
                  mode === "point" ? "point" : "open-palm",
                  0.1 + index * 0.04,
                );
          assert.equal(tracker.update(gesture, index * 100), null, mode);
        }
      }
      const tracker = createGestureEventTracker();
      tracker.update(state("open-palm", 0.8), 0);
      tracker.update(state("open-palm", 0.79), 100);
      assert.equal(tracker.update(state("open-palm", 0.3), 200), null);
    },
  );
  check("Losing a hand or resetting clears accumulated swipe motion", () => {
    const tracker = createGestureEventTracker();
    tracker.update(state("open-palm", 0.8), 0);
    tracker.update(state("open-palm", 0.7), 80);
    tracker.update(state("idle", 0.5, 0.5, false), 160);
    assert.equal(tracker.update(state("open-palm", 0.6), 240), null);
    assert.equal(tracker.update(state("open-palm", 0.55), 300), null);
    tracker.reset();
    assert.equal(tracker.update(state("open-palm", 0.3), 400), null);
  });
  const motionState = (name, x, y, timestamp, active = true) => ({
    ...state(name, x, y, active),
    timestamp,
  });
  const still = { yaw: 0, pitch: 0, zoomFactor: 1 };
  check(
    "Relative model control ignores acquisition, release, gesture changes, and stale frames",
    () => {
      const current = motionState("open-palm", 0.6, 0.6, 150);
      assert.deepEqual(gestureMotion(null, current), still);
      assert.deepEqual(
        gestureMotion(motionState("open-palm", 0.5, 0.5, 100, false), current),
        still,
      );
      assert.deepEqual(
        gestureMotion(motionState("pinch", 0.5, 0.5, 100), current),
        still,
      );
      assert.deepEqual(
        gestureMotion(motionState("open-palm", 0.5, 0.5, 100), {
          ...current,
          active: false,
        }),
        still,
      );
      assert.deepEqual(
        gestureMotion(motionState("open-palm", 0.5, 0.5, 100), {
          ...current,
          timestamp: 400,
        }),
        still,
      );
      assert.deepEqual(
        gestureMotion(motionState("open-palm", 0.5, 0.5, 150), current),
        still,
      );
    },
  );
  check(
    "Relative motion rejects teleports/nonfinite values and small hand jitter",
    () => {
      const previous = motionState("open-palm", 0.5, 0.5, 100);
      assert.deepEqual(
        gestureMotion(previous, motionState("open-palm", 0.8, 0.5, 133)),
        still,
      );
      assert.deepEqual(
        gestureMotion(previous, motionState("open-palm", 0.5, 0.8, 133)),
        still,
      );
      assert.deepEqual(
        gestureMotion(previous, motionState("open-palm", NaN, 0.5, 133)),
        still,
      );
      assert.deepEqual(
        gestureMotion(previous, motionState("open-palm", 0.501, 0.501, 133)),
        still,
      );
    },
  );
  check(
    "Open-palm rotation follows the mirrored preview and clamps movement",
    () => {
      const previous = motionState("open-palm", 0.5, 0.5, 100);
      const moved = gestureMotion(
        previous,
        motionState("open-palm", 0.45, 0.55, 133),
      );
      assert.ok(Math.abs(moved.yaw - 0.2) < 1e-9);
      assert.ok(Math.abs(moved.pitch - 0.15) < 1e-9);
      assert.equal(moved.zoomFactor, 1);
      assert.deepEqual(
        gestureMotion(previous, motionState("open-palm", 0.35, 0.65, 133)),
        { yaw: 0.35, pitch: 0.25, zoomFactor: 1 },
      );
    },
  );
  check(
    "Pinch upward zooms in, downward zooms out, while pointing does not move the model",
    () => {
      const previous = motionState("pinch", 0.5, 0.5, 100);
      const upward = gestureMotion(
        previous,
        motionState("pinch", 0.5, 0.46, 133),
      );
      const downward = gestureMotion(
        previous,
        motionState("pinch", 0.5, 0.54, 133),
      );
      assert.ok(upward.zoomFactor > 1);
      assert.ok(downward.zoomFactor < 1);
      assert.equal(upward.yaw, 0);
      assert.equal(upward.pitch, 0);
      assert.deepEqual(
        gestureMotion(
          motionState("point", 0.5, 0.5, 100),
          motionState("point", 0.4, 0.6, 133),
        ),
        still,
      );
    },
  );
  console.log(
    `\n${checks.length} deterministic gesture checks passed. Synthetic landmarks only; this is not a camera accuracy benchmark.`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

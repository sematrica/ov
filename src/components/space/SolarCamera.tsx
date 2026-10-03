"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import type { SolarCamera as CameraState } from "@/lib/explorer/catalog";
import type { ObjectId, TrajectoryDataset } from "@/models/trajectory";
import { interpolatePosition, toScene } from "@/lib/astronomy/interpolate";
export function SolarCamera({
  data,
  time,
  selected,
  state,
  view,
}: {
  data: TrajectoryDataset;
  time: number;
  selected: ObjectId;
  state: CameraState;
  view: number;
}) {
  const controls = useRef<Controls>(null);
  const previous = useRef("");
  const remaining = useRef(0);
  const target = useRef(new Vector3());
  const position = useRef(new Vector3());
  useFrame(({ camera, size }, delta) => {
    const c = controls.current;
    if (!c) return;
    const trajectory = data.objects.find((o) => o.id === selected);
    const current = trajectory
      ? new Vector3(...toScene(interpolatePosition(trajectory.points, time)))
      : new Vector3();
    const signature = `${state.mode}:${state.revision}:${view}:${selected}:${!!trajectory}`;
    if (signature !== previous.current) {
      previous.current = signature;
      remaining.current = 2;
      target.current.copy(
        state.mode === "focus" ||
          state.mode === "follow" ||
          state.mode === "context"
          ? current
          : new Vector3(),
      );
      let distance =
        state.mode === "interstellar"
          ? Math.max(
              33,
              ...data.objects.map(
                (o) =>
                  new Vector3(
                    ...toScene(interpolatePosition(o.points, time)),
                  ).length() * 3,
              ),
            )
          : state.mode === "overview"
            ? 33
            : state.mode === "inner"
              ? 4.5
              : selected.startsWith("spacecraft:")
                ? 5
                : selected === "sun"
                  ? 1.5
                  : 0.35;
      if (state.mode === "context") {
        const earth = data.objects.find((o) => o.id === "earth");
        if (earth) {
          const e = new Vector3(
            ...toScene(interpolatePosition(earth.points, time)),
          );
          distance = Math.max(0.15, current.distanceTo(e) * 3);
          target.current.copy(current).add(e).multiplyScalar(0.5);
        }
      }
      if (size.width < size.height) distance *= 1.6;
      position.current
        .copy(target.current)
        .add(
          view % 2
            ? new Vector3(0, distance, 0.001)
            : new Vector3(0, distance * 0.6, distance),
        );
    }
    if (remaining.current > 0) {
      const a = 1 - Math.exp(-4 * delta);
      camera.position.lerp(position.current, a);
      c.target.lerp(target.current, a);
      remaining.current -= delta;
    } else if (state.mode === "follow") {
      const shift = current
        .sub(c.target)
        .multiplyScalar(1 - Math.exp(-5 * delta));
      camera.position.add(shift);
      c.target.add(shift);
    }
    c.update();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      minDistance={0.0002}
      maxDistance={5000}
      onStart={() => {
        remaining.current = 0;
      }}
    />
  );
}

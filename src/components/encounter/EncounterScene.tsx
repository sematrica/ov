"use client";
import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { Vector3, type Mesh, type PerspectiveCamera } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import type { EncounterDataset } from "@/models/encounter";
import {
  earthRelativeTrajectory,
  encounterScenePosition,
  interpolateState,
} from "@/lib/astronomy/encounter";
import { DEFAULT_LAYERS, type Layers } from "@/lib/explorer/catalog";
export type EncounterCamera = {
  mode: "earth" | "asteroid" | "follow" | "overview";
  revision: number;
};
export interface EncounterOptions {
  distanceLine: boolean;
  asteroidTrail: boolean;
  moonTrail: boolean;
  camera: EncounterCamera;
}
export function EncounterScene({
  data,
  time,
  options,
  onSeek,
  layers = DEFAULT_LAYERS,
  labelElements,
}: {
  data: EncounterDataset;
  time: number;
  options: EncounterOptions;
  onSeek: (time: number) => void;
  layers?: Layers;
  labelElements: RefObject<Record<string, HTMLDivElement | null>>;
}) {
  const paths = useMemo(
    () => ({
      asteroid: earthRelativeTrajectory(
        data.asteroid.points,
        data.earth.points,
      ),
      moon: data.moon
        ? earthRelativeTrajectory(data.moon.points, data.earth.points)
        : undefined,
    }),
    [data],
  );
  const asteroid = encounterScenePosition(
    interpolateState(paths.asteroid, time),
  );
  const moon = paths.moon
    ? encounterScenePosition(interpolateState(paths.moon, time))
    : undefined;
  const marker = encounterScenePosition(
    interpolateState(paths.asteroid, data.approach.time),
  );
  const extent = useMemo(
    () =>
      Math.max(
        1.2,
        ...paths.asteroid.map((p) =>
          new Vector3(...encounterScenePosition(p)).length(),
        ),
        ...(paths.moon ?? []).map((p) =>
          new Vector3(...encounterScenePosition(p)).length(),
        ),
      ),
    [paths],
  );
  const split = paths.asteroid.findIndex((p) => p.time > time);
  const past = paths.asteroid
    .slice(0, split < 0 ? undefined : split)
    .map(encounterScenePosition);
  past.push(asteroid);
  const future = [
    asteroid,
    ...(split < 0
      ? []
      : paths.asteroid.slice(split).map(encounterScenePosition)),
  ];
  return (
    <>
      <directionalLight position={[3, 5, 3]} intensity={2} />
      <EncounterBody
        position={[0, 0, 0]}
        radius={0.09}
        pixels={12}
        color="#71b8df"
      />

      {moon && layers.moon && (
        <>
          <EncounterBody
            position={moon}
            radius={0.035}
            pixels={5}
            color="#c9cbd0"
          />
        </>
      )}
      {layers.asteroids && (
        <EncounterBody
          position={asteroid}
          radius={0.025}
          pixels={4}
          color="#efb977"
        />
      )}

      {options.asteroidTrail &&
        layers.asteroidTrajectories &&
        layers.asteroids && (
          <>
            {past.length > 1 && (
              <Line points={past} color="#efb977" transparent opacity={0.8} />
            )}{" "}
            {future.length > 1 && (
              <Line
                points={future}
                color="#efb977"
                transparent
                opacity={0.25}
              />
            )}
          </>
        )}
      {options.moonTrail && layers.moon && paths.moon && (
        <Line
          points={paths.moon.map(encounterScenePosition)}
          color="#b8c7d5"
          transparent
          opacity={0.25}
        />
      )}
      {options.distanceLine && layers.distanceLines && layers.asteroids && (
        <Line
          points={[[0, 0, 0], asteroid]}
          color="#91a8b4"
          transparent
          opacity={0.4}
        />
      )}
      <mesh
        position={marker}
        onClick={(e) => {
          e.stopPropagation();
          onSeek(data.approach.time);
        }}
      >
        <octahedronGeometry args={[0.05]} />
        <meshBasicMaterial color="#fff3cf" wireframe />
      </mesh>

      <EncounterProjection
        points={[
          { id: "earth", position: [0, 0, 0] },
          ...(moon ? [{ id: "moon", position: moon }] : []),
          { id: "asteroid", position: asteroid },
          { id: "closest", position: marker },
        ]}
        elements={labelElements}
      />
      <EncounterCameraController
        target={asteroid}
        extent={extent}
        cameraMode={options.camera}
      />
    </>
  );
}
function EncounterCameraController({
  target,
  extent,
  cameraMode,
}: {
  target: [number, number, number];
  extent: number;
  cameraMode: EncounterCamera;
}) {
  const controls = useRef<Controls>(null);
  const previous = useRef<EncounterCamera | null>(null);
  const settling = useRef(0);
  const goal = useRef(new Vector3());
  const focus = useRef(new Vector3());
  useFrame(({ camera, size }, delta) => {
    const c = controls.current;
    if (!c) return;
    if (previous.current !== cameraMode) {
      previous.current = cameraMode;
      settling.current = 2;
      focus.current.set(
        ...(cameraMode.mode === "asteroid" || cameraMode.mode === "follow"
          ? target
          : ([0, 0, 0] as [number, number, number])),
      );
      const d =
        cameraMode.mode === "overview"
          ? extent * (size.width < size.height ? 4.5 : 3.2)
          : cameraMode.mode === "earth"
            ? 2.8
            : Math.max(1, extent * 0.3);
      goal.current.copy(focus.current).add(new Vector3(0, d * 0.6, d));
    }
    if (settling.current > 0) {
      const alpha = 1 - Math.exp(-4 * delta);
      camera.position.lerp(goal.current, alpha);
      c.target.lerp(focus.current, alpha);
      settling.current -= delta;
    } else if (cameraMode.mode === "follow") {
      const next = new Vector3(...target);
      const shift = next.sub(c.target).multiplyScalar(1 - Math.exp(-5 * delta));
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
      minDistance={0.2}
      maxDistance={Math.max(200, extent * 10)}
      onStart={() => {
        settling.current = 0;
      }}
    />
  );
}

/** Keep exaggerated body markers legible when overview covers many lunar distances.
 * This affects display radius only, never the position or trajectory scale. */
function EncounterBody({
  position,
  radius,
  pixels,
  color,
}: {
  position: [number, number, number];
  radius: number;
  pixels: number;
  color: string;
}) {
  const mesh = useRef<Mesh>(null);
  const point = useMemo(() => new Vector3(...position), [position]);
  useFrame(({ camera, size }) => {
    const fov = ((camera as PerspectiveCamera).fov * Math.PI) / 180;
    const worldPerPixel =
      (2 * camera.position.distanceTo(point) * Math.tan(fov / 2)) / size.height;
    mesh.current?.scale.setScalar(Math.max(radius, worldPerPixel * pixels));
  });
  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.2}
        roughness={0.8}
      />
    </mesh>
  );
}

function EncounterProjection({
  points,
  elements,
}: {
  points: { id: string; position: number[] }[];
  elements: RefObject<Record<string, HTMLDivElement | null>>;
}) {
  const vector = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const { id, position } of points) {
      const el = elements.current[id];
      if (!el) continue;
      vector.set(position[0], position[1], position[2]).project(camera);
      const x = ((vector.x + 1) * size.width) / 2,
        y = ((1 - vector.y) * size.height) / 2;
      el.style.setProperty(
        "visibility",
        vector.z < -1 ||
          vector.z > 1 ||
          x < 0 ||
          x > size.width ||
          y < 0 ||
          y > size.height
          ? "hidden"
          : "visible",
      );
      el.style.setProperty(
        "transform",
        `translate3d(${x + 12}px,${y + (id === "closest" ? 18 : -20)}px,0)`,
      );
    }
  });
  return null;
}

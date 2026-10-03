"use client";
import { Component, memo, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Line, Stars } from "@react-three/drei";
import { DoubleSide, type Mesh, type PerspectiveCamera, Vector3 } from "three";
import {
  bodyMetadata,
  DEFAULT_LAYERS,
  type Layers,
  type SolarCamera as SolarCameraState,
} from "@/lib/explorer/catalog";
import { SolarCamera } from "./SolarCamera";

import type {
  ObjectId,
  SpaceObjectTrajectory,
  TrajectoryDataset,
} from "@/models/trajectory";
import { interpolatePosition, toScene } from "@/lib/astronomy/interpolate";
import { LabelProjection, type LabelElements } from "./SceneLabels";
import {
  EncounterScene,
  type EncounterOptions,
} from "../encounter/EncounterScene";
import type { EncounterDataset } from "@/models/encounter";
const NEO_COLORS = ["#efb977", "#c6b3e6", "#93c8b7", "#d8bb9e", "#abc5e0"];
function objectColor(id: ObjectId): string {
  if (id.startsWith("spacecraft:")) return "#82e0d4";
  const metadata = bodyMetadata(id);
  if (metadata) return metadata.color;
  const hash = [...id].reduce((value, char) => value + char.charCodeAt(0), 0);
  return NEO_COLORS[hash % NEO_COLORS.length];
}
// One scene unit = one AU. Only these marker radii are visually exaggerated.
const VISUAL_RADIUS = { sun: 0.039, earth: 0.018, asteroid: 0.013 };
function Body({
  trajectory,
  time,
  selected,
  onSelect,
}: {
  trajectory: SpaceObjectTrajectory;
  time: number;
  selected: boolean;
  onSelect: (id: ObjectId) => void;
}) {
  const position = toScene(interpolatePosition(trajectory.points, time));
  const color = objectColor(trajectory.id);
  const mesh = useRef<Mesh>(null);
  useFrame(({ camera, size }) => {
    const base =
      bodyMetadata(trajectory.id)?.displayRadius ?? VISUAL_RADIUS.asteroid;
    const pixel =
      (2 *
        camera.position.distanceTo(new Vector3(...position)) *
        Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360)) /
      size.height;
    mesh.current?.scale.setScalar(
      Math.max(base, pixel * (trajectory.id.startsWith("neo:") ? 2 : 4)),
    );
  });
  function select(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(trajectory.id);
  }
  return (
    <group position={position}>
      <mesh ref={mesh} onClick={select}>
        {trajectory.id.startsWith("spacecraft:") ? (
          <octahedronGeometry args={[1, 0]} />
        ) : (
          <sphereGeometry args={[1, 32, 24]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.85}
        />
      </mesh>
      <Billboard>
        <mesh onClick={select}>
          <ringGeometry args={[0.028, selected ? 0.03 : 0.0287, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={selected ? 0.9 : 0.4}
            side={DoubleSide}
          />
        </mesh>
      </Billboard>
    </group>
  );
}
const Trajectory = memo(function Trajectory({
  data,
  selected,
}: {
  data: SpaceObjectTrajectory;
  selected: boolean;
}) {
  const points = useMemo(() => data.points.map(toScene), [data]);
  return (
    <Line
      points={points}
      color={objectColor(data.id)}
      transparent
      opacity={selected ? 0.5 : 0.22}
      lineWidth={selected ? 1.1 : 0.8}
    />
  );
});

function Sun() {
  return (
    <group>
      <pointLight color="#fff1d4" intensity={7} decay={0} />
      <mesh>
        <sphereGeometry args={[VISUAL_RADIUS.sun, 32, 32]} />
        <meshBasicMaterial color="#fff4d4" />
      </mesh>
      <Billboard>
        <group>
          {[0.05, 0.07, 0.105].map((size, i) => (
            <mesh key={size}>
              <circleGeometry args={[size, 64]} />
              <meshBasicMaterial
                color="#f6ba6c"
                transparent
                opacity={0.055 / (i + 1)}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </Billboard>
    </group>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-failure" role="alert">
        The 3D view needs WebGL. Enable hardware acceleration or try another
        browser.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function OrbitScene({
  data,
  time,
  selected,
  onSelect,
  view,
  encounter,
  encounterOptions,
  onSeek,
  layers = DEFAULT_LAYERS,
  solarCamera = { mode: "inner", revision: 0 },
  hiddenSpacecraftPaths = [],
}: {
  data: TrajectoryDataset;
  time: number;
  selected: ObjectId;
  onSelect: (id: ObjectId) => void;
  view: number;
  encounter?: EncounterDataset;
  encounterOptions?: EncounterOptions;
  onSeek?: (time: number) => void;
  layers?: Layers;
  solarCamera?: SolarCameraState;
  hiddenSpacecraftPaths?: ObjectId[];
}) {
  const labels: LabelElements = useRef({});
  const encounterLabels = useRef<Record<string, HTMLDivElement | null>>({});
  const visibleData = useMemo(
    () => ({
      ...data,
      objects: data.objects.filter((o) =>
        o.id.startsWith("spacecraft:")
          ? layers.spacecraft
          : o.id === "moon"
            ? layers.moon
            : o.id.startsWith("neo:")
              ? layers.asteroids
              : layers.planets,
      ),
    }),
    [data, layers],
  );
  const labelData = useMemo(
    () => ({
      ...visibleData,
      objects: visibleData.objects.filter((o) =>
        o.id.startsWith("spacecraft:")
          ? layers.spacecraftLabels
          : layers.labels,
      ),
    }),
    [visibleData, layers],
  );
  return (
    <SceneBoundary>
      <Canvas
        camera={{
          position: [0, 2.65, 3.1],
          fov: 43,
          near: 0.00001,
          far: 20000,
        }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
        fallback={
          <div className="scene-failure">
            WebGL is unavailable in this browser.
          </div>
        }
      >
        <ambientLight intensity={0.7} />
        <Stars
          radius={55}
          depth={35}
          count={1700}
          factor={1.4}
          saturation={0}
          fade
          speed={0}
        />
        {encounter && encounterOptions && onSeek ? (
          <EncounterScene
            data={encounter}
            time={time}
            options={encounterOptions}
            onSeek={onSeek}
            layers={layers}
            labelElements={encounterLabels}
          />
        ) : (
          <>
            <Sun />
            {labelData.objects.map((object) => (
              <group key={object.id}>
                {(object.id.startsWith("spacecraft:")
                  ? layers.spacecraftTrajectories &&
                    !hiddenSpacecraftPaths.includes(object.id)
                  : object.id.startsWith("neo:")
                    ? layers.asteroidTrajectories
                    : layers.planetOrbits) && (
                  <Trajectory data={object} selected={selected === object.id} />
                )}
                <Body
                  trajectory={object}
                  time={time}
                  selected={selected === object.id}
                  onSelect={onSelect}
                />
              </group>
            ))}
            <SolarCamera
              data={data}
              time={time}
              selected={selected}
              state={solarCamera}
              view={view}
            />
            {(layers.labels || layers.spacecraftLabels) && (
              <LabelProjection
                data={labelData}
                time={time}
                elements={labels}
                showSun={layers.labels}
                selected={selected}
              />
            )}
          </>
        )}
      </Canvas>
      {encounter && layers.labels && (
        <div className="scene-labels">
          {[
            { id: "earth", name: "EARTH" },
            ...(encounter.moon && layers.moon
              ? [{ id: "moon", name: "MOON" }]
              : []),
            ...(layers.asteroids
              ? [{ id: "asteroid", name: encounter.neo.name }]
              : []),
            { id: "closest", name: "NASA closest approach" },
          ].map((label) => (
            <div
              key={label.id}
              className="projected-label"
              ref={(el) => {
                encounterLabels.current[label.id] = el;
              }}
            >
              {label.id === "closest" ? (
                <button
                  className="encounter-marker"
                  onClick={() => onSeek?.(encounter.approach.time)}
                >
                  {label.name}
                </button>
              ) : (
                <span className="encounter-label">{label.name}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {!encounter &&
        (layers.labels ||
          (layers.spacecraftLabels && labelData.objects.length > 0)) && (
          <div className="scene-labels">
            <div
              className="projected-label"
              ref={(element) => {
                labels.current.sun = element;
              }}
            >
              {layers.labels && (
                <button className="sun-label" onClick={() => onSelect("sun")}>
                  SUN
                </button>
              )}
            </div>
            {labelData.objects.map((object) => (
              <div
                key={object.id}
                className="projected-label"
                ref={(element) => {
                  labels.current[object.id] = element;
                }}
              >
                <button
                  className={`body-label ${selected === object.id ? "selected" : ""}`}
                  style={{ color: objectColor(object.id) }}
                  onClick={() => onSelect(object.id)}
                >
                  <span>{object.name}</span>
                </button>
              </div>
            ))}
          </div>
        )}
    </SceneBoundary>
  );
}

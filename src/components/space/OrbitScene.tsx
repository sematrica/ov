"use client";
import { Component, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, Stars } from "@react-three/drei";
import { DoubleSide } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  ObjectId,
  SpaceObjectTrajectory,
  TrajectoryDataset,
} from "@/models/trajectory";
import { interpolatePosition, toScene } from "@/lib/astronomy/interpolate";
import { LabelProjection, type LabelElements } from "./SceneLabels";
export const COLORS = { earth: "#79c9ff", apophis: "#efb977" };
// One scene unit = one AU. Only these marker radii are visually exaggerated.
const VISUAL_RADIUS = { sun: 0.039, earth: 0.018, apophis: 0.013 };
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
  const color = COLORS[trajectory.id];
  function select(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(trajectory.id);
  }
  return (
    <group position={position}>
      <mesh onClick={select}>
        <sphereGeometry args={[VISUAL_RADIUS[trajectory.id], 32, 24]} />
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
function Trajectory({
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
      color={COLORS[data.id]}
      transparent
      opacity={selected ? 0.5 : 0.22}
      lineWidth={selected ? 1.1 : 0.8}
    />
  );
}
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
function CameraController({ view }: { view: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const previous = useRef(-1);
  useFrame(({ camera, size }) => {
    if (previous.current !== view) {
      // Fit the orbital map into the shorter scene on narrow screens.
      const cameraDistance = size.width < 850 ? 0.75 : 1;
      camera.position.set(
        0,
        (view % 2 === 0 ? 2.65 : 4.1) * cameraDistance,
        (view % 2 === 0 ? 3.1 : 0.001) * cameraDistance,
      );
      controls.current?.target.set(0, 0, 0);
      controls.current?.update();
      previous.current = view;
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.35}
      maxDistance={9}
      maxPolarAngle={Math.PI * 0.95}
    />
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
}: {
  data: TrajectoryDataset;
  time: number;
  selected: ObjectId;
  onSelect: (id: ObjectId) => void;
  view: number;
}) {
  const labels: LabelElements = useRef({});
  return (
    <SceneBoundary>
      <Canvas
        camera={{ position: [0, 2.65, 3.1], fov: 43, near: 0.01, far: 150 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
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
        <Sun />
        {data.objects.map((object) => (
          <group key={object.id}>
            <Trajectory data={object} selected={selected === object.id} />
            <Body
              trajectory={object}
              time={time}
              selected={selected === object.id}
              onSelect={onSelect}
            />
          </group>
        ))}
        <CameraController view={view} />
        <LabelProjection data={data} time={time} elements={labels} />
      </Canvas>
      <div className="scene-labels">
        <div
          className="projected-label"
          ref={(element) => {
            labels.current.sun = element;
          }}
        >
          <span className="sun-label">SUN</span>
        </div>
        {data.objects.map((object) => (
          <div
            key={object.id}
            className="projected-label"
            ref={(element) => {
              labels.current[object.id] = element;
            }}
          >
            <button
              className={`body-label ${selected === object.id ? "selected" : ""}`}
              style={{ color: COLORS[object.id] }}
              onClick={() => onSelect(object.id)}
            >
              <span>{object.id === "earth" ? "Earth" : "Apophis"}</span>
              <small>{object.id === "earth" ? "399" : "99942"}</small>
            </button>
          </div>
        ))}
      </div>
    </SceneBoundary>
  );
}

"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import {
  CircleHelp,
  Compass,
  Globe2,
  Maximize2,
  Orbit,
  RotateCcw,
} from "lucide-react";
import { useTrajectories } from "@/hooks/useTrajectories";
import { useSimulation } from "@/hooks/useSimulation";
import type { ObjectId, TrajectoryDataset } from "@/models/trajectory";
import { ObjectPanel } from "./ObjectPanel";
import { TimeControls } from "./controls/TimeControls";
const OrbitScene = dynamic(() => import("./space/OrbitScene"), {
  ssr: false,
  loading: () => (
    <div className="scene-loading">Preparing the orbital view…</div>
  ),
});
function Workspace({ data }: { data: TrajectoryDataset }) {
  const simulation = useSimulation(data.range);
  const [selected, setSelected] = useState<ObjectId>("apophis");
  const [view, setView] = useState(0);
  const [help, setHelp] = useState(false);
  const object = data.objects.find((item) => item.id === selected)!;
  return (
    <>
      <div className="view-heading">
        <div>
          <span className="eyebrow">INNER SOLAR SYSTEM</span>
          <h1>
            A closer look at
            <br />
            our cosmic neighborhood.
          </h1>
        </div>
        <div className="frame-label">
          <span className="live-dot" />
          HELIOCENTRIC VIEW<span>J2000 ECLIPTIC</span>
        </div>
      </div>
      <div
        className="space-viewport"
        aria-label="Interactive 3D heliocentric map. Drag to orbit, scroll to zoom, right-drag to pan."
      >
        <OrbitScene
          data={data}
          time={simulation.time}
          selected={selected}
          onSelect={setSelected}
          view={view}
        />
      </div>
      <div className="objects-list">
        <span className="eyebrow">
          IN VIEW <span className="count">03</span>
        </span>
        <div className="sun-item">
          <span className="legend-dot sun" />
          Sun <span className="list-note">ORIGIN</span>
        </div>
        {data.objects.map((item) => (
          <button
            key={item.id}
            className={`object-item ${selected === item.id ? "active" : ""}`}
            onClick={() => setSelected(item.id)}
            aria-pressed={selected === item.id}
          >
            <span className={`legend-dot ${item.id}`} />
            {item.id === "earth" ? "Earth" : "Apophis"}
            <span className="list-note">
              {item.id === "earth" ? "PLANET" : "NEO"}
            </span>
          </button>
        ))}
      </div>
      <ObjectPanel object={object} time={simulation.time} />
      <div className="view-tools">
        <button
          className="icon-button"
          aria-label="Reset camera"
          title="Reset camera"
          onClick={() => setView((value) => value + (value % 2 === 0 ? 2 : 1))}
        >
          <RotateCcw size={17} />
        </button>
        <button
          className={`icon-button ${view % 2 ? "active" : ""}`}
          aria-label="Toggle top-down view"
          title="Toggle top-down view"
          aria-pressed={view % 2 === 1}
          onClick={() => setView((value) => value + 1)}
        >
          <Maximize2 size={17} />
        </button>
        <button
          className={`icon-button ${help ? "active" : ""}`}
          aria-label="View navigation help"
          title="Navigation help"
          aria-expanded={help}
          onClick={() => setHelp(!help)}
        >
          <CircleHelp size={17} />
        </button>
      </div>
      {help && (
        <div className="help-panel">
          <strong>Explore the view</strong>
          <span>Drag to orbit · Scroll to zoom</span>
          <span>Right-drag to pan · Pinch on touch</span>
          <span>Select a body or use the object list.</span>
          <span>Use ← / → on the timeline to scrub.</span>
        </div>
      )}
      <div className="scene-caption">
        <Compass size={20} />
        <div>
          J2000 ECLIPTIC<span>Positions to scale · Body sizes exaggerated</span>
        </div>
      </div>
      <div className="interaction-hint">
        DRAG TO ORBIT<span>·</span>SCROLL TO ZOOM
      </div>
      <TimeControls simulation={simulation} range={data.range} />
      <footer>
        <span>
          <span className="live-dot" />
          NASA/JPL HORIZONS{" "}
          <span className="footer-secondary">/ 6-hour vector samples</span>
        </span>
        <span className="footer-secondary">
          {simulation.playing
            ? simulation.direction === 1
              ? "PLAYING FORWARD"
              : "PLAYING BACKWARD"
            : "SIMULATION PAUSED"}
          <span className="footer-divider">/</span>PHASE 01
        </span>
      </footer>
    </>
  );
}
export default function Observatory() {
  const { data, error, retry } = useTrajectories();
  return (
    <main className="observatory">
      <header>
        <a className="brand" href="/" aria-label="Nearby home">
          <span className="brand-mark">
            <Orbit size={25} strokeWidth={1.3} />
          </span>
          nearby
          <span className="brand-divider" />
          <span className="brand-description">ORBITAL OBSERVATORY</span>
        </a>
        <div className="header-meta">
          <Globe2 size={14} />
          <span>EARTH & NEAR-EARTH OBJECTS</span>
          <span className="phase">EXPLORER / 01</span>
        </div>
      </header>
      {data ? (
        <Workspace data={data} />
      ) : (
        <div className="loading-state" role={error ? "alert" : "status"}>
          <Orbit
            size={42}
            strokeWidth={1}
            className={error ? "" : "loading-orbit"}
          />
          <span className="eyebrow">CONNECTING TO OUR NEIGHBORHOOD</span>
          <h1>
            {error
              ? "The ephemeris is out of reach."
              : "Loading trajectory data…"}
          </h1>
          <p>
            {error ??
              "Retrieving Earth and Apophis vector samples from NASA/JPL Horizons."}
          </p>
          {error ? (
            <button className="retry-button" onClick={retry}>
              <RotateCcw size={15} /> Retry connection
            </button>
          ) : (
            <span className="loading-note">
              Two years of real positions. One shared clock.
            </span>
          )}
        </div>
      )}
    </main>
  );
}

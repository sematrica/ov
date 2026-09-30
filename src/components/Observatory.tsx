"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleHelp,
  Compass,
  Contrast,
  Globe2,
  Maximize2,
  Orbit,
  RotateCcw,
} from "lucide-react";
import { useTrajectories } from "@/hooks/useTrajectories";
import { useNeoDiscovery } from "@/hooks/useNeoDiscovery";
import { DiscoveryPanel } from "./discovery/DiscoveryPanel";
import { utcDate } from "@/lib/astronomy/time";
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
  const [selected, setSelected] = useState<ObjectId>("earth");
  const [view, setView] = useState(0);
  const [help, setHelp] = useState(false);
  const manager = useNeoDiscovery(data.range);
  const earth = data.objects[0];
  const selectedEntry = manager.store[selected];
  const object = selected === "earth" ? earth : selectedEntry?.trajectory;
  const sceneData = useMemo(
    () => ({
      ...data,
      objects: [
        earth,
        ...Object.values(manager.store).flatMap((entry) =>
          entry?.trajectory && entry.visible ? [entry.trajectory] : [],
        ),
      ],
    }),
    [data, earth, manager.store],
  );
  const timeRef = useRef(simulation.time);
  useEffect(() => {
    timeRef.current = simulation.time;
  }, [simulation.time]);
  const getSimulationDate = useCallback(() => utcDate(timeRef.current), []);
  const effectiveSelected =
    selected === "earth" || selectedEntry ? selected : "earth";
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
          data={sceneData}
          time={simulation.time}
          selected={effectiveSelected}
          onSelect={setSelected}
          view={view}
        />
      </div>
      <div className="base-objects">
        <span>
          <span className="legend-dot sun" /> Sun
        </span>
        <button
          onClick={() => setSelected("earth")}
          aria-pressed={effectiveSelected === "earth"}
        >
          <span className="legend-dot earth" /> Earth
        </button>
        <span>{sceneData.objects.length - 1} NEOs visible</span>
      </div>
      <DiscoveryPanel
        manager={manager}
        range={data.range}
        selected={effectiveSelected}
        onSelect={setSelected}
        getSimulationDate={getSimulationDate}
      />
      <ObjectPanel
        object={effectiveSelected === "earth" ? earth : object}
        entry={effectiveSelected === "earth" ? undefined : selectedEntry}
        earth={earth}
        time={simulation.time}
        onAdd={manager.add}
      />
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
          <span className="footer-divider">/</span>STAGE 02
        </span>
      </footer>
    </>
  );
}
export default function Observatory() {
  const { data, error, retry } = useTrajectories();
  const [monochrome, setMonochrome] = useState(false);
  return (
    <main className={`observatory${monochrome ? " monochrome" : ""}`}>
      <header>
        <Link className="brand" href="/" aria-label="Nearby home">
          <span className="brand-mark">
            <Orbit size={25} strokeWidth={1.3} />
          </span>
          nearby
          <span className="brand-divider" />
          <span className="brand-description">ORBITAL OBSERVATORY</span>
        </Link>
        <div className="header-meta">
          <Globe2 size={14} />
          <span>EARTH & NEAR-EARTH OBJECTS</span>
          <span className="phase">EXPLORER / 02</span>
          <button
            className="monochrome-toggle"
            aria-label="Black and white mode"
            aria-pressed={monochrome}
            title={monochrome ? "Restore color" : "Switch to black and white"}
            onClick={() => setMonochrome((enabled) => !enabled)}
          >
            <Contrast size={15} aria-hidden="true" />
            <span>B&W</span>
          </button>
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
            {error ?? "Retrieving Earth vector samples from NASA/JPL Horizons."}
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

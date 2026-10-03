"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useEncounter } from "@/hooks/useEncounter";
import { EncounterPanel } from "./encounter/EncounterPanel";
import type { EncounterDataset } from "@/models/encounter";
import type { EncounterOptions } from "./encounter/EncounterScene";
import { usePlanets } from "@/hooks/usePlanets";
import { useEvents } from "@/hooks/useEvents";
import { ExplorerControls } from "./explorer/ExplorerControls";
import { EventExplorer } from "./explorer/EventExplorer";
import {
  bodyMetadata,
  DEFAULT_LAYERS,
  matchesSearch,
  type SolarCamera,
} from "@/lib/explorer/catalog";
import { parseExplorerLink, explorerUrl } from "@/lib/explorer/state";
import { type CloseApproachEvent } from "@/lib/explorer/events";
import { closestApproach } from "@/lib/neo/selection";
import { parseDate } from "@/lib/neows/window";
import type { NeoEntry } from "@/models/neo";
import { useSpacecraft } from "@/hooks/useSpacecraft";
import { SpacecraftExplorer } from "./spacecraft/SpacecraftExplorer";
import { SpacecraftPanel } from "./spacecraft/SpacecraftPanel";
import { coversTime } from "@/lib/spacecraft/measurements";
import type { SpacecraftTrajectoryResult } from "@/models/spacecraft";
const OrbitScene = dynamic(() => import("./space/OrbitScene"), {
  ssr: false,
  loading: () => (
    <div className="scene-loading">Preparing the orbital view…</div>
  ),
});
function Workspace({ data }: { data: TrajectoryDataset }) {
  const encounter = useEncounter();
  const spacecraft = useSpacecraft();
  const [showSpacecraft, setShowSpacecraft] = useState(false);
  const [spacecraftContext, setSpacecraftContext] =
    useState<SpacecraftTrajectoryResult>();
  const planets = usePlanets(data.range);
  const events = useEvents();
  const [showEvents, setShowEvents] = useState(false);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [solarCamera, setSolarCamera] = useState<SolarCamera>({
    mode: "inner",
    revision: 0,
  });
  const [externalEntry, setExternalEntry] = useState<NeoEntry>();
  const [solarContext, setSolarContext] = useState<EncounterDataset>();
  const [selectedEvent, setSelectedEvent] = useState<CloseApproachEvent>();
  const [notice, setNotice] = useState<string>();
  const activeEncounter = encounter.active ? encounter.data : undefined;
  const range =
    activeEncounter?.range ??
    solarContext?.range ??
    spacecraftContext?.range ??
    data.range;
  const simulation = useSimulation(range);
  const [encounterOptions, setEncounterOptions] = useState<EncounterOptions>({
    distanceLine: true,
    asteroidTrail: true,
    moonTrail: true,
    camera: { mode: "overview", revision: 0 },
  });
  function enterEncounter(result: EncounterDataset) {
    setSolarContext(undefined);
    setSpacecraftContext(undefined);
    setSelectedEvent({
      id: `${result.neo.id}:${result.approach.time}:Earth`,
      object: result.neo,
      approach: result.approach,
      discoveryDate: utcDate(result.approach.time),
    });
    simulation.seek(result.range.start, result.range);
    simulation.setRate(3600);
    simulation.setDirection(1);
    setSelected(result.neo.id);
    setEncounterOptions((o) => ({
      ...o,
      camera: { mode: "overview", revision: o.camera.revision + 1 },
    }));
  }
  function exitEncounter() {
    encounter.exit();
    setSolarContext(undefined);
    setSpacecraftContext(undefined);
    simulation.seek(simulation.time, data.range);
    simulation.setRate(864000);
  }

  const [selected, setSelected] = useState<ObjectId>("earth");
  const [view, setView] = useState(0);
  const [help, setHelp] = useState(false);
  const manager = useNeoDiscovery(data.range);
  const earth =
    solarContext?.earth ?? spacecraftContext?.earth ?? data.objects[0];
  const selectedEntry =
    externalEntry?.metadata.id === selected
      ? externalEntry
      : manager.store[selected];
  const candidate =
    selected === "earth"
      ? earth
      : (planets.objects[selected] ?? selectedEntry?.trajectory);
  const object =
    candidate &&
    candidate.points[0].time <= simulation.time &&
    candidate.points.at(-1)!.time >= simulation.time
      ? candidate
      : undefined;
  const sceneData = useMemo(
    () => ({
      ...data,
      objects: [
        ...(coversTime(earth, simulation.time) ? [earth] : []),
        ...Object.values(spacecraft.entries).flatMap((e) =>
          e?.visible && coversTime(e.data?.trajectory, simulation.time)
            ? [e.data.trajectory]
            : [],
        ),
        ...Object.values(planets.objects).filter(
          (o) =>
            o.points[0].time <= simulation.time &&
            o.points.at(-1)!.time >= simulation.time &&
            o.id !== "moon",
        ),
        ...(solarContext?.moon
          ? [solarContext.moon]
          : planets.objects.moon &&
              planets.objects.moon.points[0].time <= simulation.time &&
              planets.objects.moon.points.at(-1)!.time >= simulation.time
            ? [planets.objects.moon]
            : []),
        ...(solarContext ? [solarContext.asteroid] : []),
        ...Object.values(manager.store).flatMap((entry) =>
          entry?.trajectory &&
          entry.visible &&
          entry.metadata.id !== solarContext?.neo.id &&
          entry.trajectory.points[0].time <= simulation.time &&
          entry.trajectory.points.at(-1)!.time >= simulation.time
            ? [entry.trajectory]
            : [],
        ),
      ],
    }),
    [
      data,
      earth,
      manager.store,
      spacecraft.entries,
      planets.objects,
      solarContext,
      simulation.time,
    ],
  );
  const timeRef = useRef(simulation.time);
  useEffect(() => {
    timeRef.current = simulation.time;
  }, [simulation.time]);
  const getSimulationDate = useCallback(() => utcDate(timeRef.current), []);
  const effectiveSelected =
    bodyMetadata(selected) || selectedEntry || spacecraft.entries[selected]
      ? selected
      : "earth";
  function camera(mode: SolarCamera["mode"]) {
    if (activeEncounter) {
      if (mode === "overview" || mode === "inner" || mode === "interstellar")
        exitEncounter();
      else if (mode === "focus" || mode === "follow")
        setEncounterOptions((o) => ({
          ...o,
          camera: {
            mode:
              mode === "follow"
                ? "follow"
                : selected === "earth"
                  ? "earth"
                  : "asteroid",
            revision: o.camera.revision + 1,
          },
        }));
    }
    setSolarCamera((c) => ({ mode, revision: c.revision + 1 }));
  }
  function selectObject(id: ObjectId) {
    setSelected(id);
    const event = events.result.events.find((e) => e.object.id === id);
    if (event && !manager.store[id])
      setExternalEntry({
        metadata: event.object,
        discoveryDate: event.discoveryDate,
        status: "discovered",
        visible: false,
      });
    if (!id.startsWith("neo:")) {
      if (activeEncounter) exitEncounter();
      setSolarCamera((c) => ({ mode: "focus", revision: c.revision + 1 }));
    }
  }
  function spacecraftReady(
    id: ObjectId,
    result: SpacecraftTrajectoryResult,
    closeDrawer = true,
  ) {
    encounter.exit();
    setSolarContext(undefined);
    setSpacecraftContext(result);
    setSelected(id);
    setLayers((l) => ({ ...l, spacecraft: true }));
    const nextTime =
      simulation.time >= result.range.start &&
      simulation.time <= result.range.end
        ? simulation.time
        : result.range.start;
    simulation.seek(nextTime, result.range);
    simulation.setRate(3600);
    setSolarCamera((c) => ({ mode: "focus", revision: c.revision + 1 }));
    if (closeDrawer) setShowSpacecraft(false);
  }
  function navigateSpacecraft(id: ObjectId, follow: boolean) {
    const entry = spacecraft.entries[id];
    if (!entry?.data) return;
    spacecraftReady(id, entry.data);
    if (!entry.visible) spacecraft.toggle(id, "visible");
    setSolarCamera((c) => ({
      mode: follow ? "follow" : "focus",
      revision: c.revision + 1,
    }));
  }
  function openEvent(event: CloseApproachEvent, mode: "solar" | "encounter") {
    const entry: NeoEntry = {
      metadata: event.object,
      discoveryDate: event.discoveryDate,
      status: "discovered",
      visible: false,
    };
    setExternalEntry(entry);
    setSelected(event.object.id);
    setSelectedEvent(event);
    void encounter.load(
      entry,
      (result) => {
        setShowEvents(false);
        setExternalEntry({
          ...entry,
          status: "loaded",
          trajectory: result.asteroid,
          visible: true,
        });
        if (mode === "encounter") enterEncounter(result);
        else {
          setSpacecraftContext(undefined);
          setSolarContext(result);
          simulation.seek(event.approach.time, result.range);
          simulation.setRate(3600);
          camera("context");
        }
        window.history.replaceState(
          null,
          "",
          explorerUrl({
            date: event.discoveryDate,
            object: event.object.id,
            mode,
            event: event.approach.time,
          }),
        );
      },
      event.approach.time,
      mode,
    );
  }
  function jumpDate(date: string) {
    try {
      const time = parseDate(date);
      if (time >= range.start && time <= range.end) {
        simulation.seek(time);
        window.history.replaceState(
          null,
          "",
          explorerUrl({
            date,
            mode: activeEncounter ? "encounter" : "solar",
            object: selected,
          }),
        );
      } else window.location.assign(explorerUrl({ date, mode: "solar" }));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Invalid date.");
    }
  }
  const restoreLink = useEffectEvent(async () => {
    try {
      const link = parseExplorerLink(
        new URLSearchParams(window.location.search),
      );
      if (link.date) simulation.seek(parseDate(link.date));
      if (!link.object) return;
      if (link.object.startsWith("spacecraft:")) {
        const records = await spacecraft.search(
          link.object.slice("spacecraft:".length),
        );
        const record = records.find((r) => r.spacecraft.id === link.object);
        if (!record) throw new Error("Spacecraft link could not be resolved.");
        spacecraft.select(record);
        setSelected(record.spacecraft.id);
        const center = link.date ? parseDate(link.date) : simulation.time;
        await spacecraft.add(
          record,
          {
            start: Math.floor(center / 86400000) * 86400000,
            end: Math.floor(center / 86400000) * 86400000 + 86400000,
          },
          (result) => spacecraftReady(record.spacecraft.id, result),
        );
        return;
      }
      if (bodyMetadata(link.object)) {
        setSelected(link.object as ObjectId);
        camera("focus");
        return;
      }
      const date = link.date ?? utcDate(simulation.time);
      const r = await fetch(
        `/api/events?${new URLSearchParams({ start: date, end: date })}`,
      );
      const result = await r.json();
      if (!r.ok) throw new Error(result.error ?? "Cannot restore event.");
      const event = (result.events as CloseApproachEvent[]).find(
        (e) =>
          (e.object.id === link.object ||
            matchesSearch(link.object!, e.object.name)) &&
          (link.event === undefined || e.approach.time === link.event),
      );
      if (!event)
        throw new Error(
          "No matching encounter in the linked date. Browse events to select a date and object.",
        );
      openEvent(event, link.mode);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to restore link.");
    }
  });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void restoreLink();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const searchableNeos = [
    ...new Map(
      [
        ...Object.values(manager.store).flatMap((e) => (e ? [e.metadata] : [])),
        ...events.result.events.map((e) => e.object),
      ].map((n) => [n.id, n]),
    ).values(),
  ];
  const chronological = [...events.result.events].sort(
    (a, b) => a.approach.time - b.approach.time,
  );
  function adjacentEvent(direction: 1 | -1) {
    const next =
      direction === 1
        ? chronological.find((e) => e.approach.time > simulation.time)
        : chronological.findLast((e) => e.approach.time < simulation.time);
    if (next) openEvent(next, activeEncounter ? "encounter" : "solar");
    else
      setNotice(
        "No more encounters in the browsed range. Open Event Explorer to load another range.",
      );
  }
  return (
    <>
      <ExplorerControls
        neos={searchableNeos}
        layers={layers}
        onLayers={setLayers}
        onSelect={selectObject}
        onCamera={camera}
        onEvents={() => {
          setShowSpacecraft(false);
          setShowEvents((v) => !v);
        }}
        spacecrafts={Object.values(spacecraft.entries).flatMap((e) =>
          e?.data ? [{ id: e.spacecraft.id, name: e.spacecraft.name }] : [],
        )}
        onSpacecraftFocus={(id) => navigateSpacecraft(id, false)}
        onSpacecraft={() => {
          setShowEvents(false);
          setShowSpacecraft((v) => !v);
        }}
        statuses={planets.statuses}
        onRetry={planets.retry}
        onDate={jumpDate}
        onShare={() => {
          const approach =
            selectedEvent?.object.id === selected
              ? selectedEvent.approach
              : selectedEntry
                ? closestApproach(selectedEntry.metadata)
                : undefined;
          window.history.replaceState(
            null,
            "",
            explorerUrl({
              date: utcDate(approach?.time ?? simulation.time),
              object: selected,
              mode: activeEncounter ? "encounter" : "solar",
              event: approach?.time,
            }),
          );
          setNotice("The address bar now contains a shareable link.");
        }}
      />
      {notice && (
        <div className="explorer-notice" role="status">
          {notice}
          <button onClick={() => setNotice(undefined)}>Dismiss</button>
        </div>
      )}
      {showSpacecraft && (
        <div className="event-drawer spacecraft-drawer">
          <button
            className="drawer-close"
            onClick={() => setShowSpacecraft(false)}
          >
            Close Spacecraft Explorer
          </button>
          <SpacecraftExplorer
            manager={spacecraft}
            initialRecord={spacecraft.entries[selected]}
            time={simulation.time}
            onSelect={selectObject}
            onReady={spacecraftReady}
            onNavigate={navigateSpacecraft}
          />
        </div>
      )}
      {showEvents && (
        <div className="event-drawer">
          <button className="drawer-close" onClick={() => setShowEvents(false)}>
            Close Event Explorer
          </button>
          <EventExplorer
            events={events}
            onEvent={openEvent}
            busy={encounter.loading}
          />
        </div>
      )}
      <nav className="mode-switch" aria-label="Visualization mode">
        <button aria-pressed={!activeEncounter} onClick={exitEncounter}>
          SOLAR SYSTEM
        </button>
        <button
          aria-pressed={!!activeEncounter}
          disabled={!selectedEntry || encounter.loading}
          onClick={() =>
            selectedEntry && encounter.load(selectedEntry, enterEncounter)
          }
        >
          EARTH ENCOUNTER
        </button>
      </nav>
      {encounter.loading && (
        <div className="encounter-status" role="status">
          Preparing high-resolution Earth, Moon & asteroid ephemeris…{" "}
          <button onClick={exitEncounter}>Cancel</button>
        </div>
      )}
      {encounter.error && (
        <div className="encounter-status" role="alert">
          {encounter.error}
        </div>
      )}
      <div className="view-heading">
        <div>
          <span className="eyebrow">
            {activeEncounter ? "EARTH’S NEIGHBORHOOD" : "INNER SOLAR SYSTEM"}
          </span>
          <h1>
            {activeEncounter ? (
              <>
                A close encounter.
                <br />A shared perspective.
              </>
            ) : (
              <>
                A closer look at
                <br />
                our cosmic neighborhood.
              </>
            )}
          </h1>
        </div>
        <div className="frame-label">
          <span className="live-dot" />
          {activeEncounter ? "EARTH-RELATIVE VIEW" : "HELIOCENTRIC VIEW"}
          <span>J2000 ECLIPTIC</span>
        </div>
      </div>
      <div
        className="space-viewport"
        aria-label={`Interactive 3D ${activeEncounter ? "Earth encounter" : "heliocentric"} map. Drag to orbit, scroll to zoom, right-drag to pan.`}
      >
        <OrbitScene
          data={sceneData}
          time={simulation.time}
          selected={effectiveSelected}
          onSelect={selectObject}
          view={view}
          layers={layers}
          solarCamera={solarCamera}
          hiddenSpacecraftPaths={Object.values(spacecraft.entries).flatMap(
            (e) => (e && !e.showTrajectory ? [e.spacecraft.id] : []),
          )}
          encounter={activeEncounter}
          encounterOptions={{
            ...encounterOptions,
            distanceLine: encounterOptions.distanceLine && layers.distanceLines,
          }}
          onSeek={simulation.seek}
        />
      </div>
      {!activeEncounter && (
        <>
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
            <span>
              {sceneData.objects.filter((o) => o.id.startsWith("neo:")).length}{" "}
              NEOs visible
            </span>
          </div>
          <DiscoveryPanel
            manager={manager}
            range={data.range}
            selected={effectiveSelected}
            onSelect={setSelected}
            getSimulationDate={getSimulationDate}
          />
          {spacecraft.entries[effectiveSelected] ? (
            <SpacecraftPanel
              entry={spacecraft.entries[effectiveSelected]!}
              time={simulation.time}
              earth={coversTime(earth, simulation.time) ? earth : undefined}
              onFocus={() => navigateSpacecraft(effectiveSelected, false)}
              onFollow={() => navigateSpacecraft(effectiveSelected, true)}
              onToggle={() => spacecraft.toggle(effectiveSelected, "visible")}
              onPath={() =>
                spacecraft.toggle(effectiveSelected, "showTrajectory")
              }
              onLoad={() => {
                setShowEvents(false);
                setShowSpacecraft(true);
              }}
            />
          ) : effectiveSelected === "earth" &&
            !coversTime(earth, simulation.time) ? (
            <aside className="object-panel stage-two-details">
              <h2>Earth</h2>
              <p>Earth ephemeris unavailable for selected date.</p>
            </aside>
          ) : bodyMetadata(effectiveSelected) &&
            effectiveSelected !== "earth" ? (
            <aside className="object-panel stage-two-details">
              <span className="eyebrow">SELECTED OBJECT</span>
              <h2>{bodyMetadata(effectiveSelected)?.name}</h2>
              <p>
                {bodyMetadata(effectiveSelected)?.type} · JPL{" "}
                {bodyMetadata(effectiveSelected)?.horizonsId}
              </p>
              <p>
                {effectiveSelected === "sun"
                  ? "Heliocentric origin"
                  : (planets.statuses[effectiveSelected] ?? "Queued")}
              </p>
              <button
                className="discover-button"
                onClick={() => camera("focus")}
              >
                Focus
              </button>
              <button
                className="discover-button"
                onClick={() => camera("follow")}
              >
                Follow
              </button>
              <p>Positions to scale. Display radii exaggerated.</p>
            </aside>
          ) : (
            <ObjectPanel
              object={effectiveSelected === "earth" ? earth : object}
              entry={effectiveSelected === "earth" ? undefined : selectedEntry}
              earth={earth}
              time={simulation.time}
              onAdd={(id) => {
                if (manager.store[id]) void manager.add(id);
                else {
                  const event = events.result.events.find(
                    (e) => e.object.id === id,
                  );
                  if (event) openEvent(event, "solar");
                }
              }}
              encounterLoading={encounter.loading}
              onEncounter={() =>
                selectedEntry && encounter.load(selectedEntry, enterEncounter)
              }
            />
          )}
          <div className="view-tools">
            <button
              className="icon-button"
              aria-label="Reset camera"
              title="Reset camera"
              onClick={() => {
                camera("inner");
                setView((value) => value + (value % 2 === 0 ? 2 : 1));
              }}
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
        </>
      )}
      {activeEncounter && (
        <EncounterPanel
          data={activeEncounter}
          time={simulation.time}
          options={encounterOptions}
          onOptions={setEncounterOptions}
          onSeek={simulation.seek}
        />
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
      <div className="event-navigation">
        <button onClick={() => jumpDate(utcDate(Date.now()))}>Today</button>
        <button disabled={encounter.loading} onClick={() => adjacentEvent(-1)}>
          Previous encounter
        </button>
        <button disabled={encounter.loading} onClick={() => adjacentEvent(1)}>
          Next encounter
        </button>
      </div>
      <TimeControls
        simulation={simulation}
        range={range}
        closestTime={activeEncounter?.approach.time}
        eventTime={selectedEvent?.approach.time}
      />
      <footer>
        <span>
          <span className="live-dot" />
          NASA/JPL HORIZONS{" "}
          <span className="footer-secondary">
            /{" "}
            {activeEncounter
              ? "10-minute vector samples"
              : "mixed-resolution vectors"}
          </span>
        </span>
        <span className="footer-secondary">
          {simulation.playing
            ? simulation.direction === 1
              ? "PLAYING FORWARD"
              : "PLAYING BACKWARD"
            : "SIMULATION PAUSED"}
          <span className="footer-divider">/</span>STAGE 04
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
          <span className="phase">EXPLORER / 04</span>
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

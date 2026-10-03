import { useMemo } from "react";
import type { EncounterDataset } from "@/models/encounter";
import type { EncounterOptions } from "./EncounterScene";
import {
  auToKm,
  earthRelativeTrajectory,
  interpolateState,
  kmToLunarDistance,
  relativeSpeedKmPerSecond,
  toEarthRelativePosition,
  trajectoryMinimum,
} from "@/lib/astronomy/encounter";
import { distance } from "@/lib/astronomy/interpolate";
export function EncounterPanel({
  data,
  time,
  options,
  onOptions,
  onSeek,
}: {
  data: EncounterDataset;
  time: number;
  options: EncounterOptions;
  onOptions: (options: EncounterOptions) => void;
  onSeek: (time: number) => void;
}) {
  const minimum = useMemo(
    () =>
      trajectoryMinimum(
        earthRelativeTrajectory(data.asteroid.points, data.earth.points),
      ),
    [data],
  );
  const asteroid = interpolateState(data.asteroid.points, time),
    earth = interpolateState(data.earth.points, time);
  const km = auToKm(distance(toEarthRelativePosition(asteroid, earth)));
  const minutes = Math.round(Math.abs(time - data.approach.time) / 60000);
  const fmt = (n: number | undefined, d = 0) =>
    n === undefined
      ? "Unavailable"
      : n.toLocaleString("en-US", { maximumFractionDigits: d });
  return (
    <aside className="encounter-panel" aria-label="Earth encounter telemetry">
      <span className="eyebrow">EARTH ENCOUNTER</span>
      <h2>{data.neo.name}</h2>
      <section>
        <h3>SIMULATION NOW</h3>
        <time>
          {new Date(time).toISOString().replace("T", " ").slice(0, 19)} UTC
        </time>
        <p className="encounter-distance">
          {fmt(km)} <small>km from Earth</small>
        </p>
        <p>
          {fmt(kmToLunarDistance(km), 3)} lunar distances ·{" "}
          {fmt(relativeSpeedKmPerSecond(asteroid, earth), 2)} km/s
        </p>
        <p>
          Closest approach:{" "}
          {minutes === 0
            ? "now"
            : `${time < data.approach.time ? "in" : "since"} ${Math.floor(minutes / 60)}h ${minutes % 60}m`}
        </p>
        <button onClick={() => onSeek(data.approach.time)}>
          Jump to closest approach
        </button>
      </section>
      <div className="encounter-cameras">
        {(["earth", "asteroid", "follow", "overview"] as const).map((mode) => (
          <button
            key={mode}
            aria-pressed={options.camera.mode === mode}
            onClick={() =>
              onOptions({
                ...options,
                camera: {
                  mode:
                    mode === "follow" && options.camera.mode === "follow"
                      ? "asteroid"
                      : mode,
                  revision: options.camera.revision + 1,
                },
              })
            }
          >
            {
              {
                earth: "Focus Earth",
                asteroid: "Focus Asteroid",
                follow: "Follow Asteroid",
                overview: "Overview",
              }[mode]
            }
          </button>
        ))}
      </div>
      <div className="encounter-toggles">
        {(["distanceLine", "asteroidTrail", "moonTrail"] as const).map(
          (key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={options[key]}
                disabled={key === "moonTrail" && !data.moon}
                onChange={(e) =>
                  onOptions({ ...options, [key]: e.target.checked })
                }
              />
              {
                {
                  distanceLine: "Show distance line",
                  asteroidTrail: "Asteroid trail",
                  moonTrail: "Moon trail",
                }[key]
              }
            </label>
          ),
        )}
      </div>
      {data.moonError && (
        <p role="alert" className="inline-error">
          {data.moonError} Return to Solar System and retry to load the Moon.
        </p>
      )}
      <details>
        <summary>NASA CLOSE APPROACH · published metadata</summary>
        <dl>
          <dt>Date (UTC)</dt>
          <dd>
            {new Date(data.approach.time)
              .toISOString()
              .slice(0, 16)
              .replace("T", " ")}{" "}
            ({data.approach.timePrecision} precision)
          </dd>
          <dt>Miss distance</dt>
          <dd>
            {fmt(data.approach.missDistanceKm)} km ·{" "}
            {fmt(data.approach.missDistanceLunar, 3)} LD
          </dd>
          <dt>Relative velocity</dt>
          <dd>{fmt(data.approach.relativeVelocityKmPerSecond, 2)} km/s</dd>
          <dt>Potentially hazardous</dt>
          <dd>
            {data.neo.potentiallyHazardous ? "Yes" : "No"} — classification, not
            an impact prediction.
          </dd>
        </dl>
      </details>
      <details>
        <summary>Scale & sampling</summary>
        <p>
          Positions share one scale: 1 unit = 1 lunar distance (384,400 km).
          Body sizes are exaggerated. Distances are measured from Earth’s
          center.
        </p>
        <p>
          Visualization minimum based on sampled/interpolated trajectory:{" "}
          {fmt(auToKm(distance(minimum)))} km at{" "}
          {new Date(minimum.time).toISOString().slice(0, 16).replace("T", " ")}{" "}
          UTC. This is a linear interpolation estimate from {data.stepMinutes}
          -minute samples, not a revised NASA prediction.
        </p>
        <button onClick={() => onSeek(minimum.time)}>
          Jump to visualization minimum
        </button>
      </details>
    </aside>
  );
}

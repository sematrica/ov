import { ArrowUpRight, Crosshair } from "lucide-react";
import { distance, interpolatePosition } from "@/lib/astronomy/interpolate";
import { formatDate } from "@/lib/astronomy/time";
import type { SpaceObjectTrajectory } from "@/models/trajectory";
export function ObjectPanel({
  object,
  time,
}: {
  object: SpaceObjectTrajectory;
  time: number;
}) {
  const point = interpolatePosition(object.points, time);
  const asteroid = object.id === "apophis";
  return (
    <aside
      className={`object-panel ${asteroid ? "asteroid" : "earth"}`}
      aria-label="Selected object information"
    >
      <div className="panel-heading">
        <span className="eyebrow">SELECTED OBJECT</span>
        <Crosshair size={15} />
      </div>
      <div className="object-title">
        <span className="object-dot" />
        <h2>{asteroid ? "Apophis" : "Earth"}</h2>
      </div>
      <p className="object-designation">
        {asteroid ? "99942 · 2004 MN4" : "399 · Our home planet"}
      </p>
      <span className="object-type">
        {asteroid ? "NEAR-EARTH ASTEROID" : "TERRESTRIAL PLANET"}
      </span>
      <div className="distance-reading">
        <span className="eyebrow">DISTANCE FROM SUN</span>
        <div>
          {distance(point).toFixed(4)} <span>AU</span>
        </div>
      </div>
      <div className="coordinates">
        <div className="coordinate-heading">
          <span className="eyebrow">HELIOCENTRIC POSITION</span>
          <span>AU</span>
        </div>
        {(["x", "y", "z"] as const).map((axis) => (
          <div className="coordinate" key={axis}>
            <span>{axis.toUpperCase()}</span>
            <code>
              {point[axis] >= 0 ? "+" : ""}
              {point[axis].toFixed(6)}
            </code>
          </div>
        ))}
      </div>
      <div className="panel-date">
        <span>Epoch</span>
        <span>
          {formatDate(time)}
          <br /> {new Date(time).toISOString().slice(11, 19)} UTC
        </span>
      </div>
      <a
        className="source-link"
        href="https://ssd.jpl.nasa.gov/horizons/"
        target="_blank"
        rel="noreferrer"
      >
        JPL Horizons ephemeris <ArrowUpRight size={14} />
      </a>
    </aside>
  );
}

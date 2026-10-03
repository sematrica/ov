import { ArrowUpRight, Crosshair } from "lucide-react";
import { distance, interpolatePosition } from "@/lib/astronomy/interpolate";
import { formatDate } from "@/lib/astronomy/time";
import { closestApproach } from "@/lib/neo/selection";
import { approachDate, diameterLabel, measurement } from "@/lib/neo/format";
import type { NeoEntry } from "@/models/neo";
import type { ObjectId, SpaceObjectTrajectory } from "@/models/trajectory";
export function ObjectPanel({
  object,
  entry,
  earth,
  time,
  onAdd,
  onEncounter,
  encounterLoading,
}: {
  object?: SpaceObjectTrajectory;
  entry?: NeoEntry;
  earth: SpaceObjectTrajectory;
  time: number;
  onAdd: (id: ObjectId) => void;
  onEncounter?: () => void;
  encounterLoading?: boolean;
}) {
  const neo = entry?.metadata;
  const point = object ? interpolatePosition(object.points, time) : undefined;
  const earthPosition = interpolatePosition(earth.points, time);
  const earthDistance = point
    ? Math.hypot(
        point.x - earthPosition.x,
        point.y - earthPosition.y,
        point.z - earthPosition.z,
      )
    : undefined;
  const approach = neo ? closestApproach(neo) : undefined;
  return (
    <aside
      className={`object-panel stage-two-details ${neo ? "asteroid" : "earth"}`}
      aria-label="Selected object information"
    >
      <div className="panel-heading">
        <span className="eyebrow">SELECTED OBJECT</span>
        <Crosshair size={15} />
      </div>
      <div className="object-title">
        <span className="object-dot" />
        <h2>{neo?.name ?? "Earth"}</h2>
      </div>
      <p className="object-designation">
        {neo ? `NASA ID ${neo.nasaId}` : "399 · Our home planet"}
      </p>
      {neo && (
        <section
          className="approach-details"
          aria-label="NASA close approach metadata"
        >
          <h3>NASA CLOSE APPROACH DATA</h3>
          <dl>
            <div>
              <dt>Potentially hazardous</dt>
              <dd>{neo.potentiallyHazardous ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Estimated diameter</dt>
              <dd>{diameterLabel(neo)}</dd>
            </div>
            <div>
              <dt>Approach (UTC)</dt>
              <dd>{approachDate(approach)}</dd>
            </div>
            <div>
              <dt>Miss distance</dt>
              <dd>
                {measurement(approach?.missDistanceKm, 0)} km
                <br />
                {measurement(approach?.missDistanceLunar, 3)} lunar distances
              </dd>
            </div>
            <div>
              <dt>Relative velocity</dt>
              <dd>
                {measurement(approach?.relativeVelocityKmPerSecond, 3)} km/s
              </dd>
            </div>
          </dl>
          <p className="classification-note">
            NASA’s potentially hazardous classification does not predict an
            impact.
          </p>
        </section>
      )}
      {neo && (
        <button
          className="discover-button"
          disabled={
            encounterLoading ||
            !neo.closeApproaches.some(
              (a) => a.orbitingBody === "Earth" && Number.isFinite(a.time),
            )
          }
          onClick={onEncounter}
        >
          {encounterLoading ? "Preparing encounter…" : "View Close Approach"}
        </button>
      )}
      <section
        className="position-details"
        aria-label="Current simulated position"
      >
        <h3>CURRENT SIMULATED POSITION</h3>
        <p className="position-epoch">
          {formatDate(time)} · {new Date(time).toISOString().slice(11, 19)} UTC
        </p>
        {point ? (
          <>
            <div className="distance-reading">
              <span className="eyebrow">DISTANCE FROM SUN</span>
              <div>
                {distance(point).toFixed(4)} <span>AU</span>
              </div>
            </div>
            {neo && (
              <p className="earth-distance">
                From Earth <strong>{earthDistance?.toFixed(6)} AU</strong>
              </p>
            )}
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
            <p className="resolved-target">JPL target: {object?.target}</p>
            {entry && !entry.visible && (
              <p className="discovery-hint">
                Trajectory loaded; hidden in the scene.
              </p>
            )}
          </>
        ) : (
          <div className="unloaded-position">
            <p>
              {entry?.status === "loading"
                ? "Loading trajectory from JPL Horizons…"
                : "Add this asteroid to calculate its simulated position from JPL Horizons."}
            </p>
            {entry?.error && (
              <p className="inline-error" role="alert">
                {entry.error}
              </p>
            )}
            {neo && entry?.status !== "loading" && (
              <button className="discover-button" onClick={() => onAdd(neo.id)}>
                {entry?.status === "error"
                  ? "Retry trajectory"
                  : "Add to visualization"}
              </button>
            )}
          </div>
        )}
      </section>
      <a
        className="source-link"
        href={neo?.nasaJplUrl ?? "https://ssd.jpl.nasa.gov/horizons/"}
        target="_blank"
        rel="noreferrer"
      >
        {neo ? "NASA / JPL object details" : "JPL Horizons ephemeris"}
        <ArrowUpRight size={14} />
      </a>
    </aside>
  );
}

import type { SpacecraftEntry } from "@/models/spacecraft";
import type { SpaceObjectTrajectory } from "@/models/trajectory";
import { spacecraftMeasurements } from "@/lib/spacecraft/measurements";
import { PROVIDERS } from "@/lib/providers/registry";
export function SpacecraftPanel({
  entry,
  time,
  earth,
  onFocus,
  onFollow,
  onToggle,
  onPath,
  onLoad,
}: {
  entry: SpacecraftEntry;
  time: number;
  earth?: SpaceObjectTrajectory;
  onFocus: () => void;
  onFollow: () => void;
  onToggle: () => void;
  onPath: () => void;
  onLoad: () => void;
}) {
  const { spacecraft, metadata, data } = entry;
  const measures = data
    ? spacecraftMeasurements(data.trajectory, time, earth ?? data.earth)
    : undefined;
  const number = (n: number | undefined, d = 3) =>
    n === undefined
      ? "Unavailable"
      : n.toLocaleString("en-US", { maximumFractionDigits: d });
  return (
    <aside
      className="object-panel stage-two-details spacecraft-panel"
      aria-label="Selected spacecraft information"
    >
      <span className="eyebrow">HUMAN SPACECRAFT</span>
      <h2>{spacecraft.name}</h2>
      <p>
        Horizons {spacecraft.horizonsId} ·{" "}
        {spacecraft.designation ?? "Designation unavailable"}
      </p>
      <div className="event-actions">
        <button onClick={onFocus} disabled={!measures}>
          Focus
        </button>
        <button onClick={onFollow} disabled={!measures}>
          Follow
        </button>
        <button onClick={onToggle} disabled={!data}>
          {entry.visible ? "Hide" : "Show"}
        </button>
        <button onClick={onPath} disabled={!data}>
          {entry.showTrajectory ? "Hide trajectory" : "Show trajectory"}
        </button>
        <button onClick={onLoad}>Load date range</button>
      </div>
      {entry.error && <p role="alert">{entry.error}</p>}
      <section>
        <h3>POSITION AT SIMULATION TIME</h3>
        <time>
          {new Date(time).toISOString().slice(0, 19).replace("T", " ")} UTC
        </time>
        <p className="explorer-note">
          Current modeled position from JPL Horizons. Ephemeris, not spacecraft
          telemetry.
        </p>
        {measures ? (
          <>
            <dl>
              <dt>Distance from Sun</dt>
              <dd>
                {number(measures.sunAu)} AU
                <br />
                {number(measures.sunKm, 0)} km
              </dd>
              <dt>Distance from Earth</dt>
              <dd>
                {number(measures.earthAu)} AU
                <br />
                {number(measures.earthKm, 0)} km
              </dd>
              <dt>Heliocentric speed</dt>
              <dd>{number(measures.speedKmPerSecond)} km/s</dd>
              <dt>Calculated one-way signal travel time</dt>
              <dd>
                {number(
                  measures.lightTimeSeconds === undefined
                    ? undefined
                    : measures.lightTimeSeconds / 3600,
                  2,
                )}{" "}
                hours
              </dd>
            </dl>
            <div className="coordinates">
              <span className="eyebrow">HELIOCENTRIC J2000 ECLIPTIC · AU</span>
              {(["x", "y", "z"] as const).map((axis) => (
                <div className="coordinate" key={axis}>
                  <span>{axis.toUpperCase()}</span>
                  <code>{measures.point[axis].toFixed(6)}</code>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p role="status">
            {entry.status === "loading"
              ? "Loading spacecraft ephemeris…"
              : "Trajectory unavailable for selected date."}
          </p>
        )}
        {data && (
          <p className="explorer-note">
            Loaded coverage:{" "}
            {new Date(data.range.start).toISOString().slice(0, 10)} through{" "}
            {new Date(data.range.end).toISOString().slice(0, 10)} UTC ·{" "}
            {data.stepMinutes}-minute samples. Coverage describes this request,
            not the mission’s full archive.
          </p>
        )}
        {data?.earthError && <p>{data.earthError}</p>}
        <a
          className="source-link"
          href={PROVIDERS.horizons.documentation}
          target="_blank"
          rel="noreferrer"
        >
          Ephemeris: {PROVIDERS.horizons.name}
        </a>
      </section>
      <section>
        <h3>MISSION METADATA</h3>
        <dl>
          <dt>Agency</dt>
          <dd>{metadata?.agency ?? "Unavailable"}</dd>
          <dt>Mission</dt>
          <dd>{metadata?.mission ?? "Unavailable"}</dd>
          <dt>Launch date</dt>
          <dd>{metadata?.launchDate ?? "Unavailable"}</dd>
          <dt>Mission status</dt>
          <dd>
            {metadata?.missionStatus ?? "Not supplied by metadata provider"}
          </dd>
        </dl>
        {metadata?.description && <p>{metadata.description}</p>}
        {metadata && (
          <>
            <p className="explorer-note">
              Curated profile snapshot reviewed {metadata.reviewedAt}; not a
              live operational-status feed.
            </p>
            <h3>MISSION TIMELINE</h3>
            <ol className="mission-timeline">
              {metadata.events.map((e) => (
                <li key={`${e.date}:${e.label}`}>
                  <time>{e.date}</time>
                  <span>{e.label} · day precision</span>
                </li>
              ))}
            </ol>
            {metadata.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                className="source-link"
                target="_blank"
                rel="noreferrer"
              >
                {source.name}
              </a>
            ))}
          </>
        )}
        {!metadata && (
          <p>
            {entry.metadataError ??
              "Mission metadata unavailable for this spacecraft."}
          </p>
        )}
      </section>
      <section>
        <h3>TELEMETRY</h3>
        <p>Public telemetry feed not available.</p>
        <p className="explorer-note">
          No engineering or instrument measurements are synthesized from these
          state vectors.
        </p>
      </section>
    </aside>
  );
}
